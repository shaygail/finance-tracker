#!/usr/bin/env npx tsx
/**
 * Generates demo/sample-expenses.xlsx with standard 7-column layout.
 */
import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
import { join } from "path";

const rows = [
  ["Date", "Purchases", "Amount", "Quantity", "Total Amount", "Mode of Payment", "Category"],
  ["2026-02-20", "Cups (320)", 10.79, 3, 32.37, "Card/AfterPay", "Supplies"],
  ["2026-02-20", "100pc ColdBrew Extraction Bag", 7.71, 1, 7.71, "Card/AfterPay", "Supplies"],
  ["2026-02-21", "Breville Barista Express", 629, 1, 629, "Finance", "Equipment & Tools"],
  ["2026-02-22", "Refresh Coconut Water", 4.29, 1, 4.29, "Card", "Cost of Goods Sold"],
  ["2026-02-26", "Anchor Cream 500ml", 4.83, 2, 9.66, "Card", "Cost of Goods Sold"],
  ["2026-03-01", "Otis Oat Milk", 3.89, 4, 15.56, "Cash", "Cost of Goods Sold"],
  ["2026-03-05", "Matcha (Thea)", 120, 1, 120, "Card/AfterPay", "Cost of Goods Sold"],
  ["2026-03-09", "Iceland 216L Fridge Freezer", 249, 1, 249, "Card", "Equipment & Tools"],
  ["2026-03-16", "Food business Registration", 366, 1, 366, "Cash+Card", "Non Operating"],
  ["2026-03-21", "B2B NM2KYO Premium Kyoto Matcha Bulk", 345, 1, 345, "Card/AfterPay", "Cost of Goods Sold"],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Purchases");

const out = join(process.cwd(), "demo", "sample-expenses.xlsx");
XLSX.writeFile(wb, out);
console.log("Wrote", out);
