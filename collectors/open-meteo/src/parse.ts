import type { ForecastRow } from "@talaia/shared";
import { MODELS, VARIABLE_MAP, sourceId } from "./models.js";
import type { OpenMeteoResponse } from "./client.js";

export interface ParseOptions {
  stationId: string;
  /** forecast_ts por modelo (id de `models`). Los modelos ausentes se omiten. */
  forecastTs: Map<string, Date>;
}

/**
 * Convierte una respuesta multi-modelo en filas del esquema común.
 * - Claves `<var>_<modelo>`; claves ausentes o `null` se omiten.
 * - Variables acumuladas (precipitation): `ts` = time[i] − 1 h (inicio del intervalo).
 */
export function parseForecast(res: OpenMeteoResponse, opts: ParseOptions): ForecastRow[] {
  const hourly = res.hourly;
  if (!hourly) return [];
  const times = (hourly.time as string[] | undefined) ?? [];
  const rows: ForecastRow[] = [];
  const modelIds = MODELS.map((m) => m.id);
  const single = modelIds.length === 1;

  for (const modelId of modelIds) {
    const forecastTs = opts.forecastTs.get(modelId);
    if (!forecastTs) continue;
    const source = sourceId(modelId);
    for (const [omVar, spec] of Object.entries(VARIABLE_MAP)) {
      const key = single ? omVar : `${omVar}_${modelId}`;
      const values = hourly[key] as (number | null)[] | undefined;
      if (!values) continue;
      for (let i = 0; i < times.length; i++) {
        const v = values[i];
        if (v === null || v === undefined || typeof v !== "number") continue;
        const t = parseUtc(times[i]!);
        const ts = spec.accumulated ? new Date(t.getTime() - 3_600_000) : t;
        rows.push({
          source,
          stationId: opts.stationId,
          variable: spec.variable,
          forecastTs,
          ts,
          value: v,
          unit: spec.unit,
        });
      }
    }
  }
  return rows;
}

/** "2026-08-25T03:00" (timezone=UTC) → Date */
export function parseUtc(iso: string): Date {
  return new Date(iso.length === 16 ? `${iso}:00Z` : iso.endsWith("Z") ? iso : `${iso}Z`);
}
