/**
 * Cliente de la API de Talaia, siempre desde el servidor.
 *
 * El navegador nunca habla con la API: así solo el frontend necesita dominio en Dokploy, no
 * hay CORS y la API no queda expuesta. Las páginas son Server Components y pasan los datos
 * ya resueltos a los componentes de cliente.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:3000";

/** Segundos de caché. El dato de fondo se mueve cada 5–10 min; 60 s es suficiente. */
export const REVALIDATE = Number(process.env.API_REVALIDATE_SECONDS ?? 60);

export type Level = "verde" | "amarillo" | "naranja" | "rojo";

export interface RiskComponent {
  kind: "flow" | "reservoir" | "rain_observed" | "rain_forecast" | "alert";
  level: Level;
  value: number | null;
  unit: string | null;
  threshold: number | null;
  source: string | null;
  detail: string;
}

export interface StationRisk {
  station: { id: string; name: string; lat: number; lon: number; primary: boolean };
  level: Level;
  components: RiskComponent[];
  alerts: {
    id: string;
    source: string;
    level: string;
    event: string | null;
    event_code: string | null;
    expires: string;
    counts: boolean;
  }[];
  warnings: string[];
  stale: boolean;
  computed_at: string;
}

export interface RiskEvent {
  id: number;
  station: { id: string; name: string };
  ts: string;
  level: Level;
  previous_level: Level | null;
  direction: "subida" | "bajada";
  notified: boolean;
}

export interface Sensor {
  id: string;
  source: string;
  external_id: string;
  variable: string;
  unit: string;
  station: { id: string; name: string; lat: number; lon: number };
  thresholds: { low: number | null; mid: number | null; high: number | null };
  last_value: number | null;
  last_ts: string | null;
  age_seconds: number | null;
  level: Level | null;
  note: string | null;
}

export interface CompareSeries {
  source: string;
  name: string;
  forecast_ts: string;
  total: number | null;
  max_hourly: number | null;
  points: { ts: string; value: number }[];
}

export interface Compare {
  station: { id: string; name: string; lat: number; lon: number };
  variable: string;
  unit: string | null;
  from: string;
  to: string;
  series: CompareSeries[];
  summary: {
    sources: number;
    min_total: number | null;
    median_total: number | null;
    max_total: number | null;
  };
}

export interface Alert {
  id: string;
  source: string;
  zone: string;
  zone_name: string | null;
  stations: string[];
  event: string | null;
  event_code: string | null;
  level: string;
  severity: string | null;
  parameter: string | null;
  onset: string;
  expires: string;
  active: boolean;
  headline: string | null;
  description: string | null;
}

export interface ObservationSeries {
  sensor: {
    id: string;
    source: string;
    variable: string;
    unit: string;
    station: { id: string; name: string };
    thresholds: { low: number | null; mid: number | null; high: number | null };
  };
  from: string;
  hours: number;
  summary: { points: number; last: number | null; max: number | null; level: Level | null };
  points: { ts: string; value: number | null; quality: number | null }[];
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  ine: string | null;
  aemet_zone: string | null;
  primary: boolean;
}

export interface Verify {
  station: { id: string; name: string; lat: number; lon: number };
  tz: string;
  days_requested: number;
  from: string;
  to: string;
  gauges: { station_id: string; name: string }[];
  models: { source: string; name: string }[];
  days: {
    day: string;
    observed_mm: number | null;
    predictions: { source: string; mm: number | null }[];
  }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate: REVALIDATE },
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new ApiError(`La API respondió ${res.status} en ${path}`, res.status);
  return (await res.json()) as T;
}

export const getRisk = () =>
  get<{ stations: StationRisk[] }>("/api/v1/risk").then((r) => r.stations);
export const getHistory = (limit = 12) =>
  get<{ events: RiskEvent[] }>(`/api/v1/risk/history?limit=${limit}`).then((r) => r.events);
export const getSensors = () =>
  get<{ sensors: Sensor[] }>("/api/v1/sensors").then((r) => r.sensors);
export const getStations = () =>
  get<{ stations: Station[] }>("/api/v1/stations").then((r) => r.stations);
export const getAlerts = (active = true) =>
  get<{ alerts: Alert[] }>(`/api/v1/alerts?active=${active}`).then((r) => r.alerts);
export const getObservations = (sensor: string, hours = 24) =>
  get<ObservationSeries>(
    `/api/v1/observations?sensor=${encodeURIComponent(sensor)}&hours=${hours}`,
  );
export const getCompare = (station: string, variable: string, hours = 24) =>
  get<Compare>(
    `/api/v1/compare?station=${encodeURIComponent(station)}&variable=${encodeURIComponent(variable)}&hours=${hours}`,
  );

export const getVerify = (station: string, days = 7) =>
  get<Verify>(`/api/v1/verify?station=${encodeURIComponent(station)}&days=${days}`);

/** Envuelve una carga para que un fallo de la API no tumbe la página entera. */
export async function safe<T>(fn: () => Promise<T>): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await fn() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
