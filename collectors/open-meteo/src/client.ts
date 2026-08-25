import { HOURLY, MODELS } from "./models.js";

export interface OpenMeteoLocation {
  lat: number;
  lon: number;
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  hourly_units?: Record<string, string>;
  hourly?: Record<string, (number | null)[] | string[]>;
}

export interface ModelMeta {
  last_run_initialisation_time: number;
  last_run_availability_time?: number;
  update_interval_seconds?: number;
}

export interface OpenMeteoClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  forecastDays?: number;
  timeoutMs?: number;
}

export class OpenMeteoClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly forecastDays: number;
  private readonly timeoutMs: number;

  constructor(opts: OpenMeteoClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.open-meteo.com";
    this.fetchFn = opts.fetch ?? fetch;
    this.forecastDays = opts.forecastDays ?? 3;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  forecastUrl(locations: OpenMeteoLocation[]): string {
    const p = new URLSearchParams({
      latitude: locations.map((l) => l.lat).join(","),
      longitude: locations.map((l) => l.lon).join(","),
      hourly: HOURLY.join(","),
      models: MODELS.map((m) => m.id).join(","),
      wind_speed_unit: "ms",
      timezone: "UTC",
      forecast_days: String(this.forecastDays),
    });
    return `${this.baseUrl}/v1/forecast?${p.toString()}`;
  }

  /** Una sola petición para todas las localizaciones; devuelve un array en el mismo orden. */
  async forecast(
    locations: OpenMeteoLocation[],
  ): Promise<{ url: string; body: string; data: OpenMeteoResponse[] }> {
    const url = this.forecastUrl(locations);
    const body = await this.getText(url);
    const json: unknown = JSON.parse(body);
    const data = Array.isArray(json) ? (json as OpenMeteoResponse[]) : [json as OpenMeteoResponse];
    if (data.length !== locations.length) {
      throw new Error(
        `Open-Meteo devolvió ${data.length} localizaciones, se esperaban ${locations.length}`,
      );
    }
    return { url, body, data };
  }

  async modelMeta(metaId: string): Promise<ModelMeta> {
    const body = await this.getText(`${this.baseUrl}/data/${metaId}/static/meta.json`);
    return JSON.parse(body) as ModelMeta;
  }

  private async getText(url: string): Promise<string> {
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    return res.text();
  }
}
