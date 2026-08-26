import { parseLocalIso, type ObservationRow } from "@talaia/shared";

export const SOURCE = "avamet";

/**
 * Columnas de la tabla de precipitación, en orden. AVAMET publica más ventanas de las que
 * guardamos: nos quedamos con las que dicen algo distinto (día, 1 h, 12 h y 24 h).
 */
const COLUMNS: { index: number; variable: string }[] = [
  { index: 0, variable: "precip_day_mm" },
  { index: 5, variable: "precip_1h_mm" },
  { index: 8, variable: "precip_12h_mm" },
  { index: 9, variable: "precip_24h_mm" },
];

export interface AvametReading {
  id: string;
  name: string;
  /** Instante de la última lectura publicada por la estación. */
  ts: Date;
  values: Record<string, number>;
}

const strip = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const decode = (s: string) =>
  s
    .replace(/&agrave;/g, "à")
    .replace(/&egrave;/g, "è")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** "12,4" → 12.4; vacío o "-" → null. AVAMET usa coma decimal y punto de millar. */
export function parseNumber(text: string): number | null {
  const clean = decode(text).replace(/\./g, "").replace(",", ".").trim();
  if (!clean || clean === "-") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** "26-08-2026 07:51" (hora local) → instante UTC. */
export function parseTimestamp(text: string, tz = "Europe/Madrid"): Date | null {
  const m = /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  try {
    return parseLocalIso(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`, tz);
  } catch {
    return null;
  }
}

/** Extrae una lectura por estación de la tabla de precipitación de una comarca. */
export function parsePrecipitationTable(html: string): AvametReading[] {
  const out: AvametReading[] = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const idMatch = /id=(c\d+m\d+e\d+)/.exec(row);
    if (!idMatch) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 3) continue;

    const name = decode(strip(cells[0]![1]!)).replace(/\s+/g, " ").trim();
    const timeCell = /<td[^>]*class="rValCentre"[^>]*title="([^"]+)"/.exec(row);
    const ts = timeCell ? parseTimestamp(timeCell[1]!) : null;
    if (!ts) continue; // sin hora de lectura no sabemos a qué instante corresponde

    // La primera celda es el nombre; los valores empiezan en la siguiente.
    const values: Record<string, number> = {};
    for (const col of COLUMNS) {
      const cell = cells[col.index + 1];
      if (!cell) continue;
      const value = parseNumber(strip(cell[1]!));
      if (value !== null) values[col.variable] = value;
    }
    if (Object.keys(values).length === 0) continue;
    out.push({ id: idMatch[1]!, name, ts, values });
  }
  return out;
}

export const stationId = (id: string) => `avamet:${id}`;

/** Lecturas → filas del esquema común. */
export function toObservations(readings: AvametReading[]): ObservationRow[] {
  return readings.flatMap((r) =>
    Object.entries(r.values).map(([variable, value]) => ({
      source: SOURCE,
      stationId: stationId(r.id),
      variable,
      ts: r.ts,
      value,
      unit: "mm",
      quality: null,
    })),
  );
}

/** Coordenadas de la ficha técnica (`var lat = …` / `var lon = …`). */
export function parseStationPage(html: string): { lat: number; lon: number; name?: string } | null {
  const lat = /var\s+lat\s*=\s*(-?\d+(?:\.\d+)?)/.exec(html);
  const lon = /var\s+lon\s*=\s*(-?\d+(?:\.\d+)?)/.exec(html);
  if (!lat || !lon) return null;
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const name = h1 ? decode(strip(h1[1]!)) : undefined;
  return { lat: Number(lat[1]), lon: Number(lon[1]), ...(name ? { name } : {}) };
}
