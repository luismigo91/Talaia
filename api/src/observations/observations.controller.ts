import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { thresholdLevel, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";
import { ObservationsQueryDto } from "./observations.dto.js";

type SensorRow = {
  id: string;
  source: string;
  station_id: string;
  station_name: string;
  variable: string;
  unit: string;
  threshold_low: number | string | null;
  threshold_mid: number | string | null;
  threshold_high: number | string | null;
};

@Controller("api/v1/observations")
export class ObservationsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Serie temporal observada de un sensor (o de una estación + variable). */
  @Get()
  async series(
    @Query(
      new ValidationPipe({ transform: true, whitelist: true, expectedType: ObservationsQueryDto }),
    )
    q: ObservationsQueryDto,
  ) {
    if (!q.sensor && !(q.station && q.variable)) {
      throw new BadRequestException("indica `sensor` o la pareja `station` y `variable`");
    }
    const [sensor] = await this.db.execute<SensorRow>(sql`
      select s.id, s.source, s.station_id, st.name as station_name, s.variable, s.unit,
             s.threshold_low, s.threshold_mid, s.threshold_high
      from sensors s join stations st on st.id = s.station_id
      where ${
        q.sensor
          ? sql`s.id = ${q.sensor}`
          : sql`s.station_id = ${q.station!} and s.variable = ${q.variable!}`
      }
      limit 1
    `);
    if (!sensor) {
      throw new NotFoundException(
        `sensor desconocido: ${q.sensor ?? `${q.station!}/${q.variable!}`}`,
      );
    }

    const from = new Date(Date.now() - q.hours * 3_600_000);
    const rows = await this.db.execute<{
      ts: string | Date;
      value: number | string | null;
      quality: number | null;
    }>(sql`
      select ts, value, quality from observations
      where source = ${sensor.source} and station_id = ${sensor.station_id}
        and variable = ${sensor.variable} and ts >= ${from.toISOString()}::timestamptz
      order by ts
    `);
    const points = rows.map((r) => ({
      ts: new Date(r.ts).toISOString(),
      value: r.value === null ? null : Number(r.value),
      quality: r.quality,
    }));
    const values = points.map((p) => p.value).filter((v): v is number => v !== null);
    const last = values.length ? values[values.length - 1]! : null;
    const thresholds = {
      thresholdLow: num(sensor.threshold_low),
      thresholdMid: num(sensor.threshold_mid),
      thresholdHigh: num(sensor.threshold_high),
    };
    return {
      sensor: {
        id: sensor.id,
        source: sensor.source,
        variable: sensor.variable,
        unit: sensor.unit,
        station: { id: sensor.station_id, name: sensor.station_name },
        thresholds: {
          low: thresholds.thresholdLow,
          mid: thresholds.thresholdMid,
          high: thresholds.thresholdHigh,
        },
      },
      from: from.toISOString(),
      hours: q.hours,
      summary: {
        points: points.length,
        last,
        max: values.length ? Math.max(...values) : null,
        level: thresholdLevel(last, thresholds),
      },
      points,
    };
  }
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
