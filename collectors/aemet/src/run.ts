import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  alerts,
  getPayloadHash,
  loadVirtualStations,
  logger,
  runWithStatus,
  upsertForecasts,
  upsertObservations,
  type Db,
  type ForecastRow,
  type VirtualStation,
} from "@talaia/shared";
import { AemetClient, endpoints } from "./client.js";
import {
  observationStations,
  parseObservations,
  upsertSensors,
  upsertStation,
  OBSERVATION_SOURCE,
  type AemetObservation,
} from "./observation.js";
import { extractXmlFromTarGz, parseCap, toMultiPolygonWkt, type CapAlert } from "./cap.js";
import { parseHourly, type AemetHourly } from "./hourly.js";

export const AREA_CV = "77";
export const forecastSource = (ine: string) => `aemet:forecast:${ine}`;
export const ALERTS_SOURCE = "aemet:alerts";

export interface RunOptions {
  client?: AemetClient;
  area?: string;
}

/** Ejecuta predicción (una consulta por INE distinto) y avisos. Nunca lanza. */
export async function run(db: Db, opts: RunOptions = {}) {
  let client: AemetClient;
  try {
    client = opts.client ?? new AemetClient();
  } catch (err) {
    // Sin clave: registramos el error en todas las fuentes lógicas y salimos.
    const message = err instanceof Error ? err.message : String(err);
    const stations = await loadVirtualStations(db);
    for (const s of stationsByIne(stations).keys()) {
      await runWithStatus(db, forecastSource(s), () => Promise.reject(new Error(message)));
    }
    await runWithStatus(db, ALERTS_SOURCE, () => Promise.reject(new Error(message)));
    await runWithStatus(db, OBSERVATION_SOURCE, () => Promise.reject(new Error(message)));
    return;
  }
  await runForecasts(db, client);
  await runWithStatus(db, ALERTS_SOURCE, () => collectAlerts(db, client, opts.area ?? AREA_CV));
  await runWithStatus(db, OBSERVATION_SOURCE, () => collectObservations(db, client));
}

export async function runForecasts(db: Db, client: AemetClient) {
  const stations = await loadVirtualStations(db);
  for (const [ine, targets] of stationsByIne(stations)) {
    await runWithStatus(db, forecastSource(ine), () => collectForecast(db, client, ine, targets));
  }
}

export function stationsByIne(stations: VirtualStation[]): Map<string, VirtualStation[]> {
  const m = new Map<string, VirtualStation[]>();
  for (const s of stations) {
    if (!s.ine) continue;
    m.set(s.ine, [...(m.get(s.ine) ?? []), s]);
  }
  return m;
}

/** Predicción horaria de un municipio, escrita para todas las estaciones virtuales con ese INE. */
export async function collectForecast(
  db: Db,
  client: AemetClient,
  ine: string,
  targets: VirtualStation[],
) {
  const text = await client.getText(endpoints.hourly(ine));
  const hash = createHash("sha256").update(text).digest("hex");
  if ((await getPayloadHash(db, forecastSource(ine))) === hash) {
    logger.info({ ine }, "aemet: predicción sin cambios");
    return { recordsWritten: 0, payloadHash: hash };
  }
  const payload = JSON.parse(text) as AemetHourly[];
  const rows: ForecastRow[] = targets.flatMap((s) => parseHourly(payload, { stationId: s.id }));
  const written = await upsertForecasts(db, rows);
  logger.info({ ine, rows: written }, "aemet: predicción escrita");
  return { recordsWritten: written, payloadHash: hash };
}

/** Avisos CAP vigentes del área, filtrados por las zonas de las estaciones virtuales. */
export async function collectAlerts(db: Db, client: AemetClient, area: string) {
  const stations = await loadVirtualStations(db);
  const zones = new Set(stations.map((s) => s.aemetZone).filter((z): z is string => !!z));
  const tarGz = await client.getBytes(endpoints.capLatest(area));
  const hash = createHash("sha256").update(tarGz).digest("hex");
  const files = await extractXmlFromTarGz(tarGz);
  const found: CapAlert[] = files.flatMap((f) => parseCap(f.xml, zones));
  const written = await upsertAlerts(db, found);
  logger.info(
    { files: files.length, alerts: written, zones: [...zones] },
    "aemet: avisos procesados",
  );
  return { recordsWritten: written, payloadHash: hash };
}

export async function upsertAlerts(db: Db, items: CapAlert[]): Promise<number> {
  let n = 0;
  for (const a of items) {
    const { polygons, ...row } = a;
    const wkt = toMultiPolygonWkt(polygons);
    await db
      .insert(alerts)
      .values({
        ...row,
        geom: wkt ? sql`ST_GeomFromEWKT(${wkt})` : null,
        updatedAt: new Date(),
      } as never)
      .onConflictDoUpdate({
        target: alerts.id,
        set: {
          level: row.level,
          severity: row.severity,
          parameter: row.parameter,
          event: row.event,
          eventCode: row.eventCode,
          onset: row.onset,
          expires: row.expires,
          sent: row.sent,
          headline: row.headline,
          description: row.description,
          raw: row.raw,
          geom: wkt ? sql`ST_GeomFromEWKT(${wkt})` : null,
          updatedAt: new Date(),
        } as never,
      });
    n++;
  }
  return n;
}

/**
 * Observación de las estaciones automáticas de AEMET: la única medida oficial de lluvia con
 * la que contrastar la que deriva el collector del SAIH. Una estación caída no impide leer
 * las demás; el ciclo solo falla si no responde ninguna.
 */
export async function collectObservations(db: Db, client: AemetClient, idemas?: string[]) {
  const stations = idemas ?? observationStations();
  const problems: string[] = [];
  let written = 0;

  for (const idema of stations) {
    try {
      const text = await client.getText(endpoints.observation(idema));
      const payload = JSON.parse(text) as AemetObservation[];
      const rows = Array.isArray(payload) ? payload : [payload];
      const last = rows.at(-1);
      if (!last) {
        problems.push(`${idema} (sin filas)`);
        continue;
      }
      if (!(await upsertStation(db, last))) {
        problems.push(`${idema} (sin coordenadas en la respuesta)`);
        continue;
      }
      const observations = parseObservations(rows);
      await upsertSensors(db, idema, [...new Set(observations.map((o) => o.variable))]);
      written += await upsertObservations(db, observations);
    } catch (err) {
      problems.push(`${idema} (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  if (problems.length === stations.length) {
    throw new Error(`ninguna estación respondió: ${problems.join("; ")}`);
  }
  logger.info({ estaciones: stations.length, rows: written }, "aemet: observación escrita");
  return {
    recordsWritten: written,
    ...(problems.length > 0
      ? {
          warning: `${problems.length}/${stations.length} estaciones sin datos: ${problems.join("; ")}`,
        }
      : {}),
  };
}
