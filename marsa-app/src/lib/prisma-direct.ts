/**
 * Direct-connection Prisma client for transactional operations.
 *
 * The main `prisma` singleton in `./prisma.ts` connects through the
 * Supabase pgbouncer pooler (port 6543) which is ideal for high-
 * concurrency read/write but historically unreliable for interactive
 * `$transaction(async (tx) => { ... })` callbacks.
 *
 * This client connects directly to the database (port 5432, no
 * pgbouncer) via the DIRECT_URL env var, so interactive transactions
 * are fully supported. Use it **only** for composite operations that
 * need atomicity — all regular queries should continue using the
 * pooled `prisma` singleton.
 *
 * Usage:
 *   import { prismaDirect } from "@/lib/prisma-direct";
 *
 *   await prismaDirect.$transaction(async (tx) => {
 *     await tx.project.create({ ... });
 *     await tx.service.create({ ... });
 *   });
 */
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrismaDirect = globalThis as unknown as {
  prismaDirectInstance: PrismaClient | undefined;
};

function createPrismaDirectClient(): PrismaClient {
  const directUrl = process.env.DIRECT_URL;

  if (!directUrl) {
    throw new Error(
      "DIRECT_URL is not set. It is required for transactional operations. " +
        "Add it to your .env file with port 5432 (no pgbouncer)."
    );
  }

  const adapter = new PrismaPg({ connectionString: directUrl });
  return new PrismaClient({ adapter });
}

export const prismaDirect =
  globalForPrismaDirect.prismaDirectInstance ?? createPrismaDirectClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaDirect.prismaDirectInstance = prismaDirect;
}
