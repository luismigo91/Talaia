import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { loadVirtualStations, loadWatchPoints, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

type BoundRow = { today: string | Date };
type ObsRow = { day: string; station_id: string; mm: number | string };
type PredRow = {
  source: string;
  name: string | null;
  day: string;
  mm: number | string;
  hours: number;
};

export interface VerifyDay {
  day: string;
  observed_mm: number | null;
  predictions: { source: string; mm: number | null }[];
}

@Injectable()
export class VerifyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Predicción vs. realidad, por día completo. Para cada día se toma de cada modelo la
   * corrida emitida *antes* de que empezara ese día (la previsión "de la víspera") y se suma
   * su lluvia; se contrasta con la lluvia observada por los pluviómetros del SAIH que vigilan
   * la localidad (el peor de ellos, igual que hace el semáforo). Aproximación honesta: la
   * referencia es la red oficial de aforos, no una malla de precipitación.
   */
  async verify(opts: { station?: string; days: number }) {
    const stations = await loadVirtualStations(this.db);
    const station = opts.station
      ? stations.find((s) => s.id === opts.station)
      : (stations.find((s) => s.primary) ?? stations[0]);
    if (!station)
      throw new NotFoundException(`estación desconocida: ${opts.station ?? "(ninguna)"}`);

    // Pluviómetros que vigilan esta localidad (precip_mm; excluye amateur, que va por radio).
    const points = await loadWatchPoints(this.db, station.id);
    const gauges = dedupeBy(
      points
        .filter((p) => p.variable === "precip_mm")
        .map((p) => ({ station_id: p.sensorStationId, name: p.sensorStationName })),
      (g) => g.station_id,
    );

    // Límites: días completos en hora local de Madrid, excluyendo el día en curso.
    const [b] = await this.db.execute<BoundRow>(
      sql`select (date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') as today`,
    );
    const to = new Date(b!.today);
    const from = new Date(to.getTime() - opts.days * 86_400_000);

    const gaugeIds = gauges.map((g) => g.station_id);
    // Lista IN construida con sql.join: el binding de arrays (`= any($1)`) no lleva tipo con
    // el cliente `postgres` a `fetch_types:false` y Postgres no puede inferir el tipo → error.
    const observed =
      gaugeIds.length === 0
        ? []
        : await this.db.execute<ObsRow>(sql`
            select to_char(date_trunc('day', ts at time zone 'Europe/Madrid'), 'YYYY-MM-DD') as day,
                   station_id, sum(value)::float8 as mm
            from observations
            where variable = 'precip_mm'
              and station_id in ${sql`(${sql.join(
                gaugeIds.map((id) => sql`${id}`),
                sql`, `,
              )})`}
              and ts >= ${from.toISOString()}::timestamptz and ts < ${to.toISOString()}::timestamptz
            group by day, station_id
          `);
    // Observado del día = el peor pluviómetro (lo que manda en el semáforo).
    const observedByDay = new Map<string, number>();
    for (const r of observed) {
      const mm = Number(r.mm);
      observedByDay.set(r.day, Math.max(observedByDay.get(r.day) ?? 0, mm));
    }

    const predicted = await this.db.execute<PredRow>(sql`
      with hours as (
        select f.source, f.ts, f.value::float8 as value, f.forecast_ts,
               date_trunc('day', f.ts at time zone 'Europe/Madrid') as day_local
        from forecasts f
        where f.station_id = ${station.id} and f.variable = 'precip_mm'
          and f.ts >= ${from.toISOString()}::timestamptz and f.ts < ${to.toISOString()}::timestamptz
      ),
      picked as (
        select distinct on (source, ts) source, day_local, value
        from hours
        where forecast_ts <= (day_local at time zone 'Europe/Madrid')
        order by source, ts, forecast_ts desc
      )
      select p.source, s.name, to_char(p.day_local, 'YYYY-MM-DD') as day,
             sum(p.value)::float8 as mm, count(*)::int as hours
      from picked p left join sources s on s.id = p.source
      group by p.source, s.name, p.day_local
    `);

    const modelMap = new Map<string, string>();
    const predByDay = new Map<string, Map<string, number>>();
    for (const r of predicted) {
      modelMap.set(r.source, r.name ?? r.source);
      if (!predByDay.has(r.day)) predByDay.set(r.day, new Map());
      // Solo días con las 24 horas previstas, para no comparar contra una previsión a medias.
      if (r.hours >= 20) predByDay.get(r.day)!.set(r.source, Number(r.mm));
    }
    const models = [...modelMap.entries()]
      .map(([source, name]) => ({ source, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    // Días a partir de las claves reales vistas (fecha local), ordenadas ascendente.
    const days: VerifyDay[] = [];
    const allDays = new Set<string>([...observedByDay.keys(), ...predByDay.keys()]);
    for (const day of [...allDays].sort()) {
      days.push({
        day,
        observed_mm: observedByDay.has(day) ? round(observedByDay.get(day)!) : null,
        predictions: models.map((m) => ({
          source: m.source,
          mm: predByDay.get(day)?.has(m.source) ? round(predByDay.get(day)!.get(m.source)!) : null,
        })),
      });
    }

    return {
      station: { id: station.id, name: station.name, lat: station.lat, lon: station.lon },
      tz: "Europe/Madrid",
      days_requested: opts.days,
      from: from.toISOString(),
      to: to.toISOString(),
      gauges,
      models,
      days,
    };
  }
}

const round = (n: number) => Math.round(n * 10) / 10;
function dedupeBy<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of xs) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}
