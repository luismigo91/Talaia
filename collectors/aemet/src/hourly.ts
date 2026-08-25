import { kmhToMs, parseLocalIso, parseNumeric, type ForecastRow } from "@talaia/shared";

/** Estructura mínima de la predicción horaria de AEMET (todos los valores son strings). */
export interface AemetHourly {
  elaborado: string;
  id: string | number;
  nombre?: string;
  prediccion: { dia: AemetDay[] };
}
interface PV {
  value?: string;
  periodo: string;
}
export interface AemetDay {
  fecha: string;
  precipitacion?: PV[];
  probPrecipitacion?: PV[];
  temperatura?: PV[];
  humedadRelativa?: PV[];
  vientoAndRachaMax?: ({ direccion?: string[]; velocidad?: string[]; periodo: string } | PV)[];
}

export interface HourlyParseOptions {
  stationId: string;
  tz?: string;
}

/**
 * Convierte la predicción horaria en filas del esquema común.
 * - `periodo` "07" es hora local; la precipitación de "07" cubre 06–07 → ts = 06:00 local (inicio de intervalo).
 * - Variables instantáneas (temperatura, humedad, viento) se guardan con ts = la hora local indicada.
 * - `probPrecipitacion` en tramos "HHHH" de 6 h → una fila por hora del tramo.
 * - Strings vacíos se omiten. Viento y racha en km/h → m/s.
 */
export function parseHourly(
  payload: AemetHourly[] | AemetHourly,
  opts: HourlyParseOptions,
): ForecastRow[] {
  const obj = Array.isArray(payload) ? payload[0] : payload;
  if (!obj) return [];
  const tz = opts.tz ?? "Europe/Madrid";
  const forecastTs = parseLocalIso(obj.elaborado, tz);
  const rows: ForecastRow[] = [];
  const push = (variable: string, unit: string, ts: Date, value: number | null) => {
    if (value === null) return;
    rows.push({
      source: "aemet",
      stationId: opts.stationId,
      variable,
      forecastTs,
      ts,
      value,
      unit,
    });
  };

  for (const day of obj.prediccion?.dia ?? []) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day.fecha);
    if (!m) continue;
    const [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!];
    const at = (hour: number) => parseLocalIso(`${y}-${pad(mo)}-${pad(d)}T${pad(hour)}:00:00`, tz);

    for (const p of day.precipitacion ?? []) {
      const h = hourOf(p.periodo);
      if (h === null) continue;
      push("precip_mm", "mm", at(h - 1), parseNumeric(p.value));
    }
    for (const p of day.probPrecipitacion ?? []) {
      const v = parseNumeric(p.value);
      const range = rangeOf(p.periodo);
      if (v === null || !range) continue;
      for (let h = range.start; h < range.end; h++) push("precip_prob_pct", "%", at(h), v);
    }
    for (const p of day.temperatura ?? []) {
      const h = hourOf(p.periodo);
      if (h !== null) push("temp_c", "°C", at(h), parseNumeric(p.value));
    }
    for (const p of day.humedadRelativa ?? []) {
      const h = hourOf(p.periodo);
      if (h !== null) push("rh_pct", "%", at(h), parseNumeric(p.value));
    }
    for (const p of day.vientoAndRachaMax ?? []) {
      const h = hourOf(p.periodo);
      if (h === null) continue;
      if ("velocidad" in p && p.velocidad) {
        const v = parseNumeric(p.velocidad[0]);
        if (v !== null) push("wind_ms", "m/s", at(h), kmhToMs(v));
      } else if ("value" in p) {
        const v = parseNumeric(p.value);
        if (v !== null) push("gust_ms", "m/s", at(h), kmhToMs(v));
      }
    }
  }
  return dedupe(rows);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "07" → 7; "24" → 24 (medianoche del día siguiente); otros → null */
function hourOf(periodo: string): number | null {
  if (!/^\d{2}$/.test(periodo)) return null;
  const h = Number(periodo);
  return h >= 0 && h <= 24 ? h : null;
}

/** "0713" → {start: 7, end: 13}; "1901" → {start: 19, end: 25} (cruza medianoche) */
function rangeOf(periodo: string): { start: number; end: number } | null {
  if (!/^\d{4}$/.test(periodo)) return null;
  const start = Number(periodo.slice(0, 2));
  let end = Number(periodo.slice(2));
  if (end <= start) end += 24;
  return { start, end };
}

/** En el cambio de hora de otoño AEMET puede repetir una hora local: nos quedamos con la primera. */
function dedupe(rows: ForecastRow[]): ForecastRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.variable}|${r.ts.getTime()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
