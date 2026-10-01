import { parseLocalIso } from "@talaia/shared";

export const SOURCE = "hidrosur";

/** Una fila de la tabla de última hora de ríos. */
export interface RiverRow {
  number: string;
  name: string;
  levelM: number | null;
  flowM3s: number | null;
  /** Código de su gráfica (`038R03`); sale de los enlaces de la propia tabla. */
  grafica: string | null;
}

/** Una fila de la tabla de última hora de embalses. */
export interface ReservoirRow {
  number: string;
  name: string;
  pct: number | null;
  hm3: number | null;
  grafica: string | null;
}

/** Histórico horario de 48 h de una gráfica (etiquetas en hora local). */
export interface HistoryPoint {
  ts: Date;
  value: number;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&#160;": " ",
  "&uacute;": "ú",
  "&Uacute;": "Ú",
  "&ntilde;": "ñ",
  "&Ntilde;": "Ñ",
  "&iacute;": "í",
  "&Iacute;": "Í",
  "&oacute;": "ó",
  "&Oacute;": "Ó",
  "&eacute;": "é",
  "&Eacute;": "É",
  "&aacute;": "á",
  "&Aacute;": "Á",
  "&ordm;": "º",
  "&sup3;": "³",
  "&amp;": "&",
};

const text = (cell: string): string =>
  cell
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-zA-Z#0-9]+;/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();

/** "14,00 *" → 14; "0,27" → 0.27; "" → null. */
export function numEs(raw: string): number | null {
  const m = raw
    .replace(/\*/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

function rows(html: string): string[][] {
  const out: string[][] = [];
  for (const m of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...(m[1] ?? "").matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((c) => c[1] ?? "");
    if (cells.length > 0) out.push(cells);
  }
  return out;
}

/**
 * "Datos actualizados a: 01-10-2026 18:00:00" (hora local de la cuenca) como
 * instante UTC. Es el `ts` de los valores de última hora de las tablas.
 */
export function parseUpdatedAt(html: string): Date | null {
  const m = html.match(
    /Datos actualizados a:\s*(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!m) return null;
  return parseLocalIso(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`, "Europe/Madrid");
}

export function parseRiosTable(html: string): RiverRow[] {
  const out: RiverRow[] = [];
  for (const cells of rows(html)) {
    if (!/^\d+$/.test(text(cells[0] ?? ""))) continue;
    const chart = cells[8] ?? "";
    const g = chart.match(/grafica\/([0-9A-Z]+)/);
    out.push({
      number: text(cells[0]!),
      name: text(cells[1]!),
      levelM: numEs(text(cells[2]!)),
      flowM3s: numEs(text(cells[3]!)),
      grafica: g ? g[1]! : null,
    });
  }
  return out;
}

export function parseEmbalsesTable(html: string): ReservoirRow[] {
  const out: ReservoirRow[] = [];
  for (const cells of rows(html)) {
    if (!/^\d+$/.test(text(cells[0] ?? ""))) continue;
    const chart = cells[cells.length - 1] ?? "";
    const g = chart.match(/grafica\/([0-9A-Z]+)/);
    out.push({
      number: text(cells[0]!),
      name: text(cells[1]!),
      pct: numEs(text(cells[2]!)),
      hm3: numEs(text(cells[5]!)),
      grafica: g ? g[1]! : null,
    });
  }
  return out;
}

export interface Grafica {
  /** `R` río (nivel), `P` pluviómetro (lluvia), `E` embalse. */
  sensorTipo: string | null;
  points: HistoryPoint[];
}

/**
 * Gráfica por estación: `var labels = ["29/09/26 18:00", …]` (hora local) y
 * `var serie1 = […]`. Serie vacía = sin lluvia en 48 h, no un error.
 */
export function parseGrafica(html: string): Grafica | null {
  const tipo = html.match(/var sensorTipo\s*=\s*"([A-Z])"/)?.[1] ?? null;
  const labels = html.match(/var labels\s*=\s*\[(.*?)\];/s)?.[1] ?? "";
  const serie = html.match(/var serie1\s*=\s*\[(.*?)\];/s)?.[1] ?? "";
  // Serie vacía = sin lluvia en 48 h: objeto con cero puntos, no error. Sin
  // estructura de gráfica no hay nada que decir.
  if (!labels && !serie) return tipo ? { sensorTipo: tipo, points: [] } : null;
  const ts = [...labels.matchAll(/"(\d{2})\\?\/(\d{2})\\?\/(\d{2}) (\d{2}):(\d{2})"/g)].map((m) =>
    parseLocalIso(`20${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`, "Europe/Madrid"),
  );
  const values = serie
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map(Number)
    .filter((v) => Number.isFinite(v));
  const n = Math.min(ts.length, values.length);
  const points: HistoryPoint[] = [];
  for (let i = 0; i < n; i++) points.push({ ts: ts[i]!, value: values[i]! });
  return { sensorTipo: tipo, points };
}
