import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";
import { HistoryQueryDto } from "./risk.dto.js";

type Row = {
  id: number;
  station_id: string;
  station_name: string;
  ts: string | Date;
  level: string;
  previous_level: string | null;
  direction: string;
  notified: boolean;
  notify_error: string | null;
  components: unknown;
};

@Controller("api/v1/risk/history")
export class RiskHistoryController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Transiciones de nivel más recientes: lo que se notificó y por qué. */
  @Get()
  async history(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: HistoryQueryDto }))
    q: HistoryQueryDto,
  ) {
    const rows = await this.db.execute<Row>(sql`
      select e.id, e.station_id, s.name as station_name, e.ts, e.level, e.previous_level,
             e.direction, e.notified, e.notify_error, e.components
      from risk_events e
      join stations s on s.id = e.station_id
      ${q.station ? sql`where e.station_id = ${q.station}` : sql``}
      order by e.ts desc, e.id desc
      limit ${q.limit}
    `);
    return {
      events: rows.map((r) => ({
        id: Number(r.id),
        station: { id: r.station_id, name: r.station_name },
        ts: new Date(r.ts).toISOString(),
        level: r.level,
        previous_level: r.previous_level,
        direction: r.direction,
        notified: r.notified,
        notify_error: r.notify_error,
        components: r.components,
      })),
    };
  }
}
