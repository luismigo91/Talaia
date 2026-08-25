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
}

const round = (n: number) => Math.round(n * 100) / 100;
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
