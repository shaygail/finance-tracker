import { db } from "@/lib/db";
import {
  getCurrentFinancialYearRange,
  getFinancialYearRange,
  round2,
} from "@/lib/gst/nz";
import { paymentModeToBucket } from "@/lib/sales/payments";

export type FyProfitSummary = {
  fyLabel: string;
  start: Date;
  end: Date;
  /**
   * POS revenue used for filing profit — cash payment method excluded.
   * (Bank / EFTPOS / card / Uber / Afterpay / other only.)
   */
  filingRevenueIncGst: number;
  filingRevenueExGst: number;
  filingGst: number;
  filingSaleCount: number;
  /** All POS sales including cash (for payment breakdown display). */
  allPosRevenueIncGst: number;
  allPosSaleCount: number;
  /** Breakdown of all POS revenue by payment bucket. */
  revenueByPayment: Array<{
    bucket: string;
    label: string;
    amount: number;
    orders: number;
    inFiling: boolean;
  }>;
  /** POS cash — shown for the accountant, not in filing profit. */
  cashInPos: number;
  cashInPosOrders: number;
  /** Manual cash_manual / cash sources — not in filing profit. */
  extraCashRevenue: number;
  /** Business expenses only (excludes Personal drawings). */
  expensesIncGst: number;
  expensesExGst: number;
  inputGst: number;
  expenseCount: number;
  expensesByCategory: Array<{ name: string; amount: number }>;
  /** Filing profit = non-cash POS revenue − business expenses. */
  profitIncGst: number;
  profitExGst: number;
  /** Full picture including POS cash (not for filing if you omit cash). */
  profitWithCashIncGst: number;
  profitWithCashExGst: number;
  /** Accountant memos — not in P&L. */
  cashOutNotesTotal: number;
  cashOutNotesCount: number;
  personalDrawingsTotal: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash (POS)",
  bank_transfer: "Bank transfer",
  eftpos: "EFTPOS",
  card: "Visa / Mastercard",
  uber_eats: "Uber Eats",
  afterpay: "Afterpay",
  other: "Other",
};

export async function getFyProfitSummary(
  businessId: string,
  fyLabel?: string
): Promise<FyProfitSummary> {
  const range = fyLabel
    ? { ...getFinancialYearRange(fyLabel), label: fyLabel }
    : getCurrentFinancialYearRange();
  const { start, end, label } = range;

  const [posSales, extraCashSales, transactions, cashOutNotes] =
    await Promise.all([
      db.sale.findMany({
        where: {
          businessId,
          soldAt: { gte: start, lte: end },
          source: "pos",
        },
        select: {
          totalAmount: true,
          amountExGst: true,
          gstAmount: true,
          paymentMode: true,
        },
      }),
      db.sale.findMany({
        where: {
          businessId,
          soldAt: { gte: start, lte: end },
          source: { in: ["cash", "cash_manual"] },
        },
        select: { totalAmount: true },
      }),
      db.transaction.findMany({
        where: {
          businessId,
          date: { gte: start, lte: end },
          type: { in: ["expense", "refund"] },
        },
        include: { category: true },
      }),
      db.cashOutNote.findMany({
        where: { businessId, date: { gte: start, lte: end } },
        select: { amount: true },
      }),
    ]);

  const byPay = new Map<string, { amount: number; orders: number }>();
  let filingRevenueIncGst = 0;
  let filingRevenueExGst = 0;
  let filingGst = 0;
  let filingSaleCount = 0;
  let cashInPos = 0;
  let cashInPosExGst = 0;
  let cashInPosOrders = 0;

  for (const sale of posSales) {
    const bucket = paymentModeToBucket(sale.paymentMode);
    const cur = byPay.get(bucket) ?? { amount: 0, orders: 0 };
    cur.amount += sale.totalAmount;
    cur.orders += 1;
    byPay.set(bucket, cur);

    if (bucket === "cash") {
      cashInPos += sale.totalAmount;
      cashInPosExGst += sale.amountExGst;
      cashInPosOrders += 1;
      continue;
    }

    filingRevenueIncGst += sale.totalAmount;
    filingRevenueExGst += sale.amountExGst;
    filingGst += sale.gstAmount;
    filingSaleCount += 1;
  }

  const revenueByPayment = [...byPay.entries()]
    .map(([bucket, v]) => ({
      bucket,
      label: PAYMENT_LABELS[bucket] ?? bucket,
      amount: round2(v.amount),
      orders: v.orders,
      inFiling: bucket !== "cash",
    }))
    .sort((a, b) => b.amount - a.amount);

  const allPosRevenueIncGst = round2(
    posSales.reduce((s, x) => s + x.totalAmount, 0)
  );
  const extraCashRevenue = round2(
    extraCashSales.reduce((s, x) => s + x.totalAmount, 0)
  );

  const businessExpenses = transactions.filter(
    (t) => t.category?.slug !== "personal"
  );
  const personalDrawings = transactions.filter(
    (t) => t.category?.slug === "personal"
  );

  const expensesIncGst = round2(
    businessExpenses.reduce((s, t) => s + t.totalAmount, 0)
  );
  const expensesExGst = round2(
    businessExpenses.reduce((s, t) => s + t.amountExGst, 0)
  );
  const inputGst = round2(
    businessExpenses.reduce((s, t) => s + t.gstAmount, 0)
  );

  const byCat = new Map<string, number>();
  for (const t of businessExpenses) {
    const name = t.category?.name ?? "Uncategorised";
    byCat.set(name, (byCat.get(name) ?? 0) + t.totalAmount);
  }
  const expensesByCategory = [...byCat.entries()]
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  filingRevenueIncGst = round2(filingRevenueIncGst);
  filingRevenueExGst = round2(filingRevenueExGst);
  filingGst = round2(filingGst);
  cashInPos = round2(cashInPos);
  cashInPosExGst = round2(cashInPosExGst);

  return {
    fyLabel: label,
    start,
    end,
    filingRevenueIncGst,
    filingRevenueExGst,
    filingGst,
    filingSaleCount,
    allPosRevenueIncGst,
    allPosSaleCount: posSales.length,
    revenueByPayment,
    cashInPos,
    cashInPosOrders,
    extraCashRevenue,
    expensesIncGst,
    expensesExGst,
    inputGst,
    expenseCount: businessExpenses.length,
    expensesByCategory,
    profitIncGst: round2(filingRevenueIncGst - expensesIncGst),
    profitExGst: round2(filingRevenueExGst - expensesExGst),
    profitWithCashIncGst: round2(
      filingRevenueIncGst + cashInPos - expensesIncGst
    ),
    profitWithCashExGst: round2(
      filingRevenueExGst + cashInPosExGst - expensesExGst
    ),
    cashOutNotesTotal: round2(
      cashOutNotes.reduce((s, n) => s + n.amount, 0)
    ),
    cashOutNotesCount: cashOutNotes.length,
    personalDrawingsTotal: round2(
      personalDrawings.reduce((s, t) => s + t.totalAmount, 0)
    ),
  };
}
