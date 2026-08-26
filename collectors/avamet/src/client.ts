/**
 * Cliente de AVAMET. No hay API: se leen las páginas públicas.
 *
 * Es el servidor de una asociación pequeña, así que el collector va de puntillas: una sola
 * petición por ciclo para toda la comarca, separación mínima entre peticiones y un
 * `User-Agent` identificable por si quieren localizarnos.
 */
export interface AvametClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  minIntervalMs?: number;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
}

export class AvametClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly userAgent: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(opts: AvametClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://www.avamet.org";
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 40_000;
    this.minIntervalMs = opts.minIntervalMs ?? 1_000;
    this.userAgent = opts.userAgent ?? "TalaiaBot/0.1 (portal personal de avisos de inundación)";
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Tabla de precipitación de una comarca (`c16` = l'Horta Sud): todas sus estaciones. */
  precipitation(territori: string): Promise<string> {
    return this.get(`/mxo-mxo-prec.php?territori=${encodeURIComponent(territori)}`);
  }

  /** Ficha técnica de una estación: de aquí salen sus coordenadas. */
  station(id: string): Promise<string> {
    return this.get(`/mx-fitxa.php?id=${encodeURIComponent(id)}`);
  }

  private get(path: string): Promise<string> {
    const next = this.queue.then(async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        headers: { accept: "text/html", "user-agent": this.userAgent },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
      return res.text();
    });
    this.queue = next.catch(() => undefined);
    return next.finally(() => {
      this.lastRequestAt = Date.now();
    });
  }
}
