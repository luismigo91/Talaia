import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { forecasts, type ForecastRow } from "./db/schema.js";

/** Upsert por lotes en `forecasts`. Devuelve el número de filas enviadas. */
export async function upsertForecasts(db: Db, rows: ForecastRow[], batch = 1000): Promise<number> {
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await db
      .insert(forecasts)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          forecasts.source,
          forecasts.stationId,
          forecasts.variable,
          forecasts.forecastTs,
          forecasts.ts,
        ],
        set: { value: sql`excluded.value`, unit: sql`excluded.unit` },
      });
  }
  return rows.length;
}

/** Última `forecast_ts` almacenada para una fuente (y opcionalmente estación). */
export async function latestForecastTs(
  db: Db,
  source: string,
  stationId?: string,
): Promise<Date | null> {
  const rows = await db.execute<{ max: Date | string | null }>(sql`
    select max(forecast_ts) as max from forecasts
    where source = ${source} ${stationId ? sql`and station_id = ${stationId}` : sql``}
  `);
  const v = rows[0]?.max;
  return v ? new Date(v) : null;
}
