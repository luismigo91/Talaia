/** Aviso tal y como lo publica la API v1 de Meteoalarm (CAP 1.2 en JSON). */
export interface MeteoalarmFeed {
  warnings: { alert: MeteoalarmAlert; uuid?: string }[];
}

export interface MeteoalarmAlert {
  identifier: string;
  sender?: string;
  sent: string;
  msgType?: string;
  status?: string;
  info?: MeteoalarmInfo[];
}

export interface MeteoalarmInfo {
  language?: string;
  event?: string;
  headline?: string;
  description?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  onset?: string;
  expires?: string;
  effective?: string;
  senderName?: string;
  parameter?: { valueName: string; value: string }[];
  area?: { areaDesc?: string; geocode?: { valueName: string; value: string }[] }[];
}

export interface MeteoalarmClientOptions {
  url?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

/** Cliente del feed público de Meteoalarm: un GET, sin clave ni cuota. */
export class MeteoalarmClient {
  private readonly url: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(opts: MeteoalarmClientOptions = {}) {
    this.url = opts.url ?? "https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain";
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.userAgent = opts.userAgent ?? "talaia/0.1 (portal personal de avisos)";
  }

  async feed(): Promise<{ body: string; data: MeteoalarmFeed }> {
    const res = await this.fetchFn(this.url, {
      headers: { accept: "application/json", "user-agent": this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${this.url}`);
    const body = await res.text();
    const data = JSON.parse(body) as MeteoalarmFeed;
    if (!Array.isArray(data.warnings)) throw new Error("el feed no trae la lista `warnings`");
    return { body, data };
  }
}
