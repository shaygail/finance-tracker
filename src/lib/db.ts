import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaClientKey?: string;
};

/** Bump when models are added so HMR drops a stale client. */
const CLIENT_KEY = "prisma-with-cash-out-notes-v1";

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({
    url: url || "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    (globalForPrisma.prismaClientKey !== CLIENT_KEY ||
      typeof (globalForPrisma.prisma as { cashOutNote?: unknown })
        .cashOutNote === "undefined")
  ) {
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaClientKey = CLIENT_KEY;
  }

  return globalForPrisma.prisma;
}

/**
 * Lazy Prisma accessor — avoids opening a DB connection during `next build`
 * module evaluation, and survives HMR when new models are added.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    if (typeof prop === "symbol") {
      return Reflect.get(getClient(), prop);
    }
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
