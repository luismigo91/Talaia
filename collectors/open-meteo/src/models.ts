/** Modelos de Open-Meteo que cubren las localizaciones objetivo (verificado 25-08-2026). */
export interface ModelSpec {
  /** id del parámetro `models` */
  id: string;
  /** id en /data/{meta}/static/meta.json (null para modelos virtuales) */
  meta: string | null;
}

export const MODELS: ModelSpec[] = [
  { id: "meteofrance_arome_france_hd", meta: "meteofrance_arome_france_hd" },
  { id: "icon_eu", meta: "dwd_icon_eu" },
  { id: "ecmwf_ifs", meta: "ecmwf_ifs" },
  { id: "gfs_seamless", meta: "ncep_gfs013" },
  { id: "arpege_europe", meta: "meteofrance_arpege_europe" },
  { id: "ukmo_global_deterministic_10km", meta: "ukmo_global_deterministic_10km" },
];

/** Variable Open-Meteo → variable canónica. `accumulated` = el valor en T cubre la hora anterior. */
export const VARIABLE_MAP: Record<
  string,
  { variable: string; unit: string; accumulated: boolean }
> = {
  precipitation: { variable: "precip_mm", unit: "mm", accumulated: true },
  precipitation_probability: { variable: "precip_prob_pct", unit: "%", accumulated: false },
  temperature_2m: { variable: "temp_c", unit: "°C", accumulated: false },
  relative_humidity_2m: { variable: "rh_pct", unit: "%", accumulated: false },
  wind_speed_10m: { variable: "wind_ms", unit: "m/s", accumulated: false },
  wind_gusts_10m: { variable: "gust_ms", unit: "m/s", accumulated: false },
  cape: { variable: "cape_jkg", unit: "J/kg", accumulated: false },
};

export const HOURLY = Object.keys(VARIABLE_MAP);
export const sourceId = (modelId: string) => `open-meteo:${modelId}`;
