import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { syncFromPos } from "../src/lib/pos/sync";

async function main() {
  if (!process.env.POS_API_URL && !process.env.POS_DATABASE_URL) {
    console.error("Set POS_API_URL or POS_DATABASE_URL first");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    console.error("DATABASE_URL must be a postgres URL");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const business = await db.business.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!business) {
      console.error("No business found");
      process.exit(1);
    }

    console.log(`Syncing POS into business ${business.name} (${business.id})…`);
    console.log(`Transport: ${process.env.POS_API_URL ? "api" : "database"}`);

    const result = await syncFromPos(business.id);
    if (!result.ok) {
      console.error("Sync failed:", result.error);
      process.exit(1);
    }

    console.log(
      `Done — ${result.productsSync} products, ${result.salesSync} new sales`
    );
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
