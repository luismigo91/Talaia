/** Variables canónicas y sus unidades. */
export const VARIABLES = {
  precip_mm: "mm",
  precip_prob_pct: "%",
  precip_rate_mmh: "mm/h",
  precip_1h_mm: "mm",
  precip_12h_mm: "mm",
  precip_24h_mm: "mm",
  precip_day_mm: "mm",
  temp_c: "°C",
  rh_pct: "%",
  wind_ms: "m/s",
  gust_ms: "m/s",
  wind_dir_deg: "°",
  pressure_hpa: "hPa",
  cape_jkg: "J/kg",
  river_level_m: "m",
  river_flow_m3s: "m³/s",
  reservoir_hm3: "hm³",
  reservoir_level_m: "m",
  reservoir_pct: "%",
} as const;

export type Variable = keyof typeof VARIABLES;

export const kmhToMs = (kmh: number): number => Math.round((kmh / 3.6) * 100) / 100;

/** Convierte un string numérico de AEMET ("1.4", "", "Ip") a número o null. */
export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
