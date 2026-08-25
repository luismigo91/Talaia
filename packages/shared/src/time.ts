/** Utilidades de tiempo. Toda la persistencia es UTC; la conversión desde hora local se hace aquí. */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Desfase (ms) de `tz` respecto a UTC en el instante `date`. */
export function tzOffsetMs(date: Date, tz: string): number {
  const parts = formatter(tz).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convierte una fecha-hora "de pared" en la zona `tz` a un instante UTC.
 * En la hora repetida del cambio de otoño devuelve la primera ocurrencia (horario de verano).
 */
export function localToUtc(
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
  s = 0,
  tz = "Europe/Madrid",
): Date {
  const guess = Date.UTC(y, m - 1, d, h, min, s);
  const off1 = tzOffsetMs(new Date(guess), tz);
  const candidate = guess - off1;
  const off2 = tzOffsetMs(new Date(candidate), tz);
  if (off1 === off2) return new Date(candidate);
  // Hora ambigua o inexistente: preferimos el desfase mayor (verano) si sigue siendo coherente.
  const alt = guess - off2;
  const offAlt = tzOffsetMs(new Date(alt), tz);
  if (offAlt === off2) return new Date(Math.min(candidate, alt));
  return new Date(candidate);
}

/** Parsea "YYYY-MM-DDTHH:MM:SS" (sin zona) como hora de pared en `tz`. */
export function parseLocalIso(iso: string, tz = "Europe/Madrid"): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso);
  if (!m) throw new Error(`Fecha local inválida: ${iso}`);
  return localToUtc(+m[1]!, +m[2]!, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), tz);
}

export function truncToHour(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 3_600_000) * 3_600_000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}
