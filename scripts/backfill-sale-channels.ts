import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { classifySaleChannel } from "../src/lib/sales/channels";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const url = (process.env.POS_API_URL || "").replace(/\/$/, "");
  if (!url) throw new Error("POS_API_URL is required");

  const rows = (await fetch(`${url}/sales`).then((r) => r.json())) as Array<{
    id: string | number;
    payment_method?: string | null;
    description?: string | null;
  }>;
  const byPos = new Map(rows.map((r) => [String(r.id), r]));

  const sales = await db.sale.findMany({
    select: { id: true, posSaleId: true, paymentMode: true, channel: true },
  });

  let updated = 0;
  for (const s of sales) {
    const pos = byPos.get(s.posSaleId);
    const channel = classifySaleChannel(
      pos?.payment_method ?? s.paymentMode,
      pos?.description ?? null
    );
    if (channel !== s.channel) {
      await db.sale.update({ where: { id: s.id }, data: { channel } });
      updated++;
    }
  }

  const grouped = await db.sale.groupBy({
    by: ["channel"],
    _count: true,
    _sum: { totalAmount: true },
  });
  console.log(JSON.stringify({ updated, grouped }, null, 2));

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
