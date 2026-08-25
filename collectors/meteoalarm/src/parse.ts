import type { AlertRow } from "@talaia/shared";
import type { MeteoalarmAlert, MeteoalarmFeed, MeteoalarmInfo } from "./client.js";
import { EMMA_TO_AEMET_ZONE, zoneFromIdentifier } from "./zones.js";

export const SOURCE = "meteoalarm";

/** `awareness_level` de Meteoalarm → vocabulario de AEMET. */
export const LEVELS: Record<string, AlertRow["level"]> = {
  green: "verde",
  yellow: "amarillo",
  orange: "naranja",
  red: "rojo",
};

/**
 * `awareness_type` de Meteoalarm → `event_code` de AEMET, para que el semáforo siga
 * razonando con los códigos de AEMET (`PR`, `TO`, `IN`…) sin saber que Meteoalarm existe.
 */
export const EVENT_CODES: Record<string, string> = {
  "1": "VI", // Wind
  "2": "NE", // snow-ice
  "3": "TO", // Thunderstorm
  "4": "NI", // Fog
  "5": "AT", // high temperature
  "6": "BT", // low temperature
  "7": "CO", // coastal event
  "8": "IF", // forest fire
  "9": "AL", // avalanches
  "10": "PR", // Rain
  "11": "IN", // flood
  "12": "IN", // rain-flood
  "13": "PO", // dust/sand
};

/** Meteoalarm publica sus parámetros como "código; etiqueta; …" (p. ej. "2; yellow; Moderate"). */
export function parseAwareness(value: string | undefined): { code: string; label: string } {
  const parts = (value ?? "").split(";").map((p) => p.trim());
  return { code: parts[0] ?? "", label: (parts[1] ?? "").toLowerCase() };
}

/** Bloque en español; si no hay, el primero disponible. */
export function pickInfo(alert: MeteoalarmAlert): MeteoalarmInfo | undefined {
  const infos = alert.info ?? [];
  return infos.find((i) => (i.language ?? "").toLowerCase().startsWith("es")) ?? infos[0];
}

/**
 * Convierte el feed en filas de `alerts`, quedándose con las zonas pedidas.
 * Los avisos verdes se descartan: "sin aviso" no es un aviso.
 */
export function parseFeed(feed: MeteoalarmFeed, zones: Set<string>): AlertRow[] {
  const rows: AlertRow[] = [];
  for (const { alert } of feed.warnings ?? []) {
    const info = pickInfo(alert);
    if (!info) continue;
    const params = new Map((info.parameter ?? []).map((p) => [p.valueName, p.value]));
    const level = LEVELS[parseAwareness(params.get("awareness_level")).label];
    if (!level || level === "verde") continue;
    const type = parseAwareness(params.get("awareness_type"));
    const eventCode = EVENT_CODES[type.code] ?? null;
    const onset = date(info.onset ?? info.effective);
    const expires = date(info.expires);
    const sent = date(alert.sent);
    if (!onset || !expires || !sent) continue;

    const seen = new Set<string>();
    for (const area of info.area ?? []) {
      const emma = area.geocode?.find((g) => g.valueName === "EMMA_ID")?.value;
      const zone =
        (emma ? EMMA_TO_AEMET_ZONE[emma] : undefined) ?? zoneFromIdentifier(alert.identifier);
      if (!zone || !zones.has(zone) || seen.has(zone)) continue;
      seen.add(zone);
      rows.push({
        id: `${SOURCE}:${alert.identifier}#${zone}`,
        source: SOURCE,
        areaCode: zone,
        areaName: area.areaDesc ?? null,
        eventCode,
        event: info.event ?? null,
        level,
        severity: info.severity ?? null,
        parameter: params.get("awareness_type") ?? null,
        onset,
        expires,
        sent,
        headline: info.headline ?? null,
        description: info.description ?? null,
        raw: {
          identifier: alert.identifier,
          msgType: alert.msgType,
          emma_id: emma,
          awareness_level: params.get("awareness_level"),
          awareness_type: params.get("awareness_type"),
          senderName: info.senderName,
        },
        updatedAt: new Date(),
      });
    }
  }
  return rows;
}

function date(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
