import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { addHours, loadVirtualStations, truncToHour, VARIABLES, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

type Row = {
  source: string;
  name: string | null;
  forecast_ts: string | Date;
  ts: string | Date;
  value: number;
  unit: string;
};

export interface RunSeries {
  source: string;
  name: string;
  runs: { forecast_ts: string; total: number; hours_covered: number }[];
  /** Diferencia entre la última corrida y la primera del periodo, en mm. */
  delta: number | null;
}

type RunRow = {
  source: string;
  name: string | null;
  forecast_ts: string | Date;
  total: number | string;
  hours_covered: number | string;
};

export interface CompareSeries {
  source: string;
  name: string;
  forecast_ts: string;
  total: number | null;
  max_hourly: number | null;
  points: { ts: string; value: number }[];
}

@Injectable()
export class CompareService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Una serie por fuente para la ventana [ahora truncado a la hora, +hours), usando la
   * última `forecast_ts` de cada fuente con datos en la ventana. Totales calculados aquí.
   */
  async compare(opts: { variable: string; station?: string; hours: number; now?: Date }) {
    const stations = await loadVirtualStations(this.db);
    const station = opts.station
      ? stations.find((s) => s.id === opts.station)
      : (stations.find((s) => s.primary) ?? stations[0]);
    if (!station)
      throw new NotFoundException(`estación desconocida: ${opts.station ?? "(ninguna)"}`);

    const from = truncToHour(opts.now ?? new Date());
    const to = addHours(from, opts.hours);
    const rows = await this.db.execute<Row>(sql`
      with latest as (
        select source, max(forecast_ts) as forecast_ts
        from forecasts
        where station_id = ${station.id} and variable = ${opts.variable}
          and ts >= ${from.toISOString()}::timestamptz and ts < ${to.toISOString()}::timestamptz
        group by source
      )
      select f.source, s.name, f.forecast_ts, f.ts, f.value, f.unit
      from forecasts f
      join latest l on l.source = f.source and l.forecast_ts = f.forecast_ts
      left join sources s on s.id = f.source
      where f.station_id = ${station.id} and f.variable = ${opts.variable}
        and f.ts >= ${from.toISOString()}::timestamptz and f.ts < ${to.toISOString()}::timestamptz
      order by f.source, f.ts
    `);

    const accumulated = opts.variable === "precip_mm";
    const bySource = new Map<string, CompareSeries>();
    for (const r of rows) {
      let s = bySource.get(r.source);
      if (!s) {
        s = {
          source: r.source,
          name: r.name ?? r.source,
          forecast_ts: new Date(r.forecast_ts).toISOString(),
          total: null,
          max_hourly: null,
          points: [],
        };
        bySource.set(r.source, s);
      }
      s.points.push({ ts: new Date(r.ts).toISOString(), value: Number(r.value) });
    }
    const series = [...bySource.values()].map((s) => {
      const values = s.points.map((p) => p.value);
      return {
        ...s,
        total: accumulated ? round(values.reduce((a, b) => a + b, 0)) : null,
        max_hourly: values.length ? round(Math.max(...values)) : null,
      };
    });
    const totals = series
      .map((s) => (accumulated ? s.total! : s.max_hourly!))
      .filter((v) => v !== null);
    return {
      station: { id: station.id, name: station.name, lat: station.lat, lon: station.lon },
      variable: opts.variable,
      unit: VARIABLES[opts.variable as keyof typeof VARIABLES] ?? rows[0]?.unit ?? null,
      from: from.toISOString(),
      to: to.toISOString(),
      series,
      summary: {
        sources: series.length,
        min_total: totals.length ? round(Math.min(...totals)) : null,
        median_total: totals.length ? round(median(totals)) : null,
        max_total: totals.length ? round(Math.max(...totals)) : null,
      },
    };
  }

  /**
   * Evolución corrida a corrida de la lluvia prevista para la **misma** ventana futura.
   *
   * Se guarda cada emisión con su `forecast_ts`, así que se puede preguntar qué decía cada
   * modelo hace 6, 12 o 24 h para estas mismas horas. Una corrida antigua puede no cubrir la
   * ventana entera (AEMET solo llega a 48 h): `hours_covered` lo delata y el frontend lo marca.
   */
  async runs(opts: { station?: string; horizonHours: 12 | 24; lookbackHours: number; now?: Date }) {
    const db = this.db;
    const stations = await loadVirtualStations(db);
    const station = opts.station
      ? stations.find((s) => s.id === opts.station)
      : (stations.find((s) => s.primary) ?? stations[0]);
    if (!station)
      throw new NotFoundException(`estación desconocida: ${opts.station ?? "(ninguna)"}`);

    const now = opts.now ?? new Date();
    const from = truncToHour(now);
    const to = addHours(from, opts.horizonHours);
    const since = addHours(now, -opts.lookbackHours);
    const rows = await db.execute<RunRow>(sql`
      select f.source, s.name, f.forecast_ts,
             sum(f.value) as total, count(distinct f.ts)::int as hours_covered
      from forecasts f
      left join sources s on s.id = f.source
      where f.station_id = ${station.id} and f.variable = 'precip_mm'
        and f.forecast_ts >= ${since.toISOString()}::timestamptz
        and f.ts >= ${from.toISOString()}::timestamptz and f.ts < ${to.toISOString()}::timestamptz
      group by f.source, s.name, f.forecast_ts
      order by f.source, f.forecast_ts
    `);

    const bySource = new Map<string, RunSeries>();
    for (const r of rows) {
      let s = bySource.get(r.source);
      if (!s) {
        s = { source: r.source, name: r.name ?? r.source, runs: [], delta: null };
        bySource.set(r.source, s);
      }
      s.runs.push({
        forecast_ts: new Date(r.forecast_ts).toISOString(),
        total: round(Number(r.total)),
        hours_covered: Number(r.hours_covered),
      });
    }
    const series = [...bySource.values()].map((s) => ({
      ...s,
      delta: s.runs.length >= 2 ? round(s.runs.at(-1)!.total - s.runs[0]!.total) : null,
    }));

    // Mediana entre fuentes por tramo de antigüedad de la corrida, para leer la tendencia del
    // conjunto sin que la marque un modelo solo. Los tramos son de 6 h porque es la cadencia
    // más común de emisión.
    const buckets = new Map<number, number[]>();
    for (const s of series) {
      // Por fuente y tramo, la corrida más reciente: dos emisiones en el mismo tramo no cuentan doble.
      const seen = new Map<number, number>();
      for (const r of s.runs) {
        const ageH = (now.getTime() - new Date(r.forecast_ts).getTime()) / 3_600_000;
        const bucket = Math.floor(ageH / 6) * 6;
        seen.set(bucket, r.total);
      }
      for (const [b, v] of seen) buckets.set(b, [...(buckets.get(b) ?? []), v]);
    }
    const medians = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([age_hours, values]) => ({
        age_hours,
        sources: values.length,
        median: round(median(values)),
      }));

    return {
      station: { id: station.id, name: station.name, lat: station.lat, lon: station.lon },
      variable: "precip_mm",
      unit: "mm",
      horizon_hours: opts.horizonHours,
      from: from.toISOString(),
      to: to.toISOString(),
      lookback_hours: opts.lookbackHours,
      series,
      medians,
    };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
