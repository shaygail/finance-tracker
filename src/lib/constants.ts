export const BUSINESS = {
  name: "STLL HAUS",
  legalName: "STLL HAUS",
  tagline: "Finance & inventory",
} as const;

export const PAYMENT_MODES = [
  "Cash",
  "EFTPOS",
  "Credit Card",
  "Card/AfterPay",
  "Direct Debit",
  "Bank Transfer",
  "Finance",
  "Other",
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const GST_FILING_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "two_monthly", label: "Two-monthly" },
  { value: "six_monthly", label: "Six-monthly" },
] as const;
