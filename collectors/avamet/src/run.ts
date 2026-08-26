import { sql } from "drizzle-orm";
import {
  logger,
  runWithStatus,
  upsertObservations,
  type Db,
  type ObservationRow,
} from "@talaia/shared";
import { AvametClient } from "./client.js";
import {
  parsePrecipitationTable,
  parseStationPage,
  stationId,
  toObservations,
  SOURCE,
  type AvametReading,
} from "./parse.js";

export { SOURCE };

/** Comarca de l'Horta Sud: Torrent, Paiporta, Picanya, Catarroja, Albal, Massanassa… */
export const DEFAULT_TERRITORY = "c16";
/** Fichas nuevas que se piden por ciclo, para no castigar un servidor pequeño. */
export const MAX_NEW_STATIONS_PER_RUN = 5;

export function territory(env: NodeJS.ProcessEnv = process.env): string {
  return env.AVAMET_TERRITORY?.trim() || DEFAULT_TERRITORY;
}

export interface RunOptions {
  client?: AvametClient;
  territory?: string;
  maxNewStations?: number;
}

/** Nunca lanza: registra el resultado en `source_status`. */
export async function run(db: Db, opts: RunOptions = {}) {
  return runWithStatus(db, SOURCE, () => collect(db, opts));
}

/**
 * Estaciones amateur de l'Horta Sud.
 *
 * Son la **única** señal disponible del barranc de l'Horteta, que está fuera del SAIH y que
 * pudo aportar ~3.500 m³/s en Torrent el 29-10-2024. Dato sin control de calidad: entra como
 * contexto, con su procedencia bien visible, no como medida oficial.
 */
export async function collect(db: Db, opts: RunOptions = {}) {
  const client = opts.client ?? new AvametClient();
  const zone = opts.territory ?? territory();
  const html = await client.precipitation(zone);
  const readings = parsePrecipitationTable(html);
  if (readings.length === 0) {
    throw new Error("la tabla de precipitación no devolvió ninguna estación (¿cambió el HTML?)");
  }

  const known = await knownStations(db);
  const nuevas = readings.filter((r) => !known.has(stationId(r.id)));
  const problems: string[] = [];
  let altas = 0;

  for (const reading of nuevas.slice(0, opts.maxNewStations ?? MAX_NEW_STATIONS_PER_RUN)) {
    try {
      const page = await client.station(reading.id);
      const info = parseStationPage(page);
      if (!info) {
        problems.push(`${reading.id} (ficha sin coordenadas)`);
        continue;
      }
      await upsertStation(db, reading, info.lat, info.lon);
      known.add(stationId(reading.id));
      altas++;
    } catch (err) {
      problems.push(`${reading.id} (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  // Solo se guardan lecturas de estaciones con posición conocida: un dato sin sitio no sirve
  // para decidir si llueve *aquí*.
  const conPosicion = readings.filter((r) => known.has(stationId(r.id)));
  const rows: ObservationRow[] = toObservations(conPosicion);
  const written = await upsertObservations(db, rows);
  const pendientes = readings.length - conPosicion.length;

  logger.info(
    { estaciones: conPosicion.length, altas, rows: written, pendientes },
    "avamet: lecturas escritas",
  );
  return {
    recordsWritten: written,
    ...(problems.length > 0 || pendientes > 0
      ? {
          warning: [
            pendientes > 0 ? `${pendientes} estaciones pendientes de dar de alta` : "",
            ...problems,
          ]
            .filter(Boolean)
            .join("; "),
        }
      : {}),
  };
}

async function knownStations(db: Db): Promise<Set<string>> {
  const rows = await db.execute<{ id: string }>(
    sql`select id from stations where source = ${SOURCE}`,
  );
  return new Set(rows.map((r) => r.id));
}

async function upsertStation(db: Db, reading: AvametReading, lat: number, lon: number) {
  await db.execute(sql`
    insert into stations (id, source, name, kind, geom, meta)
    values (${stationId(reading.id)}, ${SOURCE}, ${reading.name}, 'rain_gauge',
            ST_SetSRID(ST_Point(${lon}, ${lat}), 4326),
            ${JSON.stringify({
              avamet_id: reading.id,
              note: "estación amateur de AVAMET; dato sin control de calidad",
              license: "CC BY-NC-ND 4.0 · AVAMET",
            })}::jsonb)
    on conflict (id) do update set name = excluded.name, geom = excluded.geom
  `);
  for (const variable of ["precip_day_mm", "precip_1h_mm", "precip_12h_mm", "precip_24h_mm"]) {
    await db.execute(sql`
      insert into sensors (id, source, station_id, external_id, variable, unit, meta)
      values (${`avamet:${reading.id}:${variable}`}, ${SOURCE}, ${stationId(reading.id)},
              ${reading.id}, ${variable}, 'mm',
              ${JSON.stringify({ note: "AVAMET (amateur)" })}::jsonb)
      on conflict (id) do nothing
    `);
  }
}
