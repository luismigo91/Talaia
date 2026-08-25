import {
  latestObservationTs,
  loadSensors,
  logger,
  runWithStatus,
  upsertObservations,
  type Db,
  type ObservationRow,
  type SensorSpec,
} from "@talaia/shared";
import { SaihClient } from "./client.js";
import { derivePrecipHourly, toObservations, SOURCE } from "./parse.js";

export { SOURCE };

/** Solape hacia atrás: las muestras provisionales (estado 128) se corrigen a posteriori. */
export const OVERLAP_MS = 15 * 60_000;
/** Ventana mínima para molestar al portal. */
const MIN_WINDOW_MS = 5 * 60_000;

export interface RunOptions {
  client?: SaihClient;
  now?: () => Date;
  /** Horas hacia atrás la primera vez que se ve un sensor. */
  backfillHours?: number;
}

export function backfillHours(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.SAIH_BACKFILL_HOURS ?? 24);
  const h = Number.isFinite(raw) && raw > 0 ? raw : 24;
  return Math.min(h, 168);
}

/** Ejecución completa: nunca lanza; registra en source_status. */
export async function run(db: Db, opts: RunOptions = {}) {
  return runWithStatus(db, SOURCE, () => collect(db, opts), { timeoutMs: 300_000 });
}

export async function collect(db: Db, opts: RunOptions = {}) {
  const client = opts.client ?? new SaihClient();
  const now = (opts.now ?? (() => new Date()))();
  const back = opts.backfillHours ?? backfillHours();

  const sensors = await loadSensors(db, SOURCE);
  if (sensors.length === 0) throw new Error("catálogo SAIH vacío: no hay sensores sembrados");
  const latest = await latestObservationTs(db, SOURCE);

  const rows: ObservationRow[] = [];
  const problems: string[] = [];
  let attempted = 0;

  for (const sensor of sensors) {
    const from = windowStart(sensor, latest, now, back);
    if (now.getTime() - from.getTime() < MIN_WINDOW_MS) continue;
    attempted++;
    try {
      const samples = await client.values(sensor.externalId, from, now);
      if (samples.length === 0 && now.getTime() - from.getTime() > 3_600_000) {
        // Un rango mal formateado devuelve [] sin error HTTP: no lo damos por bueno.
        problems.push(`${sensor.externalId} (sin muestras en ${hours(now, from)} h)`);
        continue;
      }
      const observations = toObservations(samples, sensor);
      rows.push(...observations);
      if (sensor.variable === "precip_rate_mmh") {
        rows.push(...derivePrecipHourly(observations, sensor, now));
      }
    } catch (err) {
      problems.push(`${sensor.externalId} (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  if (attempted > 0 && problems.length === attempted) {
    throw new Error(`ningún sensor respondió: ${problems.slice(0, 5).join("; ")}`);
  }
  const written = await upsertObservations(db, rows);
  logger.info(
    { rows: written, sensores: attempted, fallos: problems.length },
    "saih: observaciones escritas",
  );
  return {
    recordsWritten: written,
    ...(problems.length > 0
      ? { warning: `${problems.length}/${attempted} sensores sin datos: ${problems.join("; ")}` }
      : {}),
  };
}

/** Inicio de la ventana: último dato menos el solape, o el backfill si es la primera vez. */
export function windowStart(
  sensor: SensorSpec,
  latest: Map<string, Date>,
  now: Date,
  backfillH: number,
): Date {
  const last = latest.get(`${sensor.stationId}|${sensor.variable}`);
  const floor = new Date(now.getTime() - backfillH * 3_600_000);
  if (!last) return floor;
  const from = new Date(last.getTime() - OVERLAP_MS);
  return from < floor ? floor : from;
}

const hours = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 3_600_000);
