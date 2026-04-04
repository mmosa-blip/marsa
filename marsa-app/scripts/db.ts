/**
 * Shared database client for scripts.
 * Uses connection pooling with low limits to avoid hitting Hostinger max_connections_per_hour.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function createScriptPrisma(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  const url = new URL(dbUrl.replace("mysql://", "http://"));
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split("?")[0],
    ...(process.env.DATABASE_SSL === "true" ? { ssl: true } : {}),
    connectionLimit: 2,
    acquireTimeout: 10000,
  });

  return new PrismaClient({ adapter });
}
