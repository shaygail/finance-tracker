import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Vercel/Railway/Neon may expose the connection string under different names.
 * Prefer DATABASE_URL; fall back to common aliases.
 */
const datasourceUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_PRIVATE_URL;

if (!datasourceUrl) {
  throw new Error(
    [
      "DATABASE_URL is missing for Prisma.",
      "In Vercel: Project → Settings → Environment Variables → add DATABASE_URL",
      "Value: your Railway public Postgres URL (postgresql://...)",
      "Enable it for Production (and Preview if needed), then Redeploy.",
    ].join(" ")
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
