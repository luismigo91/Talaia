import { parseLocalIso, type AlertRow } from "@talaia/shared";

export const SOURCE = "gva";

/** Respuesta del endpoint `emergencias`. `z2` mapea zona de emergencia → avisos activos. */
export interface GvaEmergencies {
  t?: number;
  time?: string;
  desEs?: string;
  desVa?: string;
  isFileAH?: boolean;
  z2?: Record<string, { sit: number; fen: number }[]>;
}

/**
 * Fase del plan de emergencias → nivel del semáforo (catálogo `situacion`, verificado
 * 26-08-2026). Situación 0 es preemergencia (vigilancia); 2 y 3, emergencia grave.
 * El escalón concreto es una decisión de Talaia, ajustable: la GVA no da color a las fases.
 */
export const SITUACION_LEVEL: Record<number, AlertRow["level"]> = {
  14: "amarillo", // SITUACIÓN 0 (preemergencia)
  15: "naranja", // SITUACIÓN 1
  16: "rojo", // SITUACIÓN 2
  17: "rojo", // SITUACIÓN 3
  // Por si el endpoint colara niveles meteo (10-13):
  10: "verde",
  11: "amarillo",
  12: "naranja",
  13: "rojo",
};

/** Fenómeno de la GVA → `event_code` de AEMET, para que el filtro de inundación funcione igual. */
export const FENOMENO_EVENT_CODE: Record<number, string> = {
  10: "IN", // Inundaciones
  15: "TO", // Tormentas
  11: "VI", // Vientos
  14: "CO", // Fenómenos costeros
  12: "NE", // Nevadas
  13: "NE", // Placas de hielo
  16: "AT", // Temperaturas máximas
  17: "BT", // Temperaturas mínimas
  18: "NI", // Nieblas
  19: "IN", // Tsunamis (costero-inundación)
};

export const SITUACION_LABEL: Record<number, string> = {
  14: "Situación 0",
  15: "Situación 1",
  16: "Situación 2",
  17: "Situación 3",
};

export const FENOMENO_LABEL: Record<number, string> = {
  10: "Inundaciones",
  15: "Tormentas",
  11: "Vientos",
  14: "Fenómenos costeros",
  12: "Nevadas",
  13: "Placas de hielo",
  16: "Temperaturas máximas",
  17: "Temperaturas mínimas",
  18: "Nieblas",
  19: "Tsunamis",
};

export interface ParseOptions {
  /** Zonas de emergencia que interesan (comarcas + comodín provincial). */
  zones: Set<string>;
  /** Instante del ciclo, para la vigencia (la GVA no da fecha de fin por aviso). */
  now: Date;
  /** Minutos que se considera vigente un aviso desde la última vez que se vio. */
  ttlMinutes: number;
}

/**
 * Convierte la respuesta en filas de `alerts`, quedándose con las zonas pedidas.
 *
 * La GVA no publica fecha de fin: la vigencia se infiere de que el aviso siga apareciendo. Por
 * eso `expires` se fija a `now + ttl`: cada ciclo lo refresca mientras el aviso siga activo, y
 * cuando desaparece de `z2` caduca solo. `onset` es el `time` global de la respuesta.
 */
export function parseEmergencies(feed: GvaEmergencies, opts: ParseOptions): AlertRow[] {
  const z2 = feed.z2;
  if (!z2) return [];
  const onset = feed.time ? parseGvaTime(feed.time) : opts.now;
  const expires = new Date(opts.now.getTime() + opts.ttlMinutes * 60_000);
  const rows: AlertRow[] = [];

  for (const [zone, items] of Object.entries(z2)) {
    if (!opts.zones.has(zone) || !Array.isArray(items)) continue;
    for (const item of items) {
      const level = SITUACION_LEVEL[item.sit];
      if (!level || level === "verde") continue;
      const eventCode = FENOMENO_EVENT_CODE[item.fen] ?? null;
      const fenomeno = FENOMENO_LABEL[item.fen] ?? `fenómeno ${item.fen}`;
      const situacion = SITUACION_LABEL[item.sit] ?? `situación ${item.sit}`;
      rows.push({
        id: `${SOURCE}:${zone}:${item.fen}:${item.sit}`,
        source: SOURCE,
        areaCode: zone,
        areaName: null,
        eventCode,
        event: `${situacion} por ${fenomeno}`,
        level,
        severity: null,
        parameter: null,
        onset: onset ?? opts.now,
        expires,
        sent: opts.now,
        headline: stripHtml(feed.desEs) || null,
        description: null,
        raw: { zone, sit: item.sit, fen: item.fen, time: feed.time, isFileAH: feed.isFileAH },
        updatedAt: opts.now,
      });
    }
  }
  return rows;
}

/** "2026-10-29 12:00:00.0" (hora local de Madrid) → instante UTC. */
export function parseGvaTime(text: string, tz = "Europe/Madrid"): Date | undefined {
  const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return undefined;
  try {
    return parseLocalIso(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`, tz);
  } catch {
    return undefined;
  }
}

const stripHtml = (html: string | undefined) =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
