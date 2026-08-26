import { readFileSync } from "node:fs";
import iconv from "iconv-lite";

export class AemetError extends Error {
  constructor(
    message: string,
    public readonly estado: number | undefined,
    public readonly url: string,
  ) {
    super(message);
    this.name = "AemetError";
  }
}

export interface AemetClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Separación mínima entre peticiones (ms). 1600 ≈ 37/min, bajo el límite de 40/min. */
  minIntervalMs?: number;
  /** Espera antes del único reintento tras un 429 (ms). */
  retryAfterMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface Step1 {
  descripcion?: string;
  estado?: number;
  datos?: string;
  metadatos?: string;
}

/** Lee la clave: fichero (`AEMET_API_KEY_FILE`, secret) o variable `AEMET_API_KEY`. */
export function resolveApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const file = env.AEMET_API_KEY_FILE;
  if (file) {
    try {
      const k = readFileSync(file, "utf8").trim();
      if (k) return k;
    } catch {
      /* sin fichero: probamos la variable */
    }
  }
  const k = env.AEMET_API_KEY?.trim();
  return k || undefined;
}

/**
 * Cliente de AEMET OpenData: mecanismo de dos pasos, decodificación según charset
 * (fallback ISO-8859-15), limitador de cuota y reintento único ante 429.
 */
export class AemetClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly retryAfterMs: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(opts: AemetClientOptions = {}) {
    const key = opts.apiKey ?? resolveApiKey();
    if (!key)
      throw new AemetError(
        "falta la clave de AEMET (AEMET_API_KEY o AEMET_API_KEY_FILE)",
        undefined,
        "",
      );
    this.apiKey = key;
    this.baseUrl = opts.baseUrl ?? "https://opendata.aemet.es/opendata";
    this.fetchFn = opts.fetch ?? fetch;
    this.minIntervalMs = opts.minIntervalMs ?? 1600;
    this.retryAfterMs = opts.retryAfterMs ?? 61_000;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Descarga un recurso (paso 1 + paso 2) y devuelve los bytes de `datos`. */
  async getBytes(path: string): Promise<Buffer> {
    const url = `${this.baseUrl}${path}`;
    const step1 = await this.request(url, true);
    const text = step1.body.toString("utf8").trim();
    if (!text)
      throw new AemetError(
        "respuesta vacía de AEMET (¿clave inválida o servicio caído?)",
        undefined,
        url,
      );
    let json: Step1;
    try {
      json = JSON.parse(text) as Step1;
    } catch {
      throw new AemetError(`respuesta no JSON de AEMET: ${text.slice(0, 80)}`, undefined, url);
    }
    if (json.estado !== 200 || !json.datos) {
      throw new AemetError(
        `AEMET estado ${json.estado ?? "?"}: ${json.descripcion ?? ""}`.trim(),
        json.estado,
        url,
      );
    }
    const step2 = await this.request(json.datos, false);
    if (step2.body.length === 0) throw new AemetError("datos vacíos", undefined, json.datos);
    return step2.body;
  }

  /** Descarga y decodifica como texto según el charset de la respuesta (fallback ISO-8859-15). */
  async getText(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const step1 = await this.request(url, true);
    const text = step1.body.toString("utf8").trim();
    if (!text)
      throw new AemetError(
        "respuesta vacía de AEMET (¿clave inválida o servicio caído?)",
        undefined,
        url,
      );
    let json: Step1;
    try {
      json = JSON.parse(text) as Step1;
    } catch {
      throw new AemetError(`respuesta no JSON de AEMET: ${text.slice(0, 80)}`, undefined, url);
    }
    if (json.estado !== 200 || !json.datos) {
      throw new AemetError(
        `AEMET estado ${json.estado ?? "?"}: ${json.descripcion ?? ""}`.trim(),
        json.estado,
        url,
      );
    }
    const step2 = await this.request(json.datos, false);
    const decoded = decodeBody(step2.body, step2.contentType);
    if (!decoded.trim()) throw new AemetError("datos vacíos", undefined, json.datos);
    return decoded;
  }

  private request(
    url: string,
    withKey: boolean,
  ): Promise<{ body: Buffer; contentType: string | null }> {
    // Serializa todas las peticiones del proceso y respeta la separación mínima.
    const next = this.queue.then(async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      let res = await this.doFetch(url, withKey);
      if (res.status === 429) {
        await this.sleep(this.retryAfterMs);
        res = await this.doFetch(url, withKey);
        if (res.status === 429) throw new AemetError("cuota de AEMET excedida (429)", 429, url);
      }
      const body = Buffer.from(await res.arrayBuffer());
      if (!res.ok) {
        // AEMET a veces devuelve el JSON de error con status HTTP distinto: lo dejamos al llamador si es 200.
        let estado: number | undefined;
        try {
          estado = (JSON.parse(body.toString("utf8")) as Step1).estado;
        } catch {
          /* no JSON */
        }
        throw new AemetError(`HTTP ${res.status} en ${url}`, estado ?? res.status, url);
      }
      return { body, contentType: res.headers.get("content-type") };
    });
    this.queue = next.catch(() => undefined);
    return next.finally(() => {
      this.lastRequestAt = Date.now();
    });
  }

  private doFetch(url: string, withKey: boolean): Promise<Response> {
    const headers: Record<string, string> = { accept: "application/json, */*" };
    if (withKey) headers.api_key = this.apiKey;
    return this.fetchFn(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
  }
}

export function decodeBody(body: Buffer, contentType: string | null): string {
  const m = /charset=([\w-]+)/i.exec(contentType ?? "");
  const charset = (m?.[1] ?? "ISO-8859-15").toLowerCase();
  if (charset === "utf-8" || charset === "utf8") return body.toString("utf8");
  return iconv.decode(body, iconv.encodingExists(charset) ? charset : "ISO-8859-15");
}

export const endpoints = {
  hourly: (ine: string) => `/api/prediccion/especifica/municipio/horaria/${ine}`,
  capLatest: (area: string) => `/api/avisos_cap/ultimoelaborado/area/${area}`,
  /** Últimas 12 h de una estación automática. */
  observation: (idema: string) => `/api/observacion/convencional/datos/estacion/${idema}`,
};
