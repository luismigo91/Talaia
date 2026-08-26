import type { GvaEmergencies } from "./parse.js";

/**
 * Cliente de la API pública del CCE 112 Comunitat Valenciana. Sin clave; sirve ficheros JSON
 * pregenerados por el widget del portal. Una petición por ciclo, `User-Agent` identificable.
 */
export interface GvaClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

export class GvaClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(opts: GvaClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://wpr.112cv.gva.es";
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.userAgent = opts.userAgent ?? "TalaiaBot/0.1 (portal personal de avisos de inundación)";
  }

  /** Emergencias / activaciones de planes de Protección Civil por zona. */
  async emergencies(): Promise<GvaEmergencies> {
    const url = `${this.baseUrl}/external/api/storage/descargar/json/emergencias`;
    const res = await this.fetchFn(url, {
      headers: { accept: "application/json", "user-agent": this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    return JSON.parse(await res.text()) as GvaEmergencies;
  }
}
