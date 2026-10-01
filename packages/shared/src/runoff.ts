import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { plausibleSeries, type Sample } from "./plausibility.js";
import { maxFlowJump } from "./risk-eval.js";

/**
 * Relación lluvia‑caudal empírica para cuencas de respuesta rápida.
 *
 * No es un modelo hidrológico: es la relación observada entre la lluvia media de la cabecera
 * acumulada en una ventana y el caudal que apareció en el aforo un rato después. Sirve para
 * decir "con lo que ha caído, cabe esperar X m³/s dentro de N minutos", que es justo lo que el
 * aforo no puede decir hasta que el agua ya está ahí.
 */
export interface RunoffModelSpec {
  id: string;
  stationId: string;
  flowSensorId: string;
  rainSensorIds: string[];
  windowHours: number;
  lagMinutes: number;
  coefA: number;
  coefB: number;
  /** Lluvia media mínima en la ventana para emitir la proyección. */
  minRainMm: number;
  enabled: boolean;
  meta: Record<string, unknown>;
}

export async function loadRunoffModels(db: Db, stationId?: string): Promise<RunoffModelSpec[]> {
  const rows = await db.execute<{
    id: string;
    station_id: string;
    flow_sensor_id: string;
    rain_sensor_ids: string[];
    window_hours: number | string;
    lag_minutes: number | string;
    coef_a: number | string;
    coef_b: number | string;
    min_rain_mm: number | string;
    enabled: boolean;
    meta: Record<string, unknown>;
  }>(sql`
    select id, station_id, flow_sensor_id, rain_sensor_ids, window_hours, lag_minutes,
           coef_a, coef_b, min_rain_mm, enabled, meta
    from runoff_models
    where enabled ${stationId ? sql`and station_id = ${stationId}` : sql``}
    order by station_id, id
  `);
  return rows.map((r) => ({
    id: r.id,
    stationId: r.station_id,
    flowSensorId: r.flow_sensor_id,
    // El cliente va con fetch_types:false: los arrays llegan como texto `{a,b}`.
    rainSensorIds: Array.isArray(r.rain_sensor_ids)
      ? r.rain_sensor_ids
      : String(r.rain_sensor_ids)
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((s) => s.replace(/^"|"$/g, "").trim())
          .filter(Boolean),
    windowHours: Number(r.window_hours),
    lagMinutes: Number(r.lag_minutes),
    coefA: Number(r.coef_a),
    coefB: Number(r.coef_b),
    minRainMm: Number(r.min_rain_mm),
    enabled: r.enabled,
    meta: r.meta ?? {},
  }));
}

/** Caudal proyectado para una lluvia media de cabecera acumulada en la ventana del modelo. */
export function projectFlow(
  model: Pick<RunoffModelSpec, "coefA" | "coefB">,
  rainMm: number,
): number {
  if (rainMm <= 0) return 0;
  return model.coefA * Math.pow(rainMm, model.coefB);
}

// ---------------------------------------------------------------------------------------------
// Ajuste sobre histórico
// ---------------------------------------------------------------------------------------------

export interface HourlyRain {
  /** Inicio de la hora (UTC). */
  ts: Date;
  mm: number;
}

export interface RunoffFit {
  /** Retardo con mayor correlación lluvia→caudal, en minutos (múltiplo de 60). */
  lagMinutes: number | null;
  /** Correlación (Pearson) en ese retardo. */
  lagCorrelation: number | null;
  /** Horas con lluvia apreciable en la ventana. */
  rainyHours: number;
  /** De esas, horas en las que el aforo sí respondió (Q ≥ minFlow). */
  respondingHours: number;
  /** Pares usados en el ajuste (= respondingHours). */
  n: number;
  /** Mayor caudal entre las horas con respuesta: el rango que el ajuste conoce de verdad. */
  peakFlow: number | null;
  coefA: number | null;
  coefB: number | null;
  r2: number | null;
  /** Episodios (rachas de horas con lluvia apreciable separadas ≥ 6 h) y su respuesta. */
  episodes: { start: string; end: string; rainMm: number; peakFlow: number }[];
  /** Muestras de caudal descartadas por implausibles. */
  discardedFlowSamples: number;
}

export interface FitOptions {
  windowHours: number;
  /** Lluvia media mínima en la ventana para que una hora cuente como "con lluvia". */
  minRainMm?: number;
  /** Caudal mínimo para que una hora cuente como respuesta del aforo. */
  minFlowM3s?: number;
  maxLagHours?: number;
  maxJump?: number;
}

/**
 * Lluvia media horaria de la cabecera: media entre los pluviómetros que tienen dato esa hora.
 * Media y no máximo porque el caudal responde a lo que cae en toda la cuenca; el máximo ya lo
 * vigila la señal de lluvia observada por su cuenta.
 */
export function basinRainHourly(byGauge: HourlyRain[][]): HourlyRain[] {
  const acc = new Map<number, { sum: number; n: number }>();
  for (const serie of byGauge) {
    for (const p of serie) {
      const k = p.ts.getTime();
      const cur = acc.get(k) ?? { sum: 0, n: 0 };
      cur.sum += p.mm;
      cur.n += 1;
      acc.set(k, cur);
    }
  }
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => ({ ts: new Date(k), mm: v.sum / v.n }));
}

/** Acumulado móvil de `windowHours` horas terminando en cada hora (inclusive). */
export function accumulate(hourly: HourlyRain[], windowHours: number): HourlyRain[] {
  const byHour = new Map(hourly.map((p) => [p.ts.getTime(), p.mm]));
  return hourly.map((p) => {
    let sum = 0;
    for (let i = 0; i < windowHours; i++) {
      sum += byHour.get(p.ts.getTime() - i * 3_600_000) ?? 0;
    }
    return { ts: p.ts, mm: sum };
  });
}

/** Máximo de caudal por hora sobre la serie ya depurada. */
export function hourlyMaxFlow(samples: Sample[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of samples) {
    const h = Math.floor(s.ts.getTime() / 3_600_000) * 3_600_000;
    out.set(h, Math.max(out.get(h) ?? -Infinity, s.value));
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Ajusta la relación sobre histórico. Devuelve siempre el diagnóstico aunque no haya ajuste
 * posible: que el aforo no haya respondido nunca a la lluvia es un resultado, no un error.
 */
export function fitRunoff(
  flow: Sample[],
  rainByGauge: HourlyRain[][],
  opts: FitOptions,
): RunoffFit {
  const minRain = opts.minRainMm ?? 5;
  const minFlow = opts.minFlowM3s ?? 0.5;
  const maxLag = opts.maxLagHours ?? 6;
  const clean = plausibleSeries(flow, { maxJump: opts.maxJump ?? maxFlowJump() });
  const qByHour = hourlyMaxFlow(clean);
  const rain = accumulate(basinRainHourly(rainByGauge), opts.windowHours);
  const rainy = rain.filter((p) => p.mm >= minRain);

  // Retardo: el que maximiza la correlación entre lluvia acumulada y caudal L horas después.
  let best: { lag: number; r: number } | null = null;
  for (let lag = 0; lag <= maxLag; lag++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of rainy) {
      const q = qByHour.get(p.ts.getTime() + lag * 3_600_000);
      if (q === undefined) continue;
      xs.push(p.mm);
      ys.push(q);
    }
    const r = pearson(xs, ys);
    if (r !== null && (best === null || r > best.r)) best = { lag, r };
  }

  // Ajuste log-log con el retardo elegido, solo donde el aforo respondió.
  const lagH = best?.lag ?? 0;
  const lx: number[] = [];
  const ly: number[] = [];
  let responding = 0;
  let peakFlow: number | null = null;
  for (const p of rainy) {
    const q = qByHour.get(p.ts.getTime() + lagH * 3_600_000);
    if (q === undefined || q < minFlow) continue;
    responding++;
    peakFlow = Math.max(peakFlow ?? 0, q);
    lx.push(Math.log(p.mm));
    ly.push(Math.log(q));
  }
  let coefA: number | null = null;
  let coefB: number | null = null;
  let r2: number | null = null;
  if (lx.length >= 3) {
    const n = lx.length;
    const mx = lx.reduce((a, b) => a + b, 0) / n;
    const my = ly.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (lx[i]! - mx) * (ly[i]! - my);
      sxx += (lx[i]! - mx) ** 2;
    }
    if (sxx > 0) {
      coefB = sxy / sxx;
      coefA = Math.exp(my - coefB * mx);
      let ssRes = 0;
      let ssTot = 0;
      for (let i = 0; i < n; i++) {
        const pred = Math.log(coefA) + coefB * lx[i]!;
        ssRes += (ly[i]! - pred) ** 2;
        ssTot += (ly[i]! - my) ** 2;
      }
      r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
    }
  }

  // Episodios: rachas de horas con lluvia apreciable separadas por al menos 6 h.
  const episodes: RunoffFit["episodes"] = [];
  let cur: { start: Date; end: Date; rainMm: number; peakFlow: number } | null = null;
  for (const p of rainy) {
    if (cur && p.ts.getTime() - cur.end.getTime() <= 6 * 3_600_000) {
      cur.end = p.ts;
      cur.rainMm = Math.max(cur.rainMm, p.mm);
    } else {
      if (cur) episodes.push(finish(cur));
      cur = { start: p.ts, end: p.ts, rainMm: p.mm, peakFlow: 0 };
    }
  }
  if (cur) episodes.push(finish(cur));
  function finish(e: { start: Date; end: Date; rainMm: number; peakFlow: number }) {
    // Pico de caudal desde el inicio del episodio hasta maxLag horas después de su fin.
    let peak = 0;
    for (let h = e.start.getTime(); h <= e.end.getTime() + maxLag * 3_600_000; h += 3_600_000) {
      peak = Math.max(peak, qByHour.get(h) ?? 0);
    }
    return {
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      rainMm: Math.round(e.rainMm * 10) / 10,
      peakFlow: Math.round(peak * 10) / 10,
    };
  }
  episodes.sort((a, b) => b.rainMm - a.rainMm);

  return {
    lagMinutes: best ? best.lag * 60 : null,
    lagCorrelation: best ? Math.round(best.r * 1000) / 1000 : null,
    rainyHours: rainy.length,
    respondingHours: responding,
    n: lx.length,
    peakFlow: peakFlow === null ? null : Math.round(peakFlow * 10) / 10,
    coefA: coefA === null ? null : Math.round(coefA * 10000) / 10000,
    coefB: coefB === null ? null : Math.round(coefB * 1000) / 1000,
    r2: r2 === null ? null : Math.round(r2 * 1000) / 1000,
    episodes,
    discardedFlowSamples: flow.length - clean.length,
  };
}

export function runoffMinEvents(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.RUNOFF_MIN_EVENTS ?? 5);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

export interface UsableOptions {
  minEvents?: number;
  /**
   * Caudal que el aforo tiene que haber alcanzado alguna vez en las horas con respuesta: el
   * primer umbral del aforo. Una ley de potencia ajustada sobre el goteo (0,5–2 m³/s) puede dar
   * un r² decente y no decir nada sobre llegar a 30: extrapolar dos órdenes de magnitud es
   * inventar. Sin este requisito, el histórico del Poyo habría pasado por "ajuste razonable".
   */
  minPeakFlow?: number;
}

/**
 * Veredicto legible. Como en la calibración de umbrales, es una guía para quien decide: el
 * ajuste no se aplica solo.
 */
export function runoffVerdict(fit: RunoffFit, opts: UsableOptions = {}): string {
  const minEvents = opts.minEvents ?? runoffMinEvents();
  const r2 = fit.r2 === null ? "—" : fit.r2.toFixed(2).replace(".", ",");
  if (fit.rainyHours === 0)
    return "no hay horas con lluvia apreciable en el periodo: nada que ajustar";
  if (fit.respondingHours === 0) {
    return `el aforo no respondió en ninguna de las ${fit.rainyHours} horas con lluvia apreciable: la cuenca no ha corrido en el periodo y no se puede calibrar`;
  }
  if (fit.n < minEvents) {
    return `solo ${fit.n} horas con lluvia y respuesta (mínimo ${minEvents}): insuficiente para ajustar`;
  }
  if (opts.minPeakFlow !== undefined && (fit.peakFlow ?? 0) < opts.minPeakFlow) {
    const peak = (fit.peakFlow ?? 0).toFixed(1).replace(".", ",");
    return `el aforo solo ha respondido con caudales de hasta ${peak} m³/s, lejos del primer umbral (${opts.minPeakFlow}): la relación no dice nada sobre alcanzar los umbrales y no conviene aplicarla`;
  }
  if (fit.r2 === null || fit.r2 < 0.5) {
    return `ajuste débil (r² ${r2}) sobre ${fit.n} horas: no conviene aplicarlo`;
  }
  return `ajuste razonable (r² ${r2}) sobre ${fit.n} horas en ${fit.episodes.length} episodios; retardo ${fit.lagMinutes} min`;
}

/** ¿Cumple lo mínimo para escribirse como modelo? La misma regla que el veredicto. */
export function fitIsUsable(fit: RunoffFit, opts: UsableOptions = {}): boolean {
  const minEvents = opts.minEvents ?? runoffMinEvents();
  return (
    fit.coefA !== null &&
    fit.coefB !== null &&
    fit.lagMinutes !== null &&
    fit.n >= minEvents &&
    (opts.minPeakFlow === undefined || (fit.peakFlow ?? 0) >= opts.minPeakFlow) &&
    fit.r2 !== null &&
    fit.r2 >= 0.5
  );
}

// ---------------------------------------------------------------------------------------------
// Lectura del histórico
// ---------------------------------------------------------------------------------------------

export interface HistorySpec {
  flowSensorId: string;
  rainSensorIds: string[];
  from?: Date;
  to?: Date;
}

/** Trae del histórico lo necesario para `fitRunoff`. */
export async function loadRunoffHistory(
  db: Db,
  spec: HistorySpec,
): Promise<{ flow: Sample[]; rainByGauge: HourlyRain[][] }> {
  const from = (spec.from ?? new Date(0)).toISOString();
  const to = (spec.to ?? new Date()).toISOString();
  const flowRows = await db.execute<{ ts: string | Date; value: number | string }>(sql`
    select o.ts, o.value
    from sensors s
    join observations o on o.source = s.source and o.station_id = s.station_id and o.variable = s.variable
    where s.id = ${spec.flowSensorId} and o.value is not null
      and o.ts >= ${from}::timestamptz and o.ts <= ${to}::timestamptz
    order by o.ts
  `);
  const rainByGauge: HourlyRain[][] = [];
  for (const id of spec.rainSensorIds) {
    const rows = await db.execute<{ ts: string | Date; value: number | string }>(sql`
      select o.ts, o.value
      from sensors s
      join observations o on o.source = s.source and o.station_id = s.station_id and o.variable = s.variable
      where s.id = ${id} and s.variable = 'precip_mm' and o.value is not null
        and o.ts >= ${from}::timestamptz and o.ts <= ${to}::timestamptz
      order by o.ts
    `);
    rainByGauge.push(rows.map((r) => ({ ts: new Date(r.ts), mm: Number(r.value) })));
  }
  return {
    flow: flowRows.map((r) => ({ ts: new Date(r.ts), value: Number(r.value) })),
    rainByGauge,
  };
}

/** Escribe o actualiza un modelo con la procedencia del ajuste. */
export async function upsertRunoffModel(
  db: Db,
  m: Omit<RunoffModelSpec, "enabled"> & { enabled?: boolean },
): Promise<void> {
  await db.execute(sql`
    insert into runoff_models (id, station_id, flow_sensor_id, rain_sensor_ids, window_hours,
                               lag_minutes, coef_a, coef_b, min_rain_mm, enabled, meta)
    values (${m.id}, ${m.stationId}, ${m.flowSensorId},
            ${sql`array[${sql.join(
              m.rainSensorIds.map((s) => sql`${s}`),
              sql`, `,
            )}]::text[]`},
            ${m.windowHours}, ${m.lagMinutes}, ${m.coefA}, ${m.coefB}, ${m.minRainMm},
            ${m.enabled ?? true}, ${JSON.stringify(m.meta)}::jsonb)
    on conflict (id) do update set
      station_id = excluded.station_id, flow_sensor_id = excluded.flow_sensor_id,
      rain_sensor_ids = excluded.rain_sensor_ids, window_hours = excluded.window_hours,
      lag_minutes = excluded.lag_minutes, coef_a = excluded.coef_a, coef_b = excluded.coef_b,
      min_rain_mm = excluded.min_rain_mm, enabled = excluded.enabled, meta = excluded.meta
  `);
}
