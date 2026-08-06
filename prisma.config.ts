import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Vercel/Railway/Neon may expose the connection string under different names.
 * Prefer DATABASE_URL; fall back to common aliases.
 *
 * `prisma generate` (postinstall) must not fail when the URL is missing —
 * Railway/Vercel often run `npm install` before env is fully wired.
 * Migrations / runtime still need a real DATABASE_URL.
 */
const datasourceUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

if (
  !process.env.DATABASE_URL &&
  !process.env.POSTGRES_PRISMA_URL &&
  !process.env.POSTGRES_URL &&
  !process.env.DATABASE_PRIVATE_URL &&
  process.argv.some((a) => a.includes("migrate"))
) {
  throw new Error(
    [
      "DATABASE_URL is missing for Prisma migrate.",
      "Railway: open your web service → Variables → add DATABASE_URL",
      "(or reference the Postgres service variable).",
      "Vercel: Project → Settings → Environment Variables → DATABASE_URL.",
      "Value must be a public postgresql://... URL.",
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
