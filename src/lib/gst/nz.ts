export const NZ_GST_RATE = 0.15;

export type GstFilingFrequency = "monthly" | "two_monthly" | "six_monthly";

export interface GstPeriod {
  id: string;
  label: string;
  start: Date;
  end: Date;
  dueDate: Date;
}

export function calculateGstFromInc(amountIncGst: number) {
  const amountExGst = amountIncGst / (1 + NZ_GST_RATE);
  const gstAmount = amountIncGst - amountExGst;
  return {
    amountExGst: round2(amountExGst),
    gstAmount: round2(gstAmount),
    amountIncGst: round2(amountIncGst),
  };
}

export function calculateGstFromEx(amountExGst: number) {
  const gstAmount = amountExGst * NZ_GST_RATE;
  const amountIncGst = amountExGst + gstAmount;
  return {
    amountExGst: round2(amountExGst),
    gstAmount: round2(gstAmount),
    amountIncGst: round2(amountIncGst),
  };
}

export function splitIncGst(amountIncGst: number) {
  return calculateGstFromInc(amountIncGst);
}

export function splitExGst(amountExGst: number) {
  return calculateGstFromEx(amountExGst);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) {
    return `${year}/${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}/${year.toString().slice(2)}`;
}

export function getFinancialYearRange(fyLabel: string): { start: Date; end: Date } {
  const [startYear] = fyLabel.split("/").map(Number);
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59);
  return { start, end };
}

export function getCurrentFinancialYearRange(): { start: Date; end: Date; label: string } {
  const label = getFinancialYear();
  const { start, end } = getFinancialYearRange(label);
  return { start, end, label };
}

export function isInFinancialYear(date: Date, fyLabel: string): boolean {
  const { start, end } = getFinancialYearRange(fyLabel);
  return date >= start && date <= end;
}

/** IRD GST return due date for a taxable period ending on `periodEnd`. */
export function getGstDueDate(periodEnd: Date): Date {
  const endMonth = periodEnd.getMonth();
  const endDay = periodEnd.getDate();
  const endYear = periodEnd.getFullYear();

  // Period ending 30 November → due 15 January
  if (endMonth === 10 && endDay === 30) {
    return new Date(endYear + 1, 0, 15);
  }

  // Period ending 31 March → due 7 May
  if (endMonth === 2 && endDay === 31) {
    return new Date(endYear, 4, 7);
  }

  // Default: 28th of the month after period end
  return new Date(endYear, endMonth + 1, 28);
}

function formatPeriodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
  return `${start.toLocaleDateString("en-NZ", opts)} – ${end.toLocaleDateString("en-NZ", opts)}`;
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59);
}

/** GST taxable periods for a financial year (31 March balance date). */
export function getGstPeriods(
  fyLabel: string,
  frequency: GstFilingFrequency = "two_monthly"
): GstPeriod[] {
  const { start, end } = getFinancialYearRange(fyLabel);
  const periods: GstPeriod[] = [];

  if (frequency === "monthly") {
    let cursor = new Date(start);
    while (cursor <= end) {
      const periodEnd = endOfMonth(cursor.getFullYear(), cursor.getMonth());
      if (periodEnd > end) break;
      const periodStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      periods.push({
        id: `${periodStart.toISOString().slice(0, 7)}`,
        label: formatPeriodLabel(periodStart, periodEnd),
        start: periodStart,
        end: periodEnd,
        dueDate: getGstDueDate(periodEnd),
      });
      cursor = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 1);
    }
    return periods;
  }

  if (frequency === "six_monthly") {
    const firstEnd = endOfMonth(start.getFullYear(), 8); // 30 Sep
    const secondEnd = end; // 31 Mar
    for (const [periodStart, periodEnd] of [
      [start, firstEnd],
      [new Date(firstEnd.getFullYear(), firstEnd.getMonth() + 1, 1), secondEnd],
    ] as const) {
      periods.push({
        id: `${periodStart.toISOString().slice(0, 7)}`,
        label: formatPeriodLabel(periodStart, periodEnd),
        start: periodStart,
        end: periodEnd,
        dueDate: getGstDueDate(periodEnd),
      });
    }
    return periods;
  }

  // two_monthly — Apr–May, Jun–Jul, Aug–Sep, Oct–Nov, Dec–Jan, Feb–Mar
  const twoMonthEnds = [
    endOfMonth(start.getFullYear(), 4), // May
    endOfMonth(start.getFullYear(), 6), // Jul
    endOfMonth(start.getFullYear(), 8), // Sep
    endOfMonth(start.getFullYear(), 10), // Nov
    endOfMonth(start.getFullYear() + 1, 0), // Jan
    end, // Mar
  ];

  let periodStart = start;
  for (const periodEnd of twoMonthEnds) {
    periods.push({
      id: `${periodStart.toISOString().slice(0, 7)}`,
      label: formatPeriodLabel(periodStart, periodEnd),
      start: periodStart,
      end: periodEnd,
      dueDate: getGstDueDate(periodEnd),
    });
    periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 1);
  }

  return periods;
}

export function getPeriodForDate(
  date: Date,
  fyLabel: string,
  frequency: GstFilingFrequency = "two_monthly"
): GstPeriod | undefined {
  return getGstPeriods(fyLabel, frequency).find((p) => date >= p.start && date <= p.end);
}

export interface GstPeriodSummary {
  period: GstPeriod;
  gstOnExpenses: number;
  gstOnIncome: number;
  netGst: number;
  transactionCount: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function summariseGstPeriods(
  transactions: Array<{ date: Date; type: string; gstAmount: number }>,
  fyLabel: string,
  frequency: GstFilingFrequency = "two_monthly"
): GstPeriodSummary[] {
  const periods = getGstPeriods(fyLabel, frequency);
  const now = new Date();
  const soonMs = 14 * 24 * 60 * 60 * 1000;

  return periods.map((period) => {
    const inPeriod = transactions.filter(
      (t) => t.date >= period.start && t.date <= period.end
    );
    const expenses = inPeriod.filter((t) => t.type === "expense" || t.type === "refund");
    const income = inPeriod.filter((t) => t.type === "income" || t.type === "sale");

    const gstOnExpenses = expenses.reduce((s, t) => s + t.gstAmount, 0);
    const gstOnIncome = income.reduce((s, t) => s + t.gstAmount, 0);

    return {
      period,
      gstOnExpenses: round2(gstOnExpenses),
      gstOnIncome: round2(gstOnIncome),
      netGst: round2(gstOnIncome - gstOnExpenses),
      transactionCount: inPeriod.length,
      isOverdue: period.dueDate < now,
      isDueSoon: period.dueDate >= now && period.dueDate.getTime() - now.getTime() <= soonMs,
    };
  });
}

/** Monthly surplus = revenue − expenses (inc GST totals). */
export function calculateSurplus(
  totalRevenue: number,
  totalExpenses: number
): number {
  return round2(totalRevenue - totalExpenses);
}
