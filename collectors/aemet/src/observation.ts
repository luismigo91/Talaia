import { sql } from "drizzle-orm";
import { parseNumeric, type Db, type ObservationRow } from "@talaia/shared";

export const OBSERVATION_SOURCE = "aemet:observation";

/**
 * Estaciones automáticas de AEMET cercanas a las localizaciones objetivo (`docs/fuentes.md`).
 * `AEMET_OBSERVATION_STATIONS` las sobrescribe sin desplegar.
 */
export const DEFAULT_STATIONS = ["8416", "8414A", "8337X", "8409X", "8328X"];

export function observationStations(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.AEMET_OBSERVATION_STATIONS?.trim();
  if (!raw) return DEFAULT_STATIONS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Fila horaria de `/api/observacion/convencional/datos/estacion/{idema}`. */
export interface AemetObservation {
  idema: string;
  ubi?: string;
  /** Fin del periodo, en UTC y **sin sufijo Z**. */
  fint: string;
  /** Precipitación de los 60 min anteriores (mm). */
  prec?: number;
  ta?: number;
  hr?: number;
  vv?: number;
  vmax?: number;
  dv?: number;
  pres?: number;
  lat?: number;
  lon?: number;
  alt?: number;
}

/**
 * Variable de AEMET → canónica. `accumulated` marca las que cubren la hora **anterior** a
 * `fint`, que se guardan con `ts` al inicio del intervalo (misma convención que Open-Meteo).
 */
export const VARIABLE_MAP: Record<
  string,
  { variable: string; unit: string; accumulated: boolean }
> = {
  prec: { variable: "precip_mm", unit: "mm", accumulated: true },
  ta: { variable: "temp_c", unit: "°C", accumulated: false },
  hr: { variable: "rh_pct", unit: "%", accumulated: false },
  vv: { variable: "wind_ms", unit: "m/s", accumulated: false },
  vmax: { variable: "gust_ms", unit: "m/s", accumulated: false },
  dv: { variable: "wind_dir_deg", unit: "°", accumulated: false },
  pres: { variable: "pressure_hpa", unit: "hPa", accumulated: false },
};

export const stationId = (idema: string) => `aemet:${idema}`;

/** `fint` viene en UTC sin sufijo: "2026-08-25T18:00:00" → instante UTC. */
export function parseFint(fint: string): Date | null {
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(fint) ? fint : `${fint}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convierte las filas horarias de una estación en observaciones del esquema común. */
export function parseObservations(rows: AemetObservation[]): ObservationRow[] {
  const out: ObservationRow[] = [];
  for (const row of rows) {
    const fint = parseFint(row.fint);
    if (!fint || !row.idema) continue;
    for (const [key, spec] of Object.entries(VARIABLE_MAP)) {
      const value = parseNumeric((row as unknown as Record<string, unknown>)[key]);
      if (value === null) continue;
      out.push({
        source: OBSERVATION_SOURCE,
        stationId: stationId(row.idema),
        variable: spec.variable,
        ts: spec.accumulated ? new Date(fint.getTime() - 3_600_000) : fint,
        value,
        unit: spec.unit,
        quality: null,
      });
    }
  }
  return out;
}

/**
 * Da de alta (o actualiza) la estación con las coordenadas que vienen en la propia respuesta.
 * Así el catálogo se autopuebla con datos de la fuente en lugar de con constantes escritas a
 * mano, que es como se cuelan los errores de posición.
 */
export async function upsertStation(db: Db, row: AemetObservation): Promise<boolean> {
  if (typeof row.lat !== "number" || typeof row.lon !== "number") return false;
  const id = stationId(row.idema);
  const name = row.ubi?.trim() || row.idema;
  await db.execute(sql`
    insert into stations (id, source, name, kind, geom, elevation_m, meta)
    values (${id}, 'aemet', ${name}, 'station',
            ST_SetSRID(ST_Point(${row.lon}, ${row.lat}), 4326),
            ${row.alt ?? null}, ${JSON.stringify({ idema: row.idema })}::jsonb)
    on conflict (id) do update set
      name = excluded.name, geom = excluded.geom, elevation_m = excluded.elevation_m
  `);
  return true;
}

/** Registra en `sensors` las variables observadas de la estación (sin umbrales: son contexto). */
export async function upsertSensors(db: Db, idema: string, variables: string[]): Promise<void> {
  for (const variable of variables) {
    const spec = Object.values(VARIABLE_MAP).find((v) => v.variable === variable);
    if (!spec) continue;
    await db.execute(sql`
      insert into sensors (id, source, station_id, external_id, variable, unit, meta)
      values (${`aemet:${idema}:${variable}`}, 'aemet', ${stationId(idema)}, ${idema},
              ${variable}, ${spec.unit},
              ${JSON.stringify({ note: "estación automática de AEMET" })}::jsonb)
      on conflict (id) do nothing
    `);
  }
}
