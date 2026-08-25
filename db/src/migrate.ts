import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, waitForDb, logger } from "@talaia/shared";

/**
 * Migrador mínimo: aplica en orden los ficheros `NNNN_nombre.sql` de ./migrations
 * que no consten en `schema_migrations`. Cada fichero se ejecuta en una transacción.
 * Idempotente: ejecutarlo dos veces no aplica nada la segunda.
 */
export async function migrate(url?: string): Promise<string[]> {
  const { sql, close } = createDb(url, { max: 1 });
  const applied: string[] = [];
  try {
    await waitForDb(sql);
    await sql`create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
    // Lock para que dos instancias no migren a la vez.
    await sql`select pg_advisory_lock(7419)`;
    try {
      const done = new Set(
        (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name),
      );
      const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
      const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
      for (const file of files) {
        if (done.has(file)) continue;
        const body = await readFile(join(dir, file), "utf8");
        await sql.begin(async (tx) => {
          await tx.unsafe(body);
          await tx`insert into schema_migrations (name) values (${file})`;
        });
        applied.push(file);
        logger.info({ file }, "migración aplicada");
      }
    } finally {
      await sql`select pg_advisory_unlock(7419)`;
    }
  } finally {
    await close();
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate()
    .then((a) => {
      logger.info({ applied: a.length }, "migraciones al día");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "error migrando");
      process.exit(1);
    });
}
