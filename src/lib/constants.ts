export const PAYMENT_MODES = [
  "Cash",
  "EFTPOS",
  "Credit Card",
  "Bank Transfer",
  "Online",
  "Other",
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "sale", label: "Sale" },
  { value: "refund", label: "Refund" },
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number]["value"];

export const DEMO_CREDENTIALS = {
  owner: {
    email: "owner@demo.co.nz",
    password: "demo1234",
    role: "owner",
  },
  accountant: {
    email: "accountant@demo.co.nz",
    password: "demo1234",
    role: "accountant",
  },
} as const;

export const GST_FILING_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "two_monthly", label: "Two-monthly" },
  { value: "six_monthly", label: "Six-monthly" },
] as const;
