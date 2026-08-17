import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";

  // PostgreSQL (Railway / production / local Docker)
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // SQLite fallback for local demo without Railway
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({
    url: url || "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

/** Lazy so `next build` can import this module without opening a DB connection. */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = globalForPrisma.prisma ?? createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
