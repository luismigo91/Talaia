import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { sourceStatus } from "./db/schema.js";

export interface RunResult {
  recordsWritten: number;
  payloadHash?: string;
}

/** Ejecuta un collector con aislamiento: nunca lanza; registra el resultado en `source_status`. */
export async function runWithStatus(
  db: Db,
  source: string,
  fn: () => Promise<RunResult>,
  opts: { timeoutMs?: number } = {},
): Promise<RunResult | undefined> {
  const now = new Date();
  await db
    .insert(sourceStatus)
    .values({ source, lastRunAt: now })
    .onConflictDoUpdate({ target: sourceStatus.source, set: { lastRunAt: now } });
  try {
    const result = await withTimeout(fn(), opts.timeoutMs ?? 120_000, source);
    await db
      .update(sourceStatus)
      .set({
        lastSuccessAt: new Date(),
        lastError: null,
        recordsWritten: result.recordsWritten,
        ...(result.payloadHash !== undefined ? { payloadHash: result.payloadHash } : {}),
      })
      .where(sql`${sourceStatus.source} = ${source}`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(sourceStatus)
      .set({ lastError: message.slice(0, 2000) })
      .where(sql`${sourceStatus.source} = ${source}`);
    return undefined;
  }
}

export async function getPayloadHash(db: Db, source: string): Promise<string | null> {
  const row = await db.query.sourceStatus.findFirst({
    where: (s, { eq }) => eq(s.source, source),
    columns: { payloadHash: true },
  });
  return row?.payloadHash ?? null;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout de ${ms} ms en ${label}`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
