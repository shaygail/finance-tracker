import { Pool, type QueryResultRow } from "pg";
import {
  fetchPosProductsViaApi,
  fetchPosSaleLinesViaApi,
  fetchPosSalesViaApi,
  testPosApiConnection,
} from "./api-client";
import { getPosConfig, getPosTransport, type PosConfig } from "./config";
import type { PosProductRow, PosSaleLineRow, PosSaleRow } from "./types";

export type { PosProductRow, PosSaleLineRow, PosSaleRow } from "./types";

let pool: Pool | null = null;

export function getPosPool(): Pool {
  const url = process.env.POS_DATABASE_URL;
  if (!url) {
    throw new Error("POS_DATABASE_URL is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: process.env.POS_DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 3,
    });
  }
  return pool;
}

export async function testPosConnection(): Promise<{ ok: boolean; error?: string }> {
  if (getPosTransport() === "api") {
    return testPosApiConnection();
  }
  try {
    const client = await getPosPool().connect();
    await client.query("SELECT 1");
    client.release();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

function q(table: string, col: string): string {
  return `"${table.replace(/"/g, "")}"."${col.replace(/"/g, "")}"`;
}

function t(table: string): string {
  return table.replace(/"/g, "");
}

function notesFromDescription(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

function parseJsonItems(raw: unknown): PosSaleLineRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    const quantity = Number(row.quantity) || 1;
    const unitPrice = Number(row.price) || 0;
    const lineTotal = quantity * unitPrice;
    return {
      saleId: "",
      productId: row.id != null ? String(row.id) : null,
      productName: String(row.name ?? "Unknown"),
      quantity,
      unitPrice,
      lineTotal,
      notes: notesFromDescription(row.description),
    };
  });
}

export async function fetchPosProducts(config: PosConfig = getPosConfig()): Promise<PosProductRow[]> {
  if (getPosTransport() === "api") {
    return fetchPosProductsViaApi();
  }
  const { table, columns } = config.products;
  const sql = `
    SELECT
      ${q(table, columns.id)}::text AS id,
      ${q(table, columns.name)}::text AS name,
      ${q(table, columns.sku)}::text AS sku,
      COALESCE(${q(table, columns.price)}::float, 0) AS price
    FROM "${t(table)}"
    ORDER BY ${q(table, columns.name)}
  `;
  const result = await getPosPool().query<QueryResultRow>(sql);
  return result.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? "Unknown"),
    sku: r.sku ? String(r.sku) : null,
    price: Number(r.price) || 0,
  }));
}

export async function fetchPosSales(
  since?: Date,
  config: PosConfig = getPosConfig()
): Promise<PosSaleRow[]> {
  if (getPosTransport() === "api") {
    return fetchPosSalesViaApi(since);
  }
  const { table, columns } = config.sales;
  const tableName = t(table);

  const totalExpr =
    config.salesTotalMode === "computed"
      ? `(COALESCE(${q(table, config.salesSubtotalColumn)}::float, 0) - COALESCE(${q(table, config.salesDiscountColumn)}::float, 0))`
      : `COALESCE(${q(table, columns.total)}::float, 0)`;

  let sql = `
    SELECT
      ${q(table, columns.id)}::text AS id,
      ${q(table, columns.soldAt)} AS sold_at,
      ${totalExpr} AS total,
      ${q(table, columns.payment)}::text AS payment
    FROM "${tableName}"
  `;
  const params: unknown[] = [];
  if (since) {
    sql += ` WHERE ${q(table, columns.soldAt)} >= $1`;
    params.push(since);
  }
  sql += ` ORDER BY ${q(table, columns.soldAt)} DESC`;

  const result = await getPosPool().query<QueryResultRow>(sql, params);
  return result.rows.map((r) => ({
    id: String(r.id),
    soldAt: new Date(r.sold_at as string | Date),
    total: Number(r.total) || 0,
    payment: r.payment ? String(r.payment) : null,
  }));
}

export async function fetchPosSaleLines(
  saleIds: string[],
  config: PosConfig = getPosConfig()
): Promise<PosSaleLineRow[]> {
  if (saleIds.length === 0) return [];

  if (getPosTransport() === "api") {
    return fetchPosSaleLinesViaApi(saleIds);
  }

  if (config.linesSource === "json") {
    const { table, columns } = config.sales;
    const tableName = t(table);
    const itemsCol = config.salesItemsColumn;
    const sql = `
      SELECT
        ${q(table, columns.id)}::text AS sale_id,
        ${q(table, itemsCol)} AS items
      FROM "${tableName}"
      WHERE ${q(table, columns.id)}::text = ANY($1::text[])
    `;
    const result = await getPosPool().query<QueryResultRow>(sql, [saleIds]);
    const lines: PosSaleLineRow[] = [];
    for (const row of result.rows) {
      const saleId = String(row.sale_id);
      const items =
        typeof row.items === "string"
          ? (JSON.parse(row.items) as unknown)
          : row.items;
      for (const line of parseJsonItems(items)) {
        lines.push({ ...line, saleId });
      }
    }
    return lines;
  }

  const { table, columns } = config.saleLines;
  const tableName = t(table);
  const sql = `
    SELECT
      ${q(table, columns.saleId)}::text AS sale_id,
      ${q(table, columns.productId)}::text AS product_id,
      COALESCE(${q(table, columns.productName)}::text, 'Unknown') AS product_name,
      COALESCE(${q(table, columns.quantity)}::float, 1) AS quantity,
      COALESCE(${q(table, columns.unitPrice)}::float, 0) AS unit_price,
      COALESCE(${q(table, columns.lineTotal)}::float, 0) AS line_total
    FROM "${tableName}"
    WHERE ${q(table, columns.saleId)}::text = ANY($1::text[])
  `;

  const result = await getPosPool().query<QueryResultRow>(sql, [saleIds]);
  return result.rows.map((r) => ({
    saleId: String(r.sale_id),
    productId: r.product_id ? String(r.product_id) : null,
    productName: String(r.product_name),
    quantity: Number(r.quantity) || 1,
    unitPrice: Number(r.unit_price) || 0,
    lineTotal: Number(r.line_total) || 0,
  }));
}
