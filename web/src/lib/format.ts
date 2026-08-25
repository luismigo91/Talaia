import type { Level, StationRisk } from "./api.js";

/** Orden de gravedad. Se usa para ordenar y para comparar niveles. */
export const LEVEL_ORDER: Level[] = ["verde", "amarillo", "naranja", "rojo"];
export const rank = (l: Level) => LEVEL_ORDER.indexOf(l);

/**
 * Las localizaciones se ordenan por riesgo descendente; a igualdad, primero la principal
 * y luego por nombre. Lo que está peor tiene que verse antes, sin buscarlo.
 */
export function byRisk(a: StationRisk, b: StationRisk): number {
  const d = rank(b.level) - rank(a.level);
  if (d !== 0) return d;
  if (a.station.primary !== b.station.primary) return a.station.primary ? -1 : 1;
  return a.station.name.localeCompare(b.station.name, "es");
}

const TZ = "Europe/Madrid";

/** Hora local de Madrid: la persistencia es UTC, la presentación no. */
export function timeMadrid(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/**
 * "16/01 00:30". Se compone a mano desde las partes porque `Intl` normaliza el mes a un
 * dígito en `es-ES`, y en una tabla las columnas tienen que quedar alineadas.
 */
export function dateTimeMadrid(iso: string): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? "").padStart(2, "0");
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

/** "hace 5 min", "hace 2 h". Para la frescura, que es tan importante como el dato. */
export function ago(seconds: number | null): string {
  if (seconds === null) return "sin datos";
  if (seconds < 90) return "hace un momento";
  const min = Math.round(seconds / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return "sin datos";
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${value.toFixed(decimals).replace(".", ",")}${unit ? ` ${unit}` : ""}`;
}

export const KIND_LABEL: Record<string, string> = {
  flow: "Caudal",
  reservoir: "Embalse",
  rain_observed: "Lluvia observada",
  rain_forecast: "Lluvia prevista",
  alert: "Aviso oficial",
};

export const VARIABLE_LABEL: Record<string, string> = {
  precip_mm: "Precipitación",
  precip_prob_pct: "Probabilidad de precipitación",
  temp_c: "Temperatura",
  rh_pct: "Humedad relativa",
  wind_ms: "Viento",
  gust_ms: "Racha máxima",
  cape_jkg: "CAPE",
  river_flow_m3s: "Caudal",
  river_level_m: "Nivel",
  reservoir_hm3: "Volumen embalsado",
  reservoir_level_m: "Cota del embalse",
  precip_rate_mmh: "Intensidad de lluvia",
  precip_24h_mm: "Lluvia acumulada 24 h",
};

export const label = (map: Record<string, string>, key: string) => map[key] ?? key;
