import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** True when `DATABASE_URL` is set (support routes return 503 otherwise). */
export function isPrismaConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
