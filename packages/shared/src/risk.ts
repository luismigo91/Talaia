import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import type { ThresholdLevel } from "./sensors.js";

export const RISK_LEVELS = ["verde", "amarillo", "naranja", "rojo"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Nivel más alto de una lista; `verde` si no hay ninguno. */
export function worstLevel(levels: (RiskLevel | ThresholdLevel | null | undefined)[]): RiskLevel {
  let worst = 0;
  for (const l of levels) {
    if (!l) continue;
    const i = RISK_LEVELS.indexOf(l as RiskLevel);
    if (i > worst) worst = i;
  }
  return RISK_LEVELS[worst]!;
}

export interface WatchPointSpec {
  stationId: string;
  sensorId: string;
  role: "flow_primary" | "flow_secondary" | "reservoir" | "rain_upstream" | "rain_local";
  lagMinutes: number | null;
  note: string | null;
  /** Datos del sensor vigilado, ya resueltos. */
  sensorStationId: string;
  sensorStationName: string;
  /** `gauge`, `reservoir`, `rain_gauge`… Marca la cadencia esperada del sensor. */
  sensorStationKind: string;
  variable: string;
  unit: string;
  thresholdLow: number | null;
  thresholdMid: number | null;
  thresholdHigh: number | null;
}

/** Puntos de vigilancia con su sensor resuelto, opcionalmente de una sola localización. */
export async function loadWatchPoints(db: Db, stationId?: string): Promise<WatchPointSpec[]> {
  const rows = await db.execute<{
    station_id: string;
    sensor_id: string;
    role: WatchPointSpec["role"];
    lag_minutes: number | null;
    note: string | null;
    sensor_station_id: string;
    sensor_station_name: string;
    sensor_station_kind: string;
    variable: string;
    unit: string;
    threshold_low: number | string | null;
    threshold_mid: number | string | null;
    threshold_high: number | string | null;
  }>(sql`
    select w.station_id, w.sensor_id, w.role, w.lag_minutes, w.note,
           s.station_id as sensor_station_id, st.name as sensor_station_name, st.kind as sensor_station_kind,
           s.variable, s.unit, s.threshold_low, s.threshold_mid, s.threshold_high
    from watch_points w
    join sensors s on s.id = w.sensor_id
    join stations st on st.id = s.station_id
    where s.enabled ${stationId ? sql`and w.station_id = ${stationId}` : sql``}
    order by w.station_id, w.role, s.station_id
  `);
  return rows.map((r) => ({
    stationId: r.station_id,
    sensorId: r.sensor_id,
    role: r.role,
    lagMinutes: r.lag_minutes,
    note: r.note,
    sensorStationId: r.sensor_station_id,
    sensorStationName: r.sensor_station_name,
    sensorStationKind: r.sensor_station_kind,
    variable: r.variable,
    unit: r.unit,
    thresholdLow: num(r.threshold_low),
    thresholdMid: num(r.threshold_mid),
    thresholdHigh: num(r.threshold_high),
  }));
}

export interface ThresholdSpec {
  signal: string;
  stationId: string | null;
  yellow: number | null;
  orange: number | null;
  red: number | null;
  meta: Record<string, unknown>;
}

/**
 * Umbrales por señal para una localización: la regla propia de la estación gana
 * a la global (`station_id is null`).
 */
export async function loadThresholds(
  db: Db,
  stationId: string,
): Promise<Map<string, ThresholdSpec>> {
  const rows = await db.execute<{
    signal: string;
    station_id: string | null;
    level_yellow: number | string | null;
    level_orange: number | string | null;
    level_red: number | string | null;
    meta: Record<string, unknown>;
  }>(sql`
    select distinct on (signal) signal, station_id, level_yellow, level_orange, level_red, meta
    from thresholds
    where enabled and (station_id is null or station_id = ${stationId})
    order by signal, station_id nulls last
  `);
  return new Map(
    rows.map((r) => [
      r.signal,
      {
        signal: r.signal,
        stationId: r.station_id,
        yellow: num(r.level_yellow),
        orange: num(r.level_orange),
        red: num(r.level_red),
        meta: r.meta ?? {},
      },
    ]),
  );
}

/** Nivel de un valor contra un umbral de tres escalones. */
export function levelFor(value: number | null, t: ThresholdSpec | undefined): RiskLevel | null {
  if (value === null || !t) return null;
  if (t.red === null && t.orange === null && t.yellow === null) return null;
  if (t.red !== null && value >= t.red) return "rojo";
  if (t.orange !== null && value >= t.orange) return "naranja";
  if (t.yellow !== null && value >= t.yellow) return "amarillo";
  return "verde";
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
