import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { calculateGstFromInc } from "../src/lib/gst/nz";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

const VENDORS = [
  "Pak'nSave",
  "Countdown",
  "OfficeMax",
  "Spark",
  "Trade Me",
  "Bunnings",
  "Mitre 10",
  "Z Energy",
  "BP",
  "Air New Zealand",
  "Xero",
  "NZ Post",
  "The Warehouse",
  "Noel Leeming",
  "PB Tech",
];

const CATEGORIES = [
  { name: "Supplies", slug: "supplies", type: "expense" },
  { name: "Cost of Goods Sold", slug: "cos", type: "expense" },
  { name: "Non Operating", slug: "non-operating", type: "expense" },
  { name: "Equipment & Tools", slug: "equipment-tools", type: "expense" },
  { name: "Sales Revenue", slug: "sales-revenue", type: "income" },
];

const INGREDIENTS = [
  { name: "Flour", unit: "kg", parLevel: 20, currentStock: 15, qrCode: "ING-FLOUR-001" },
  { name: "Sugar", unit: "kg", parLevel: 15, currentStock: 8, qrCode: "ING-SUGAR-002" },
  { name: "Butter", unit: "kg", parLevel: 10, currentStock: 3, qrCode: "ING-BUTTER-003" },
  { name: "Eggs", unit: "dozen", parLevel: 12, currentStock: 6, qrCode: "ING-EGGS-004" },
  { name: "Milk", unit: "L", parLevel: 20, currentStock: 18, qrCode: "ING-MILK-005" },
  { name: "Vanilla Extract", unit: "ml", parLevel: 500, currentStock: 200, qrCode: "ING-VANILLA-006" },
  { name: "Cocoa Powder", unit: "kg", parLevel: 5, currentStock: 2, qrCode: "ING-COCOA-007" },
  { name: "Baking Powder", unit: "kg", parLevel: 3, currentStock: 1.5, qrCode: "ING-BPOWDER-008" },
];

const PRODUCTS = [
  { name: "Sourdough Loaf", sku: "PROD-001", unitsSold: 245, revenue: 3675, cogs: 1225 },
  { name: "Chocolate Croissant", sku: "PROD-002", unitsSold: 189, revenue: 945, cogs: 378 },
  { name: "Blueberry Muffin", sku: "PROD-003", unitsSold: 156, revenue: 780, cogs: 312 },
  { name: "Flat White", sku: "PROD-004", unitsSold: 420, revenue: 2100, cogs: 630 },
  { name: "Banana Bread", sku: "PROD-005", unitsSold: 98, revenue: 686, cogs: 245 },
];

const RULES = [
  { pattern: "pak", categorySlug: "cos" },
  { pattern: "countdown", categorySlug: "cos" },
  { pattern: "bunnings", categorySlug: "equipment-tools" },
  { pattern: "mitre 10", categorySlug: "equipment-tools" },
  { pattern: "officemax", categorySlug: "supplies" },
];

async function main() {
  console.log("Seeding database...");

  await db.stockCount.deleteMany();
  await db.transaction.deleteMany();
  await db.categorisationRule.deleteMany();
  await db.importBatch.deleteMany();
  await db.invoice.deleteMany();
  await db.savingsGoal.deleteMany();
  await db.product.deleteMany();
  await db.ingredient.deleteMany();
  await db.category.deleteMany();
  await db.businessMember.deleteMany();
  await db.business.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const owner = await db.user.create({
    data: {
      email: "owner@demo.co.nz",
      name: "Demo Owner",
      passwordHash,
    },
  });

  const accountant = await db.user.create({
    data: {
      email: "accountant@demo.co.nz",
      name: "Demo Accountant",
      passwordHash,
    },
  });

  const business = await db.business.create({
    data: {
      name: "Kiwi Bakery Ltd",
      gstNumber: "123-456-789",
      balanceDate: "03-31",
      gstFilingFrequency: "two_monthly",
      financialYearStart: "04-01",
    },
  });

  await db.businessMember.createMany({
    data: [
      { userId: owner.id, businessId: business.id, role: "owner" },
      { userId: accountant.id, businessId: business.id, role: "accountant" },
    ],
  });

  const categories: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const created = await db.category.create({
      data: { businessId: business.id, ...cat },
    });
    categories[cat.slug] = created.id;
  }

  for (const rule of RULES) {
    await db.categorisationRule.create({
      data: {
        businessId: business.id,
        pattern: rule.pattern,
        categoryId: categories[rule.categorySlug],
        ruleType: "vendor",
      },
    });
  }

  for (const ing of INGREDIENTS) {
    await db.ingredient.create({
      data: { businessId: business.id, ...ing },
    });
  }

  for (const prod of PRODUCTS) {
    await db.product.create({
      data: { businessId: business.id, ...prod },
    });
  }

  const paymentModes = ["Cash", "EFTPOS", "Credit Card", "Bank Transfer", "Online"];

  for (let i = 0; i < 30; i++) {
    const vendor = VENDORS[i % VENDORS.length];
    const daysAgo = Math.floor(Math.random() * 120);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const unitAmount = Math.round((Math.random() * 200 + 10) * 100) / 100;
    const quantity = Math.floor(Math.random() * 5) + 1;
    const totalAmount = Math.round(unitAmount * quantity * 100) / 100;
    const gst = calculateGstFromInc(totalAmount);

    const rule = RULES.find((r) => vendor.toLowerCase().includes(r.pattern));
    const categoryId = rule ? categories[rule.categorySlug] : categories["cos"];

    await db.transaction.create({
      data: {
        businessId: business.id,
        categoryId,
        date,
        vendor,
        unitAmount,
        quantity,
        totalAmount,
        paymentMode: paymentModes[i % paymentModes.length],
        amountExGst: gst.amountExGst,
        gstAmount: gst.gstAmount,
        amountIncGst: gst.amountIncGst,
        gstType: "standard_15",
        type: "expense",
        source: i < 5 ? "import" : "manual",
      },
    });
  }

  await db.savingsGoal.createMany({
    data: [
      {
        businessId: business.id,
        name: "New Commercial Oven",
        targetAmount: 15000,
        currentAmount: 8500,
        deadline: new Date("2026-06-30"),
      },
      {
        businessId: business.id,
        name: "Emergency Fund",
        targetAmount: 10000,
        currentAmount: 4200,
        deadline: new Date("2026-03-31"),
      },
    ],
  });

  const mockInvoices = [
    {
      externalId: "gmail-msg-001",
      subject: "Invoice #INV-2025-001 from Pak'nSave",
      fromEmail: "invoices@paknsave.co.nz",
      receivedAt: new Date("2025-07-15T09:30:00Z"),
      amount: 342.5,
      vendor: "Pak'nSave",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-002",
      subject: "Your Countdown receipt - Order #CD789012",
      fromEmail: "receipts@countdown.co.nz",
      receivedAt: new Date("2025-07-22T14:15:00Z"),
      amount: 128.9,
      vendor: "Countdown",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-003",
      subject: "Invoice from OfficeMax NZ",
      fromEmail: "billing@officemax.co.nz",
      receivedAt: new Date("2025-08-01T11:00:00Z"),
      amount: 89.99,
      vendor: "OfficeMax",
      status: "matched",
    },
    {
      externalId: "gmail-msg-004",
      subject: "Spark Business - Monthly Statement",
      fromEmail: "billing@spark.co.nz",
      receivedAt: new Date("2025-08-03T08:45:00Z"),
      amount: 156.0,
      vendor: "Spark",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-005",
      subject: "Trade Me Seller Invoice #TM445566",
      fromEmail: "noreply@trademe.co.nz",
      receivedAt: new Date("2025-08-04T16:20:00Z"),
      amount: 245.0,
      vendor: "Trade Me Seller",
      status: "unmatched",
    },
  ];

  for (const inv of mockInvoices) {
    await db.invoice.create({
      data: { businessId: business.id, ...inv },
    });
  }

  console.log("Seed complete!");
  console.log("  Business:", business.name);
  console.log("  Owner: owner@demo.co.nz / demo1234");
  console.log("  Accountant: accountant@demo.co.nz / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
