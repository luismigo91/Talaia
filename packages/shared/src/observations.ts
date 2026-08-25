import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { observations, type ObservationRow } from "./db/schema.js";

/** Upsert por lotes en `observations`. Devuelve el número de filas enviadas. */
export async function upsertObservations(
  db: Db,
  rows: ObservationRow[],
  batch = 1000,
): Promise<number> {
  for (let i = 0; i < rows.length; i += batch) {
    await db
      .insert(observations)
      .values(rows.slice(i, i + batch))
      .onConflictDoUpdate({
        target: [
          observations.source,
          observations.stationId,
          observations.variable,
          observations.ts,
        ],
        set: {
          value: sql`excluded.value`,
          unit: sql`excluded.unit`,
          quality: sql`excluded.quality`,
        },
      });
  }
  return rows.length;
}

/** Último `ts` almacenado por (station_id, variable) para una fuente. Clave: `station|variable`. */
export async function latestObservationTs(db: Db, source: string): Promise<Map<string, Date>> {
  const rows = await db.execute<{ station_id: string; variable: string; max: Date | string }>(sql`
    select station_id, variable, max(ts) as max
    from observations where source = ${source}
    group by station_id, variable
  `);
  return new Map(rows.map((r) => [`${r.station_id}|${r.variable}`, new Date(r.max)]));
}
