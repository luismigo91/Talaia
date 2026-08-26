import { createDb, logger } from "@talaia/shared";
import { backfill } from "./backfill.js";

/**
 * Descarga histórico del SAIH:
 *   pnpm --filter @talaia/collector-saih backfill 2025-01-01 [2026-01-01] [13873,13070]
 */
const [fromArg, toArg, sensorsArg] = process.argv.slice(2);
if (!fromArg) {
  console.error("uso: backfill <desde AAAA-MM-DD> [hasta AAAA-MM-DD] [idVariable,idVariable]");
  process.exit(1);
}
const from = new Date(`${fromArg}T00:00:00Z`);
const to = toArg ? new Date(`${toArg}T00:00:00Z`) : new Date();
const sensors = sensorsArg
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const { db, close } = createDb();
backfill(db, {
  from,
  to,
  ...(sensors ? { sensors } : {}),
  onProgress: ({ sensor, from: f, rows }) =>
    logger.info({ sensor, desde: f.toISOString().slice(0, 10), rows }, "ventana"),
})
  .then((r) => logger.info({ r: { ...r, problems: r.problems.length } }, "backfill: fin"))
  .catch((err) => logger.error({ err: String(err) }, "backfill: error"))
  .finally(close);
