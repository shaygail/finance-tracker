import "dotenv/config";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const ACCOUNTS = [
  {
    email: "admin@stllhaus.co",
    name: "STLL HAUS Owner",
    role: "owner" as const,
  },
  {
    email: "accounts@stllhaus.co",
    name: "STLL HAUS Accountant",
    role: "accountant" as const,
  },
];

const DEMO_EMAILS = [
  "owner@stllhaus.co.nz",
  "accountant@stllhaus.co.nz",
];

function makePassword(): string {
  return randomBytes(9).toString("base64url");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    console.error("DATABASE_URL must be a postgres URL");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    let business = await db.business.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!business) {
      business = await db.business.create({
        data: {
          name: "STLL HAUS",
          gstNumber: "123-456-789",
          balanceDate: "03-31",
          gstFilingFrequency: "two_monthly",
          financialYearStart: "04-01",
        },
      });
    }

    // Remove demo seed users
    for (const email of DEMO_EMAILS) {
      const demo = await db.user.findUnique({ where: { email } });
      if (demo) {
        await db.businessMember.deleteMany({ where: { userId: demo.id } });
        await db.stockCount.deleteMany({ where: { countedById: demo.id } });
        await db.user.delete({ where: { id: demo.id } });
        console.log(`Removed demo user ${email}`);
      }
    }

    // Remove demo invoices + non-imported seed expenses
    const inv = await db.invoice.deleteMany({});
    const seedTx = await db.transaction.deleteMany({
      where: { source: { not: "import" } },
    });
    console.log(
      `Cleared demo data: ${inv.count} invoices, ${seedTx.count} non-import transactions`
    );

    console.log("\n=== Login accounts (save these) ===\n");

    for (const account of ACCOUNTS) {
      const password = makePassword();
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await db.user.upsert({
        where: { email: account.email },
        create: {
          email: account.email,
          name: account.name,
          passwordHash,
        },
        update: {
          name: account.name,
          passwordHash,
        },
      });

      await db.businessMember.upsert({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId: business.id,
          },
        },
        create: {
          userId: user.id,
          businessId: business.id,
          role: account.role,
        },
        update: {
          role: account.role,
        },
      });

      console.log(`${account.role.toUpperCase()}`);
      console.log(`  Email:    ${account.email}`);
      console.log(`  Password: ${password}`);
      console.log("");
    }

    console.log("Sign in at /login with these credentials.");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
