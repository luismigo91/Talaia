import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";

export interface SensorSpec {
  id: string;
  source: string;
  stationId: string;
  stationName: string;
  externalId: string;
  variable: string;
  unit: string;
  thresholdLow: number | null;
  thresholdMid: number | null;
  thresholdHigh: number | null;
  meta: Record<string, unknown>;
}

/**
 * Catálogo de sensores habilitados de una fuente, con el nombre de su estación.
 *
 * Los sensores **derivados** (`meta.derived_from`, p. ej. la precipitación horaria calculada a
 * partir de la intensidad) no existen en el portal de origen: se excluyen salvo que se pidan,
 * para que un collector no intente descargarlos.
 */
export async function loadSensors(
  db: Db,
  source: string,
  opts: { includeDerived?: boolean } = {},
): Promise<SensorSpec[]> {
  const rows = await db.execute<{
    id: string;
    source: string;
    station_id: string;
    station_name: string;
    external_id: string;
    variable: string;
    unit: string;
    threshold_low: number | string | null;
    threshold_mid: number | string | null;
    threshold_high: number | string | null;
    meta: Record<string, unknown>;
  }>(sql`
    select s.id, s.source, s.station_id, st.name as station_name, s.external_id,
           s.variable, s.unit, s.threshold_low, s.threshold_mid, s.threshold_high, s.meta
    from sensors s
    join stations st on st.id = s.station_id
    where s.source = ${source} and s.enabled
      ${opts.includeDerived ? sql`` : sql`and s.meta->>'derived_from' is null`}
    order by s.station_id, s.variable
  `);
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    stationId: r.station_id,
    stationName: r.station_name,
    externalId: r.external_id,
    variable: r.variable,
    unit: r.unit,
    thresholdLow: num(r.threshold_low),
    thresholdMid: num(r.threshold_mid),
    thresholdHigh: num(r.threshold_high),
    meta: r.meta ?? {},
  }));
}

export type ThresholdLevel = "verde" | "amarillo" | "naranja" | "rojo";

/** Nivel de umbral de un valor. `null` si no hay valor o el sensor no tiene umbrales. */
export function thresholdLevel(
  value: number | null | undefined,
  s: Pick<SensorSpec, "thresholdLow" | "thresholdMid" | "thresholdHigh">,
): ThresholdLevel | null {
  if (value === null || value === undefined) return null;
  if (s.thresholdHigh === null && s.thresholdMid === null && s.thresholdLow === null) return null;
  if (s.thresholdHigh !== null && value >= s.thresholdHigh) return "rojo";
  if (s.thresholdMid !== null && value >= s.thresholdMid) return "naranja";
  if (s.thresholdLow !== null && value >= s.thresholdLow) return "amarillo";
  return "verde";
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
