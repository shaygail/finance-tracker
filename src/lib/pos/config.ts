/**
 * POS PostgreSQL query mapping for STLL HAUS.
 *
 * Set POS_DATABASE_URL in .env to your POS Postgres connection string.
 * Use POS_PRESET=stllhaus for the STLL Haus POS schema (menu_items + sales JSON).
 */
export interface PosTableMapping {
  table: string;
  columns: Record<string, string>;
}

export type PosLinesSource = "table" | "json";

export interface PosConfig {
  products: PosTableMapping;
  sales: PosTableMapping;
  saleLines: PosTableMapping;
  /** How line items are stored: separate table or JSON on the sales row */
  linesSource: PosLinesSource;
  /** When linesSource=json, column on sales table holding line items */
  salesItemsColumn: string;
  /** How sale total is derived */
  salesTotalMode: "column" | "computed";
  salesSubtotalColumn: string;
  salesDiscountColumn: string;
}

/** STLL Haus POS on Railway — menu_items + sales with JSON items */
export const STLLHAUS_POS_CONFIG: PosConfig = {
  products: {
    table: "menu_items",
    columns: {
      id: "id",
      name: "name",
      sku: "category",
      price: "price",
    },
  },
  sales: {
    table: "sales",
    columns: {
      id: "id",
      soldAt: "date",
      total: "subtotal",
      payment: "payment_method",
    },
  },
  saleLines: {
    table: "sales",
    columns: {
      saleId: "id",
      productId: "id",
      productName: "name",
      quantity: "quantity",
      unitPrice: "price",
      lineTotal: "line_total",
    },
  },
  linesSource: "json",
  salesItemsColumn: "items",
  salesTotalMode: "computed",
  salesSubtotalColumn: "subtotal",
  salesDiscountColumn: "discount",
};

/** Generic self-hosted POS layout (separate order_items table) */
export const DEFAULT_POS_CONFIG: PosConfig = {
  products: {
    table: process.env.POS_PRODUCTS_TABLE ?? "products",
    columns: {
      id: process.env.POS_PRODUCTS_COL_ID ?? "id",
      name: process.env.POS_PRODUCTS_COL_NAME ?? "name",
      sku: process.env.POS_PRODUCTS_COL_SKU ?? "sku",
      price: process.env.POS_PRODUCTS_COL_PRICE ?? "price",
    },
  },
  sales: {
    table: process.env.POS_SALES_TABLE ?? "orders",
    columns: {
      id: process.env.POS_SALES_COL_ID ?? "id",
      soldAt: process.env.POS_SALES_COL_DATE ?? "created_at",
      total: process.env.POS_SALES_COL_TOTAL ?? "total",
      payment: process.env.POS_SALES_COL_PAYMENT ?? "payment_method",
    },
  },
  saleLines: {
    table: process.env.POS_LINES_TABLE ?? "order_items",
    columns: {
      saleId: process.env.POS_LINES_COL_SALE_ID ?? "order_id",
      productId: process.env.POS_LINES_COL_PRODUCT_ID ?? "product_id",
      productName: process.env.POS_LINES_COL_PRODUCT_NAME ?? "product_name",
      quantity: process.env.POS_LINES_COL_QTY ?? "quantity",
      unitPrice: process.env.POS_LINES_COL_UNIT_PRICE ?? "unit_price",
      lineTotal: process.env.POS_LINES_COL_LINE_TOTAL ?? "line_total",
    },
  },
  linesSource: (process.env.POS_LINES_SOURCE as PosLinesSource) ?? "table",
  salesItemsColumn: process.env.POS_SALES_COL_ITEMS ?? "items",
  salesTotalMode: "column",
  salesSubtotalColumn: process.env.POS_SALES_COL_SUBTOTAL ?? "subtotal",
  salesDiscountColumn: process.env.POS_SALES_COL_DISCOUNT ?? "discount",
};

function configFromEnvOverrides(base: PosConfig): PosConfig {
  const env = process.env;
  if (!env.POS_PRODUCTS_TABLE && !env.POS_SALES_TABLE) return base;

  return {
    products: {
      table: env.POS_PRODUCTS_TABLE ?? base.products.table,
      columns: {
        id: env.POS_PRODUCTS_COL_ID ?? base.products.columns.id,
        name: env.POS_PRODUCTS_COL_NAME ?? base.products.columns.name,
        sku: env.POS_PRODUCTS_COL_SKU ?? base.products.columns.sku,
        price: env.POS_PRODUCTS_COL_PRICE ?? base.products.columns.price,
      },
    },
    sales: {
      table: env.POS_SALES_TABLE ?? base.sales.table,
      columns: {
        id: env.POS_SALES_COL_ID ?? base.sales.columns.id,
        soldAt: env.POS_SALES_COL_DATE ?? base.sales.columns.soldAt,
        total: env.POS_SALES_COL_TOTAL ?? base.sales.columns.total,
        payment: env.POS_SALES_COL_PAYMENT ?? base.sales.columns.payment,
      },
    },
    saleLines: {
      table: env.POS_LINES_TABLE ?? base.saleLines.table,
      columns: {
        saleId: env.POS_LINES_COL_SALE_ID ?? base.saleLines.columns.saleId,
        productId: env.POS_LINES_COL_PRODUCT_ID ?? base.saleLines.columns.productId,
        productName: env.POS_LINES_COL_PRODUCT_NAME ?? base.saleLines.columns.productName,
        quantity: env.POS_LINES_COL_QTY ?? base.saleLines.columns.quantity,
        unitPrice: env.POS_LINES_COL_UNIT_PRICE ?? base.saleLines.columns.unitPrice,
        lineTotal: env.POS_LINES_COL_LINE_TOTAL ?? base.saleLines.columns.lineTotal,
      },
    },
    linesSource: (env.POS_LINES_SOURCE as PosLinesSource) ?? base.linesSource,
    salesItemsColumn: env.POS_SALES_COL_ITEMS ?? base.salesItemsColumn,
    salesTotalMode:
      env.POS_SALES_TOTAL_MODE === "computed" ? "computed" : base.salesTotalMode,
    salesSubtotalColumn: env.POS_SALES_COL_SUBTOTAL ?? base.salesSubtotalColumn,
    salesDiscountColumn: env.POS_SALES_COL_DISCOUNT ?? base.salesDiscountColumn,
  };
}

export function getPosConfig(): PosConfig {
  const preset = process.env.POS_PRESET?.toLowerCase();
  const base =
    preset === "stllhaus" || preset === "stll-haus"
      ? STLLHAUS_POS_CONFIG
      : DEFAULT_POS_CONFIG;
  return configFromEnvOverrides(base);
}

export function isPosConfigured(): boolean {
  return Boolean(process.env.POS_DATABASE_URL);
}
