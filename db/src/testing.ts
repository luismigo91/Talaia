import type { Sql } from "postgres";

/** Deja la base de datos sin las tablas de Talaia (mantiene extensiones). Solo para tests. */
export async function resetDatabase(sql: Sql, attempts = 5): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await sql.unsafe(`
        drop table if exists alerts, raw_payloads, observations, forecasts, risk_events, risk_state, watch_points, thresholds, sensors, source_status, stations, sources, schema_migrations cascade;
      `);
      return;
    } catch (err) {
      // Carreras con conexiones de otra suite que aún se están cerrando.
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
}
