import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  alerts,
  getPayloadHash,
  loadVirtualStations,
  logger,
  runWithStatus,
  type Db,
  type AlertRow,
} from "@talaia/shared";
import { MeteoalarmClient } from "./client.js";
import { parseFeed, SOURCE } from "./parse.js";

export { SOURCE };

export interface RunOptions {
  client?: MeteoalarmClient;
}

/** Nunca lanza: registra el resultado en `source_status`. */
export async function run(db: Db, opts: RunOptions = {}) {
  return runWithStatus(db, SOURCE, () => collect(db, opts));
}

export async function collect(db: Db, opts: RunOptions = {}) {
  const client = opts.client ?? new MeteoalarmClient();
  const stations = await loadVirtualStations(db);
  const zones = new Set(stations.map((s) => s.aemetZone).filter((z): z is string => !!z));
  if (zones.size === 0) throw new Error("no hay zonas de aviso en las estaciones virtuales");

  const { body, data } = await client.feed();
  const hash = createHash("sha256").update(body).digest("hex");
  if ((await getPayloadHash(db, SOURCE)) === hash) {
    logger.info("meteoalarm: feed sin cambios");
    return { recordsWritten: 0, payloadHash: hash };
  }
  const rows = parseFeed(data, zones);
  const written = await upsertAlerts(db, rows);
  logger.info(
    { avisos: written, zonas: [...zones], total: data.warnings.length },
    "meteoalarm: avisos procesados",
  );
  return { recordsWritten: written, payloadHash: hash };
}

/**
 * Upsert en `alerts`. Meteoalarm no publica polígonos, así que `geom` se deja como esté:
 * si AEMET ya escribió una geometría para ese aviso, no se pisa con NULL.
 */
export async function upsertAlerts(db: Db, rows: AlertRow[]): Promise<number> {
  for (const row of rows) {
    await db
      .insert(alerts)
      .values(row as never)
      .onConflictDoUpdate({
        target: alerts.id,
        set: {
          level: row.level,
          severity: row.severity ?? null,
          parameter: row.parameter ?? null,
          event: row.event ?? null,
          eventCode: row.eventCode ?? null,
          areaName: row.areaName ?? null,
          onset: row.onset,
          expires: row.expires,
          sent: row.sent,
          headline: row.headline ?? null,
          description: row.description ?? null,
          raw: row.raw,
          updatedAt: new Date(),
          geom: sql`${alerts.geom}`,
        } as never,
      });
  }
  return rows.length;
}
