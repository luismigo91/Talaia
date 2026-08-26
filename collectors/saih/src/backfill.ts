import {
  loadSensors,
  logger,
  upsertObservations,
  type Db,
  type ObservationRow,
  type SensorSpec,
} from "@talaia/shared";
import { SaihClient } from "./client.js";
import { derivePrecipHourly, toObservations, SOURCE } from "./parse.js";

/**
 * Ventana por petición. El portal ha devuelto 55 días (15.760 puntos) sin protestar; se pide
 * de 30 en 30 para no tensarlo y para que un fallo cueste poco.
 */
export const WINDOW_DAYS = 30;

export interface BackfillOptions {
  from: Date;
  to?: Date;
  /** `external_id` concretos; por defecto, todos los sensores descargables. */
  sensors?: string[];
  client?: SaihClient;
  onProgress?: (info: { sensor: string; from: Date; to: Date; rows: number }) => void;
}

export interface BackfillResult {
  recordsWritten: number;
  windows: number;
  problems: string[];
}

/**
 * Descarga histórico del SAIH para calibrar umbrales con episodios reales.
 *
 * No es el ciclo normal: aquí interesa el pasado, no la frescura. El portal publica desde
 * ~01-2025 y **no tiene los datos de la DANA del 29-10-2024**, así que ese episodio no se
 * puede usar para calibrar por mucho que sea el que importa.
 */
export async function backfill(db: Db, opts: BackfillOptions): Promise<BackfillResult> {
  const client = opts.client ?? new SaihClient();
  const to = opts.to ?? new Date();
  const all = await loadSensors(db, SOURCE);
  const sensors = opts.sensors ? all.filter((s) => opts.sensors!.includes(s.externalId)) : all;
  if (sensors.length === 0) throw new Error("ningún sensor coincide con la selección");

  let recordsWritten = 0;
  let windows = 0;
  const problems: string[] = [];

  for (const sensor of sensors) {
    for (const [wFrom, wTo] of windowsBetween(opts.from, to)) {
      windows++;
      try {
        const samples = await client.values(sensor.externalId, wFrom, wTo);
        const rows: ObservationRow[] = toObservations(samples, sensor);
        if (sensor.variable === "precip_rate_mmh") {
          rows.push(...derivePrecipHourly(rows, sensor, wTo));
        }
        recordsWritten += await upsertObservations(db, rows);
        opts.onProgress?.({ sensor: sensor.externalId, from: wFrom, to: wTo, rows: rows.length });
      } catch (err) {
        problems.push(
          `${sensor.externalId} ${wFrom.toISOString().slice(0, 10)} (${
            err instanceof Error ? err.message : String(err)
          })`,
        );
      }
    }
    logger.info({ sensor: sensor.externalId, recordsWritten }, "saih: histórico descargado");
  }
  return { recordsWritten, windows, problems };
}

/** Trocea [from, to] en ventanas de `WINDOW_DAYS`. */
export function windowsBetween(from: Date, to: Date, days = WINDOW_DAYS): [Date, Date][] {
  const out: [Date, Date][] = [];
  const step = days * 86_400_000;
  for (let t = from.getTime(); t < to.getTime(); t += step) {
    out.push([new Date(t), new Date(Math.min(t + step, to.getTime()))]);
  }
  return out;
}

export type { SensorSpec };
