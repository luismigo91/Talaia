import type { ObservationRow, SensorSpec } from "@talaia/shared";
import type { SaihSample } from "./client.js";

export const SOURCE = "saih";

/** Muestras crudas → filas del esquema común. Se omiten valores nulos o no numéricos. */
export function toObservations(samples: SaihSample[], sensor: SensorSpec): ObservationRow[] {
  const rows: ObservationRow[] = [];
  for (const s of samples) {
    if (typeof s.valor !== "number" || !Number.isFinite(s.valor)) continue;
    const ts = new Date(s.fecha);
    if (Number.isNaN(ts.getTime())) continue;
    rows.push({
      source: SOURCE,
      stationId: sensor.stationId,
      variable: sensor.variable,
      ts,
      value: s.valor,
      unit: sensor.unit,
      quality: typeof s.estado === "number" ? s.estado : null,
    });
  }
  return rows;
}

/** Muestras esperadas en una hora de registro cincominutal. */
export const SAMPLES_PER_HOUR = 12;
/** Mínimo de muestras para dar una hora por buena. */
export const MIN_SAMPLES_PER_HOUR = 10;

/**
 * Precipitación horaria derivada de la intensidad cincominutal (mm/h):
 * `precip_mm(H) = Σ(v_i · 5/60)` sobre las muestras de la hora H.
 *
 * Solo horas completas y con al menos `MIN_SAMPLES_PER_HOUR` muestras: la hora en curso
 * daría un acumulado falsamente bajo. `ts` = inicio de la hora, igual que en Open-Meteo.
 */
export function derivePrecipHourly(
  rows: ObservationRow[],
  sensor: SensorSpec,
  now: Date,
): ObservationRow[] {
  const buckets = new Map<number, { sum: number; n: number; quality: number }>();
  for (const r of rows) {
    if (typeof r.value !== "number") continue;
    const hour = Math.floor(r.ts.getTime() / 3_600_000) * 3_600_000;
    const b = buckets.get(hour) ?? { sum: 0, n: 0, quality: 0 };
    b.sum += r.value;
    b.n += 1;
    b.quality = Math.max(b.quality, r.quality ?? 0);
    buckets.set(hour, b);
  }
  const currentHour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  const out: ObservationRow[] = [];
  for (const [hour, b] of [...buckets.entries()].sort((a, c) => a[0] - c[0])) {
    if (hour >= currentHour) continue;
    if (b.n < MIN_SAMPLES_PER_HOUR) continue;
    out.push({
      source: SOURCE,
      stationId: sensor.stationId,
      variable: "precip_mm",
      ts: new Date(hour),
      value: round(b.sum * (5 / 60)),
      unit: "mm",
      quality: b.quality,
    });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
