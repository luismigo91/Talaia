import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { dedupeAlerts, loadVirtualStations, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";
import { AlertsQueryDto } from "./alerts.dto.js";

type Row = {
  id: string;
  source: string;
  area_code: string;
  area_name: string | null;
  event: string | null;
  event_code: string | null;
  level: string;
  severity: string | null;
  parameter: string | null;
  onset: string | Date;
  expires: string | Date;
  headline: string | null;
  description: string | null;
};

@Controller("api/v1/alerts")
export class AlertsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Avisos oficiales de las zonas de las localizaciones objetivo, deduplicados entre fuentes
   * (AEMET y Meteoalarm publican lo mismo con identificadores distintos).
   */
  @Get()
  async list(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: AlertsQueryDto }))
    q: AlertsQueryDto,
  ) {
    const stations = await loadVirtualStations(this.db);
    const zones = [...new Set(stations.map((s) => s.aemetZone).filter((z): z is string => !!z))];
    const zoneNames = new Map<string, string[]>();
    for (const s of stations) {
      if (!s.aemetZone) continue;
      zoneNames.set(s.aemetZone, [...(zoneNames.get(s.aemetZone) ?? []), s.name]);
    }
    const wanted = q.zone ? [q.zone] : zones;
    if (wanted.length === 0) return { alerts: [] };

    const rows = await this.db.execute<Row>(sql`
      select id, source, area_code, area_name, event, event_code, level, severity, parameter,
             onset, expires, headline, description
      from alerts
      where area_code in ${sql`(${sql.join(
        wanted.map((z) => sql`${z}`),
        sql`, `,
      )})`}
        ${q.active ? sql`and expires > now()` : sql``}
      order by expires desc
      limit ${q.limit}
    `);

    const unique = dedupeAlerts(
      rows.map((r) => ({ ...r, areaCode: r.area_code, eventCode: r.event_code })),
    );
    return {
      alerts: unique.map((a) => ({
        id: a.id,
        source: a.source,
        zone: a.area_code,
        zone_name: a.area_name,
        stations: zoneNames.get(a.area_code) ?? [],
        event: a.event,
        event_code: a.event_code,
        level: a.level,
        severity: a.severity,
        parameter: a.parameter,
        onset: new Date(a.onset).toISOString(),
        expires: new Date(a.expires).toISOString(),
        active: new Date(a.expires).getTime() > Date.now(),
        headline: a.headline,
        description: a.description,
      })),
    };
  }
}
