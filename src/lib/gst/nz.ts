export const NZ_GST_RATE = 0.15;

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
