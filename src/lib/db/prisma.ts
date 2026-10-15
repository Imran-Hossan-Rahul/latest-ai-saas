// Singleton Prisma client.
// Prisma 7 requires a driver adapter — we use @prisma/adapter-pg (native pg pool).
// In development, Next.js hot-reload would create a new PrismaClient on every
// module reload, exhausting the DB connection pool. We cache it on `globalThis`
// to reuse the same instance across reloads.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // DATABASE_URL may be undefined at build time (e.g. during static analysis).
  // We guard here so the build doesn't crash — actual DB calls will fail at
  // runtime if the env var is missing, which is the correct behavior.
  const connectionString = process.env.DATABASE_URL ?? "";
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
