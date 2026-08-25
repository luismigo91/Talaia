/** Preferencia entre fuentes cuando publican el mismo aviso: AEMET es el origen. */
export const ALERT_SOURCE_PRIORITY = ["aemet", "meteoalarm"] as const;

export interface DedupableAlert {
  source: string;
  areaCode: string;
  eventCode: string | null;
  level: string;
  onset: Date | string;
  expires: Date | string;
}

const priority = (source: string) => {
  const i = (ALERT_SOURCE_PRIORITY as readonly string[]).indexOf(source);
  return i === -1 ? ALERT_SOURCE_PRIORITY.length : i;
};

const key = (a: DedupableAlert) =>
  [
    a.areaCode,
    a.eventCode ?? "",
    a.level,
    new Date(a.onset).toISOString(),
    new Date(a.expires).toISOString(),
  ].join("|");

/**
 * Deduplica avisos equivalentes publicados por varias fuentes.
 *
 * AEMET y Meteoalarm no comparten el formato del `identifier`, así que la misma alerta cae en
 * filas distintas: se resuelve al leer, por la clave lógica (zona, tipo, nivel, vigencia),
 * prefiriendo AEMET, que es el origen y el único que trae polígonos. Hacerlo al escribir
 * ataría el resultado al orden en que corren los collectors.
 */
export function dedupeAlerts<T extends DedupableAlert>(alerts: T[]): T[] {
  const best = new Map<string, T>();
  for (const a of alerts) {
    const k = key(a);
    const current = best.get(k);
    if (!current || priority(a.source) < priority(current.source)) best.set(k, a);
  }
  return [...best.values()];
}
