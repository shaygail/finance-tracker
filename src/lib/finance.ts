/** Core P&L metrics for the finance tracker dashboard. */

export type FinanceTotals = {
  revenue: number;
  expenses: number;
  cogs: number;
  tax: number;
  income: number;
};

type ProductLike = { revenue: number; cogs: number };
type TransactionLike = {
  type: string;
  totalAmount: number;
  gstAmount: number;
};

/**
 * Derive the five headline figures:
 * - Revenue — product sales
 * - Expenses — expense/refund transactions
 * - COGS — product cost of goods sold
 * - Tax — net GST (output − input)
 * - Income — net income (revenue − cogs − expenses)
 */
export function calculateFinanceTotals(
  products: ProductLike[],
  transactions: TransactionLike[]
): FinanceTotals {
  const revenue = round2(products.reduce((sum, p) => sum + p.revenue, 0));
  const cogs = round2(products.reduce((sum, p) => sum + p.cogs, 0));

  const expenses = round2(
    transactions
      .filter((t) => t.type === "expense" || t.type === "refund")
      .reduce((sum, t) => sum + t.totalAmount, 0)
  );

  const gstOnIncome = transactions
    .filter((t) => t.type === "income" || t.type === "sale")
    .reduce((sum, t) => sum + t.gstAmount, 0);
  const gstOnExpenses = transactions
    .filter((t) => t.type === "expense" || t.type === "refund")
    .reduce((sum, t) => sum + t.gstAmount, 0);
  const tax = round2(gstOnIncome - gstOnExpenses);

  const income = round2(revenue - cogs - expenses);

  return { revenue, expenses, cogs, tax, income };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
