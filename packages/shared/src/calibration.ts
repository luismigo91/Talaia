import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";

export interface SensorStats {
  sensorId: string;
  stationName: string;
  variable: string;
  unit: string;
  thresholds: { low: number | null; mid: number | null; high: number | null };
  samples: number;
  from: string | null;
  to: string | null;
  median: number | null;
  p90: number | null;
  p99: number | null;
  p999: number | null;
  max: number | null;
  /** Horas (no muestras) por encima de cada umbral. */
  hoursAbove: { low: number; mid: number; high: number };
  /** Episodios: rachas separadas por al menos 6 h por debajo del umbral bajo. */
  episodes: { start: string; end: string; peak: number; level: string }[];
}

/**
 * Estadísticas de un sensor sobre su histórico, para juzgar si sus umbrales sirven aquí.
 *
 * Un umbral no es bueno porque sea oficial, sino porque separa lo normal de lo excepcional en
 * *este* punto: si el caudal supera el amarillo trescientas horas al año, ese amarillo no avisa
 * de nada; si no lo supera nunca, tampoco.
 */
export async function sensorStats(
  db: Db,
  sensorId: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<SensorStats | null> {
  const [sensor] = await db.execute<{
    id: string;
    source: string;
    station_id: string;
    station_name: string;
    variable: string;
    unit: string;
    threshold_low: number | string | null;
    threshold_mid: number | string | null;
    threshold_high: number | string | null;
  }>(sql`
    select s.id, s.source, s.station_id, st.name as station_name, s.variable, s.unit,
           s.threshold_low, s.threshold_mid, s.threshold_high
    from sensors s join stations st on st.id = s.station_id
    where s.id = ${sensorId}
  `);
  if (!sensor) return null;

  const from = opts.from ?? new Date(0);
  const to = opts.to ?? new Date();
  const low = num(sensor.threshold_low);
  const mid = num(sensor.threshold_mid);
  const high = num(sensor.threshold_high);

  const [agg] = await db.execute<{
    n: number;
    first: string | null;
    last: string | null;
    p50: number | null;
    p90: number | null;
    p99: number | null;
    p999: number | null;
    max: number | null;
    above_low: number;
    above_mid: number;
    above_high: number;
  }>(sql`
    select count(*)::int n,
           min(ts) as first, max(ts) as last,
           percentile_cont(0.50) within group (order by value) as p50,
           percentile_cont(0.90) within group (order by value) as p90,
           percentile_cont(0.99) within group (order by value) as p99,
           percentile_cont(0.999) within group (order by value) as p999,
           max(value) as max,
           count(*) filter (where value >= ${low ?? sql`null`})::int as above_low,
           count(*) filter (where value >= ${mid ?? sql`null`})::int as above_mid,
           count(*) filter (where value >= ${high ?? sql`null`})::int as above_high
    from observations
    where source = ${sensor.source} and station_id = ${sensor.station_id}
      and variable = ${sensor.variable}
      and ts >= ${from.toISOString()}::timestamptz and ts <= ${to.toISOString()}::timestamptz
      and value is not null
  `);

  // Las muestras son cincominutales: 12 por hora.
  const hours = (samples: number) => Math.round((samples / 12) * 10) / 10;

  const episodes =
    low === null
      ? []
      : await db.execute<{ start: string; end: string; peak: number }>(sql`
          with sobre as (
            select ts, value,
                   ts - (row_number() over (order by ts)) * interval '5 minutes' as grupo
            from observations
            where source = ${sensor.source} and station_id = ${sensor.station_id}
              and variable = ${sensor.variable} and value >= ${low}
              and ts >= ${from.toISOString()}::timestamptz
              and ts <= ${to.toISOString()}::timestamptz
          )
          select min(ts) as start, max(ts) as end, max(value) as peak
          from sobre group by grupo
          having count(*) >= 3
          order by peak desc limit 10
        `);

  return {
    sensorId: sensor.id,
    stationName: sensor.station_name,
    variable: sensor.variable,
    unit: sensor.unit,
    thresholds: { low, mid, high },
    samples: Number(agg?.n ?? 0),
    from: agg?.first ? new Date(agg.first).toISOString() : null,
    to: agg?.last ? new Date(agg.last).toISOString() : null,
    median: num(agg?.p50 ?? null),
    p90: num(agg?.p90 ?? null),
    p99: num(agg?.p99 ?? null),
    p999: num(agg?.p999 ?? null),
    max: num(agg?.max ?? null),
    hoursAbove: {
      low: hours(Number(agg?.above_low ?? 0)),
      mid: hours(Number(agg?.above_mid ?? 0)),
      high: hours(Number(agg?.above_high ?? 0)),
    },
    episodes: episodes.map((e) => ({
      start: new Date(e.start).toISOString(),
      end: new Date(e.end).toISOString(),
      peak: Number(e.peak),
      level: levelOf(Number(e.peak), low, mid, high),
    })),
  };
}

function levelOf(v: number, low: number | null, mid: number | null, high: number | null): string {
  if (high !== null && v >= high) return "rojo";
  if (mid !== null && v >= mid) return "naranja";
  if (low !== null && v >= low) return "amarillo";
  return "verde";
}

/**
 * Veredicto legible sobre si el umbral separa lo normal de lo excepcional. Es una guía para
 * quien decide, no una recomendación automática: aquí no se cambian umbrales solos.
 */
export function verdict(stats: SensorStats): string {
  const { hoursAbove, thresholds, samples } = stats;
  if (samples === 0) return "sin datos suficientes";
  if (thresholds.low === null) return "sensor sin umbrales: solo contexto";
  const dias = samples / 12 / 24;
  const porAno = (h: number) => (h / dias) * 365;
  const amarilloAno = porAno(hoursAbove.low);
  if (amarilloAno === 0) {
    return "el umbral amarillo no se ha alcanzado nunca en el periodo: no sabemos si avisa";
  }
  if (amarilloAno > 200) {
    return `el amarillo se supera ~${Math.round(amarilloAno)} h/año: demasiado frecuente para avisar de algo`;
  }
  return `el amarillo se supera ~${Math.round(amarilloAno)} h/año; parece razonable como umbral de atención`;
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
