import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { thresholdLevel, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";
import { SensorsQueryDto } from "./sensors.dto.js";

type Row = {
  id: string;
  source: string;
  station_id: string;
  station_name: string;
  lat: number | string;
  lon: number | string;
  external_id: string;
  variable: string;
  unit: string;
  threshold_low: number | string | null;
  threshold_mid: number | string | null;
  threshold_high: number | string | null;
  meta: Record<string, unknown>;
  last_value: number | string | null;
  last_ts: string | Date | null;
  age_seconds: number | null;
};

@Controller("api/v1/sensors")
export class SensorsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Catálogo de sensores con su último valor y el nivel de umbral, calculado en servidor
   * para que la pantalla y las futuras notificaciones vean exactamente lo mismo.
   */
  @Get()
  async list(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: SensorsQueryDto }))
    q: SensorsQueryDto,
  ) {
    const rows = await this.db.execute<Row>(sql`
      select s.id, s.source, s.station_id, st.name as station_name,
             ST_Y(st.geom) as lat, ST_X(st.geom) as lon,
             s.external_id, s.variable, s.unit,
             s.threshold_low, s.threshold_mid, s.threshold_high, s.meta,
             o.value as last_value, o.ts as last_ts,
             case when o.ts is null then null
                  else floor(extract(epoch from (now() - o.ts)))::int end as age_seconds
      from sensors s
      join stations st on st.id = s.station_id
      left join lateral (
        select value, ts from observations
        where source = s.source and station_id = s.station_id and variable = s.variable
        order by ts desc limit 1
      ) o on true
      where s.enabled
        ${q.source ? sql`and s.source = ${q.source}` : sql``}
        ${q.station ? sql`and s.station_id = ${q.station}` : sql``}
        ${q.variable ? sql`and s.variable = ${q.variable}` : sql``}
      order by s.station_id, s.variable
    `);

    const sensors = rows.map((r) => {
      const thresholds = {
        thresholdLow: num(r.threshold_low),
        thresholdMid: num(r.threshold_mid),
        thresholdHigh: num(r.threshold_high),
      };
      const value = num(r.last_value);
      return {
        id: r.id,
        source: r.source,
        external_id: r.external_id,
        variable: r.variable,
        unit: r.unit,
        station: {
          id: r.station_id,
          name: r.station_name,
          lat: Number(r.lat),
          lon: Number(r.lon),
        },
        thresholds: {
          low: thresholds.thresholdLow,
          mid: thresholds.thresholdMid,
          high: thresholds.thresholdHigh,
        },
        last_value: value,
        last_ts: r.last_ts ? new Date(r.last_ts).toISOString() : null,
        age_seconds: r.age_seconds,
        level: thresholdLevel(value, thresholds),
        note: typeof r.meta.note === "string" ? r.meta.note : null,
      };
    });
    return { sensors };
  }
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
