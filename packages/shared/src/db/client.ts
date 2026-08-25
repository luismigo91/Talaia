import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>["db"];

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  const user = process.env.POSTGRES_USER ?? "talaia";
  const password = process.env.POSTGRES_PASSWORD ?? "";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "talaia";
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

export function createDb(url = databaseUrl(), opts: { max?: number } = {}) {
  const sql = postgres(url, { max: opts.max ?? 5, onnotice: () => {}, fetch_types: false });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

/** Espera activa a que la base de datos acepte conexiones (Dokploy/compose pueden arrancar antes). */
export async function waitForDb(sql: postgres.Sql, timeoutMs = 60_000, intervalMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await sql`select 1`;
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error(`Base de datos no disponible tras ${timeoutMs} ms: ${String(lastError)}`);
}
