/**
 * Shared database client for scripts (PostgreSQL / Supabase).
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createScriptPrisma(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  const adapter = new PrismaPg({ connectionString: dbUrl });
  return new PrismaClient({ adapter });
}
