import postgres from "postgres";
import { databaseUrl } from "./db/client.js";
import { logger } from "./logger.js";
import { RISK_CHANNEL } from "./risk-state.js";

export type RiskChangePayload = {
  stationId: string;
  station: string;
  level: string;
  previous: string | null;
  direction: "subida" | "bajada";
  ts: string;
};

/**
 * Escucha en Postgres los cambios de nivel que publica el ciclo de riesgo.
 *
 * Una conexión dedicada por proceso: el semáforo cambia unas pocas veces al año, así que
 * sondear la base desde cada cliente conectado sería puro desperdicio. Devuelve la función
 * para cerrar la escucha.
 */
export async function listenRiskChanges(
  onChange: (payload: string) => void,
  url = databaseUrl(),
): Promise<() => Promise<void>> {
  const sql = postgres(url, { max: 1, onnotice: () => {}, fetch_types: false });
  await sql.listen(RISK_CHANNEL, onChange);
  logger.info({ channel: RISK_CHANNEL }, "escuchando cambios de nivel");
  return async () => {
    await sql.end({ timeout: 5 });
  };
}
