import { sql } from "drizzle-orm";
import { alerts, loadVirtualStations, logger, runWithStatus, type Db } from "@talaia/shared";
import { GvaClient } from "./client.js";
import { parseEmergencies, SOURCE } from "./parse.js";
import type { AlertRow } from "@talaia/shared";

export { SOURCE };

/** Minutos que un aviso se considera vigente desde la última vez que se vio en `z2`. */
export function ttlMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.GVA_TTL_MINUTES ?? 30);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

export interface RunOptions {
  client?: GvaClient;
  now?: () => Date;
}

/** Nunca lanza: registra el resultado en `source_status`. */
export async function run(db: Db, opts: RunOptions = {}) {
  return runWithStatus(db, SOURCE, () => collect(db, opts));
}

export async function collect(db: Db, opts: RunOptions = {}) {
  const client = opts.client ?? new GvaClient();
  const now = (opts.now ?? (() => new Date()))();
  const stations = await loadVirtualStations(db);
  const zones = new Set(stations.flatMap((s) => s.gvaZones));
  if (zones.size === 0) throw new Error("ninguna estación tiene zonas de emergencia de la GVA");

  const feed = await client.emergencies();
  const rows = parseEmergencies(feed, { zones, now, ttlMinutes: ttlMinutes() });
  const written = await upsertAlerts(db, rows, now);
  logger.info(
    { avisos: written, zonas: [...zones], activas: Object.keys(feed.z2 ?? {}).length },
    "gva: emergencias procesadas",
  );
  return { recordsWritten: written };
}

/**
 * Upsert en `alerts`. La GVA no publica polígonos: `geom` queda como esté. Al reescribir la
 * vigencia en cada ciclo, un aviso que desaparece de `z2` caduca solo sin borrar la fila.
 */
export async function upsertAlerts(db: Db, rows: AlertRow[], now: Date): Promise<number> {
  for (const row of rows) {
    await db
      .insert(alerts)
      .values(row as never)
      .onConflictDoUpdate({
        target: alerts.id,
        set: {
          level: row.level,
          event: row.event ?? null,
          eventCode: row.eventCode ?? null,
          onset: row.onset,
          expires: row.expires,
          sent: row.sent,
          headline: row.headline ?? null,
          raw: row.raw,
          updatedAt: now,
          geom: sql`${alerts.geom}`,
        } as never,
      });
  }
  return rows.length;
}
