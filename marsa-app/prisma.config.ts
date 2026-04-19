import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // @ts-expect-error — directUrl is supported at runtime by Prisma 7
    // but not yet in the published type definition for defineConfig.
    directUrl: process.env["DIRECT_URL"],
  },
});
