import { formatLocal } from "@talaia/shared";

/** Una muestra cincominutal del SAIH. `fecha` viene en UTC; `estado` 0 = normal, 128 = provisional. */
export interface SaihSample {
  valor: number | null;
  fecha: string;
  estado?: number;
}

export interface SaihClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Separación mínima entre peticiones (ms). */
  minIntervalMs?: number;
  timeoutMs?: number;
  /** Zona en la que el portal interpreta el rango de la URL. */
  timezone?: string;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

export class SaihError extends Error {
  constructor(
    message: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = "SaihError";
  }
}

/**
 * Cliente de los endpoints internos del SAIH Júcar (sin autenticación ni documentación).
 * Serializa las peticiones del proceso, respeta una separación mínima y reintenta una vez
 * ante error de red o 5xx.
 */
export class SaihClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly timezone: string;
  private readonly userAgent: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(opts: SaihClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://saih.chj.es";
    this.fetchFn = opts.fetch ?? fetch;
    this.minIntervalMs = opts.minIntervalMs ?? 300;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.timezone = opts.timezone ?? "Europe/Madrid";
    this.userAgent =
      opts.userAgent ?? "talaia/0.1 (+https://github.com/; portal personal de avisos)";
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** El portal interpreta el rango en hora local; la respuesta llega en UTC. */
  valuesUrl(externalId: string, from: Date, to: Date): string {
    const f = (d: Date) => encodeURIComponent(formatLocal(d, this.timezone));
    return `${this.baseUrl}/admin/variables/valor/${externalId}/${f(from)}/${f(to)}`;
  }

  async values(externalId: string, from: Date, to: Date): Promise<SaihSample[]> {
    const url = this.valuesUrl(externalId, from, to);
    const text = await this.getText(url);
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new SaihError(`respuesta no JSON: ${text.slice(0, 80)}`, url);
    }
    if (!Array.isArray(json)) throw new SaihError("se esperaba un array de muestras", url);
    return json as SaihSample[];
  }

  private getText(url: string): Promise<string> {
    const next = this.queue.then(async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      try {
        return await this.once(url);
      } catch (err) {
        if (!retriable(err)) throw err;
        await this.sleep(this.minIntervalMs);
        return this.once(url);
      }
    });
    this.queue = next.catch(() => undefined);
    return next.finally(() => {
      this.lastRequestAt = Date.now();
    });
  }

  private async once(url: string): Promise<string> {
    const res = await this.fetchFn(url, {
      headers: { accept: "application/json", "user-agent": this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new SaihError(`HTTP ${res.status}`, url);
    return res.text();
  }
}

/** Reintentamos una vez ante 5xx o fallo de red; nunca ante 4xx (contrato roto). */
function retriable(err: unknown): boolean {
  if (err instanceof SaihError) return /HTTP 5\d\d/.test(err.message);
  return true;
}
