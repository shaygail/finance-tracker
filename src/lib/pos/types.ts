export interface PosProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
}

export interface PosSaleRow {
  id: string;
  soldAt: Date;
  total: number;
  payment: string | null;
  customerName?: string | null;
}

export interface PosSaleLineRow {
  saleId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
}
