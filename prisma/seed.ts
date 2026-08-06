import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { calculateGstFromInc } from "../src/lib/gst/nz";

function createSeedClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: url });
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });
}

const db = createSeedClient();

const CATEGORIES = [
  { name: "Supplies", slug: "supplies", type: "expense" },
  { name: "Cost of Goods Sold", slug: "cos", type: "expense" },
  { name: "Non Operating", slug: "non-operating", type: "expense" },
  { name: "Equipment & Tools", slug: "equipment-tools", type: "expense" },
  { name: "Sales Revenue", slug: "sales-revenue", type: "income" },
];

const INGREDIENTS = [
  { name: "Matcha (Thea)", unit: "g", parLevel: 500, currentStock: 180, qrCode: "STLL-MATCHA-001" },
  { name: "Anchor Cream 2L", unit: "L", parLevel: 10, currentStock: 6, qrCode: "STLL-CREAM-002" },
  { name: "Otis Oat Milk", unit: "L", parLevel: 20, currentStock: 12, qrCode: "STLL-OAT-003" },
  { name: "Ube Extract", unit: "kg", parLevel: 3, currentStock: 1.5, qrCode: "STLL-UBE-004" },
  { name: "Condensed Milk", unit: "can", parLevel: 24, currentStock: 8, qrCode: "STLL-COND-005" },
  { name: "Coconut Water", unit: "L", parLevel: 12, currentStock: 4, qrCode: "STLL-COCO-006" },
  { name: "Coffee Beans", unit: "kg", parLevel: 5, currentStock: 2, qrCode: "STLL-BEANS-007" },
  { name: "Clear Cups 500ml", unit: "pk", parLevel: 10, currentStock: 3, qrCode: "STLL-CUPS-008" },
  { name: "Biscoff Spread", unit: "kg", parLevel: 2, currentStock: 0.8, qrCode: "STLL-BISC-009" },
  { name: "Frozen Strawberries", unit: "kg", parLevel: 5, currentStock: 2, qrCode: "STLL-STRAW-010" },
];

const PRODUCTS = [
  { name: "Matcha Latte", sku: "DRINK-001", unitsSold: 320, revenue: 2560, cogs: 890 },
  { name: "Ube Latte", sku: "DRINK-002", unitsSold: 245, revenue: 1960, cogs: 720 },
  { name: "Flat White", sku: "DRINK-003", unitsSold: 420, revenue: 2100, cogs: 630 },
  { name: "Cold Brew", sku: "DRINK-004", unitsSold: 189, revenue: 1323, cogs: 380 },
  { name: "Biscoff Latte", sku: "DRINK-005", unitsSold: 156, revenue: 1248, cogs: 410 },
];

const RULES = [
  { pattern: "anchor", categorySlug: "cos" },
  { pattern: "otis", categorySlug: "cos" },
  { pattern: "matcha", categorySlug: "cos" },
  { pattern: "cup", categorySlug: "supplies" },
  { pattern: "breville", categorySlug: "equipment-tools" },
  { pattern: "registration", categorySlug: "non-operating" },
];

async function main() {
  console.log("Seeding database...");

  await db.stockCount.deleteMany();
  await db.saleLine.deleteMany();
  await db.sale.deleteMany();
  await db.posSyncLog.deleteMany();
  await db.transaction.deleteMany();
  await db.categorisationRule.deleteMany();
  await db.importBatch.deleteMany();
  await db.invoice.deleteMany();
  await db.savingsGoal.deleteMany();
  await db.businessInvite.deleteMany();
  await db.product.deleteMany();
  await db.ingredient.deleteMany();
  await db.category.deleteMany();
  await db.businessMember.deleteMany();
  await db.business.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const owner = await db.user.create({
    data: {
      email: "owner@stllhaus.co.nz",
      name: "STLL HAUS Owner",
      passwordHash,
    },
  });

  const accountant = await db.user.create({
    data: {
      email: "accountant@stllhaus.co.nz",
      name: "STLL HAUS Accountant",
      passwordHash,
    },
  });

  const business = await db.business.create({
    data: {
      name: "STLL HAUS",
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

  const samplePurchases = [
    { vendor: "Pak'nSave", amount: 45.5, category: "cos", daysAgo: 5 },
    { vendor: "Bidfood — Cups 500ml", amount: 32.37, category: "supplies", daysAgo: 12 },
    { vendor: "Matcha (Thea)", amount: 120, category: "cos", daysAgo: 20 },
    { vendor: "Breville Barista Express", amount: 629, category: "equipment-tools", daysAgo: 45 },
    { vendor: "Food business Registration", amount: 366, category: "non-operating", daysAgo: 60 },
  ];

  for (let i = 0; i < 25; i++) {
    const sample = samplePurchases[i % samplePurchases.length];
    const date = new Date();
    date.setDate(date.getDate() - sample.daysAgo - i);

    const unitAmount = sample.amount;
    const quantity = 1;
    const totalAmount = unitAmount;
    const gst = calculateGstFromInc(totalAmount);

    await db.transaction.create({
      data: {
        businessId: business.id,
        categoryId: categories[sample.category],
        date,
        vendor: sample.vendor,
        unitAmount,
        quantity,
        totalAmount,
        paymentMode: i % 2 === 0 ? "Card" : "Cash",
        amountExGst: gst.amountExGst,
        gstAmount: gst.gstAmount,
        amountIncGst: gst.amountIncGst,
        gstType: "standard_15",
        type: "expense",
        source: i < 5 ? "import" : "manual",
      },
    });
  }

  const totalRevenue = PRODUCTS.reduce((s, p) => s + p.revenue, 0);
  const totalExpenses = 25 * 120;
  const surplus = totalRevenue - totalExpenses;

  await db.savingsGoal.createMany({
    data: [
      {
        businessId: business.id,
        name: "STLL HAUS — Equipment Fund",
        targetAmount: 15000,
        currentAmount: Math.min(surplus * 0.6, 15000),
        deadline: new Date("2026-06-30"),
      },
      {
        businessId: business.id,
        name: "STLL HAUS — Emergency Reserve",
        targetAmount: 10000,
        currentAmount: Math.min(surplus * 0.4, 10000),
        deadline: new Date("2026-03-31"),
      },
    ],
  });

  const mockInvoices = [
    {
      externalId: "gmail-msg-001",
      subject: "Invoice #INV-2026-001 from Bidfood",
      fromEmail: "invoices@bidfood.co.nz",
      receivedAt: new Date("2026-02-15T09:30:00Z"),
      amount: 342.5,
      vendor: "Bidfood",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-002",
      subject: "Your Pak'nSave receipt",
      fromEmail: "receipts@paknsave.co.nz",
      receivedAt: new Date("2026-02-22T14:15:00Z"),
      amount: 128.9,
      vendor: "Pak'nSave",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-003",
      subject: "Invoice from Huhtamaki NZ",
      fromEmail: "billing@huhtamaki.com",
      receivedAt: new Date("2026-03-01T11:00:00Z"),
      amount: 89.99,
      vendor: "Huhtamaki",
      status: "matched",
    },
    {
      externalId: "gmail-msg-004",
      subject: "Thea Matcha — Wholesale Invoice",
      fromEmail: "orders@theamatcha.co.nz",
      receivedAt: new Date("2026-03-03T08:45:00Z"),
      amount: 480.0,
      vendor: "Thea Matcha",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-005",
      subject: "Milklab — Direct Debit Statement",
      fromEmail: "billing@milklab.com",
      receivedAt: new Date("2026-03-04T16:20:00Z"),
      amount: 156.0,
      vendor: "Milklab",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-006",
      subject: "Countdown Business — Monthly Statement",
      fromEmail: "business@countdown.co.nz",
      receivedAt: new Date("2026-03-10T10:00:00Z"),
      amount: 245.0,
      vendor: "Countdown",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-007",
      subject: "Biopak — Tax Invoice #BP8821",
      fromEmail: "accounts@biopak.com",
      receivedAt: new Date("2026-03-12T13:30:00Z"),
      amount: 67.5,
      vendor: "Biopak",
      status: "unmatched",
    },
    {
      externalId: "gmail-msg-008",
      subject: "Spark Business — Monthly Bill",
      fromEmail: "billing@spark.co.nz",
      receivedAt: new Date("2026-03-15T08:00:00Z"),
      amount: 89.0,
      vendor: "Spark",
      status: "unmatched",
    },
  ];

  for (const inv of mockInvoices) {
    await db.invoice.create({
      data: { businessId: business.id, ...inv },
    });
  }

  console.log("Seed complete!");
  console.log("  Business: STLL HAUS");
  console.log("  Owner: owner@stllhaus.co.nz / demo1234");
  console.log("  Accountant: accountant@stllhaus.co.nz / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
