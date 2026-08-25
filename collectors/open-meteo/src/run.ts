import { createHash } from "node:crypto";
import {
  latestForecastTs,
  loadVirtualStations,
  logger,
  runWithStatus,
  truncToHour,
  upsertForecasts,
  type Db,
  type ForecastRow,
} from "@talaia/shared";
import { OpenMeteoClient } from "./client.js";
import { MODELS, sourceId } from "./models.js";
import { parseForecast } from "./parse.js";

export const SOURCE = "open-meteo";

export interface RunOptions {
  client?: OpenMeteoClient;
  now?: () => Date;
}

/** Ejecución completa del collector: nunca lanza; registra en source_status. */
export async function run(db: Db, opts: RunOptions = {}) {
  return runWithStatus(db, SOURCE, () => collect(db, opts));
}

export async function collect(db: Db, opts: RunOptions = {}) {
  const client = opts.client ?? new OpenMeteoClient();
  const now = opts.now ?? (() => new Date());
  const stations = await loadVirtualStations(db);
  if (stations.length === 0) throw new Error("no hay estaciones virtuales sembradas");

  // forecast_ts por modelo desde meta.json (fallback: hora de descarga truncada)
  const forecastTs = new Map<string, Date>();
  for (const m of MODELS) {
    if (!m.meta) {
      forecastTs.set(m.id, truncToHour(now()));
      continue;
    }
    try {
      const meta = await client.modelMeta(m.meta);
      forecastTs.set(m.id, new Date(meta.last_run_initialisation_time * 1000));
    } catch (err) {
      logger.warn(
        { model: m.id, err: String(err) },
        "meta.json no disponible; usando hora de descarga",
      );
      forecastTs.set(m.id, truncToHour(now()));
    }
  }

  // Idempotencia por corrida: no reescribir modelos cuya última forecast_ts ya está en DB
  const stale = new Map<string, Date>();
  for (const [modelId, ts] of forecastTs) {
    const last = await latestForecastTs(db, sourceId(modelId));
    if (!last || last.getTime() < ts.getTime()) stale.set(modelId, ts);
  }
  if (stale.size === 0) {
    logger.info("open-meteo: sin corridas nuevas");
    return { recordsWritten: 0 };
  }

  const { body, data } = await client.forecast(stations.map((s) => ({ lat: s.lat, lon: s.lon })));
  const rows: ForecastRow[] = [];
  data.forEach((res, i) => {
    rows.push(...parseForecast(res, { stationId: stations[i]!.id, forecastTs: stale }));
  });
  const written = await upsertForecasts(db, rows);
  logger.info({ rows: written, models: [...stale.keys()] }, "open-meteo: predicciones escritas");
  return { recordsWritten: written, payloadHash: createHash("sha256").update(body).digest("hex") };
}
