import { defineConfig } from "drizzle-kit";

/** Solo para inspección/diff del esquema. Las migraciones se escriben a mano en ./migrations. */
export default defineConfig({
  dialect: "postgresql",
  schema: "../packages/shared/src/db/schema.ts",
  out: "./drizzle-diff",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5432/talaia",
  },
});
