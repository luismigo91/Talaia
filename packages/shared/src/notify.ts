import { logger } from "./logger.js";
import type { RiskLevel } from "./risk.js";

export interface RiskNotification {
  stationId: string;
  stationName: string;
  level: RiskLevel;
  previousLevel: RiskLevel | null;
  direction: "subida" | "bajada";
  /** Frase del componente que manda ("80 m³/s ≥ 70 m³/s (naranja) en …"). */
  reason: string | null;
}

export interface Notifier {
  send(n: RiskNotification): Promise<void>;
}

/** Prioridad de ntfy según el nivel. Una vuelta a verde no debe vibrar como un rojo. */
export const PRIORITY: Record<RiskLevel, string> = {
  rojo: "urgent",
  naranja: "high",
  amarillo: "default",
  verde: "low",
};

const TAGS: Record<RiskLevel, string> = {
  rojo: "rotating_light",
  naranja: "warning",
  amarillo: "large_yellow_circle",
  verde: "white_check_mark",
};

export function notificationTitle(n: RiskNotification): string {
  return `${n.stationName}: ${n.level.toUpperCase()}`;
}

export function notificationBody(n: RiskNotification): string {
  const from = n.previousLevel ? ` (antes ${n.previousLevel})` : "";
  return `${n.stationName}: ${n.level.toUpperCase()}${from}${n.reason ? ` — ${n.reason}` : ""}`;
}

/** No hay canal configurado: se registra y sigue. Un homelab sin ntfy debe funcionar igual. */
export class NullNotifier implements Notifier {
  async send(n: RiskNotification): Promise<void> {
    logger.info({ notification: notificationBody(n) }, "riesgo: sin canal de notificación");
  }
}

export interface NtfyOptions {
  url: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Notificador ntfy: un POST con el cuerpo del aviso. Sin dependencias ni SDK. */
export class NtfyNotifier implements Notifier {
  private readonly url: string;
  private readonly token: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: NtfyOptions) {
    this.url = opts.url;
    this.token = opts.token;
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  async send(n: RiskNotification): Promise<void> {
    const headers: Record<string, string> = {
      Title: notificationTitle(n),
      Priority: PRIORITY[n.level],
      Tags: TAGS[n.level],
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await this.fetchFn(this.url, {
      method: "POST",
      headers,
      body: notificationBody(n),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`ntfy respondió HTTP ${res.status}`);
  }
}

/** Notificador según el entorno: ntfy si hay `NTFY_URL`, si no uno nulo. */
export function notifierFromEnv(env: NodeJS.ProcessEnv = process.env): Notifier {
  const url = env.NTFY_URL?.trim();
  if (!url) return new NullNotifier();
  return new NtfyNotifier({ url, ...(env.NTFY_TOKEN ? { token: env.NTFY_TOKEN } : {}) });
}
