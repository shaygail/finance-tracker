import { getPosApiUrl } from "./config";
import type { PosProductRow, PosSaleLineRow, PosSaleRow } from "./types";

interface ApiMenuItem {
  id: string | number;
  name: string;
  category?: string | null;
  price: number;
}

interface ApiSaleItem {
  id?: string | number | null;
  name?: string | null;
  price?: number | null;
  quantity?: number | null;
  description?: string | null;
}

interface ApiSale {
  id: number | string;
  date: string;
  items?: ApiSaleItem[] | null;
  subtotal?: number | null;
  discount?: number | null;
  payment_method?: string | null;
  customer_name?: string | null;
}

let salesCache: ApiSale[] | null = null;

function apiBase(): string {
  const url = getPosApiUrl();
  if (!url) throw new Error("POS_API_URL is not configured");
  return url;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`POS API ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function loadSales(): Promise<ApiSale[]> {
  if (!salesCache) {
    salesCache = await getJson<ApiSale[]>("/sales");
  }
  return salesCache;
}

/** Clear cached /sales payload between sync runs */
export function clearPosApiCache(): void {
  salesCache = null;
}

function notesFromDescription(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

export async function testPosApiConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getJson<unknown>("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

export async function fetchPosProductsViaApi(): Promise<PosProductRow[]> {
  const rows = await getJson<ApiMenuItem[]>("/menu");
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? "Unknown"),
    sku: r.category ? String(r.category) : null,
    price: Number(r.price) || 0,
  }));
}

export async function fetchPosSalesViaApi(since?: Date): Promise<PosSaleRow[]> {
  const rows = await loadSales();
  return rows
    .map((r) => {
      const subtotal = Number(r.subtotal) || 0;
      const discount = Number(r.discount) || 0;
      const total = Math.max(0, subtotal - discount);
      const soldAt = new Date(r.date);
      return {
        id: String(r.id),
        soldAt,
        total,
        payment: r.payment_method ? String(r.payment_method) : null,
        customerName: r.customer_name ? String(r.customer_name) : null,
      } satisfies PosSaleRow;
    })
    .filter((r) => !Number.isNaN(r.soldAt.getTime()))
    .filter((r) => (since ? r.soldAt >= since : true));
}

export async function fetchPosSaleLinesViaApi(
  saleIds: string[]
): Promise<PosSaleLineRow[]> {
  if (saleIds.length === 0) return [];
  const wanted = new Set(saleIds);
  const rows = await loadSales();
  const lines: PosSaleLineRow[] = [];

  for (const sale of rows) {
    const saleId = String(sale.id);
    if (!wanted.has(saleId)) continue;
    for (const item of sale.items ?? []) {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || 0;
      lines.push({
        saleId,
        productId: item.id != null ? String(item.id) : null,
        productName: String(item.name ?? "Unknown"),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        notes: notesFromDescription(item.description),
      });
    }
  }

  return lines;
}
