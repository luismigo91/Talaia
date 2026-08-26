import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { loadVirtualStations, type VirtualStation } from "./stations.js";
import { thresholdLevel } from "./sensors.js";
import { dedupeAlerts } from "./alerts.js";
import { lastPlausible } from "./plausibility.js";
import {
  levelFor,
  loadThresholds,
  loadWatchPoints,
  median,
  worstLevel,
  type RiskLevel,
  type ThresholdSpec,
  type WatchPointSpec,
} from "./risk.js";

/** Eventos CAP que sí hablan de inundación. Viento (VI) y costeros (CO) son informativos. */
export const FLOOD_EVENT_CODES = new Set(["PR", "TO", "IN"]);

export function staleMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.RISK_STALE_MINUTES ?? 30);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

/**
 * Margen de frescura según la cadencia real del sensor. Los aforos publican cada 5 min, pero
 * los embalses cada media hora: aplicarles el mismo listón descartaría el caudal de salida la
 * mitad del tiempo, y un embalse soltando agua que no cuenta es exactamente el verde falso que
 * queremos evitar.
 */
/**
 * Radio en el que cuentan las estaciones amateur de AVAMET. Son la única señal del barranc de
 * l'Horteta, que está fuera del SAIH; se buscan por cercanía en lugar de mantener a mano una
 * lista que quedaría desfasada en cuanto alguien monte o retire una estación.
 */
/**
 * Salto máximo plausible de caudal entre dos muestras cincominutales.
 *
 * El histórico del Poyo tiene picos que van de 0,1 a 855 m³/s en cinco minutos, se sostienen
 * media hora y vuelven a cero: físicamente imposible, y el `estado` de la CHJ los da por
 * buenos. Sin este filtro el semáforo habría dado rojo cinco veces en año y medio sin una gota
 * de lluvia, que es la forma más rápida de que nadie vuelva a mirar un aviso.
 *
 * El listón: en la DANA del 29-10-2024 el Poyo subió de ~0 a ~2.230 m³/s en 170 minutos, unos
 * 65 m³/s por cada cinco. 250 deja casi cuatro veces de margen sobre la peor crecida conocida.
 */
export function maxFlowJump(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.RISK_MAX_FLOW_JUMP ?? 250);
  return Number.isFinite(raw) && raw > 0 ? raw : 250;
}

export function avametRadiusKm(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.AVAMET_RADIUS_KM ?? 8);
  return Number.isFinite(raw) && raw > 0 ? raw : 8;
}

export function maxAgeMsFor(kind: string, env: NodeJS.ProcessEnv = process.env): number {
  const base = staleMinutes(env);
  return (kind === "reservoir" ? Math.max(base, 90) : base) * 60_000;
}

export interface RiskComponent {
  kind: "flow" | "reservoir" | "rain_observed" | "rain_forecast" | "alert";
  level: RiskLevel;
  value: number | null;
  unit: string | null;
  threshold: number | null;
  source: string | null;
  detail: string;
}

export interface StationRisk {
  station: { id: string; name: string; lat: number; lon: number; primary: boolean };
  level: RiskLevel;
  components: RiskComponent[];
  alerts: {
    id: string;
    source: string;
    level: string;
    event: string | null;
    event_code: string | null;
    expires: string;
    counts: boolean;
  }[];
  warnings: string[];
  stale: boolean;
  computed_at: string;
}

type ObsRow = { sensor_id: string; value: number | string | null; ts: string | Date };
type RainRow = {
  sensor_id: string;
  station_name: string;
  mm1h: number | string | null;
  mm12h: number | string | null;
  /** Marca de procedencia: las lecturas amateur se etiquetan al mostrarlas. */
  amateur?: boolean;
  signal?: string;
};
type ForecastRow = { source: string; mm12h: number | string | null; mm24h: number | string | null };
type AlertRow = {
  id: string;
  source: string;
  area_code: string;
  level: string;
  event: string | null;
  event_code: string | null;
  onset: string | Date;
  expires: string | Date;
};

/**
 * Semáforo por localización: cuatro señales independientes y el máximo entre ellas.
 * Nunca una media — un caudal en rojo no se compensa con que no haya aviso.
 *
 * Vive en el paquete compartido, no en la API, para que el scheduler (que notifica) evalúe
 * exactamente lo mismo que muestra `/api/v1/risk`: el aviso que llega al móvil no puede
 * divergir de la pantalla. Devuelve `[]` si la estación pedida no existe; quien llama decide
 * si eso es un 404.
 */
export async function evaluateRisk(
  db: Db,
  opts: { station?: string; now?: Date } = {},
): Promise<StationRisk[]> {
  const stations = await loadVirtualStations(db);
  const targets = opts.station ? stations.filter((s) => s.id === opts.station) : stations;
  const now = opts.now ?? new Date();
  return Promise.all(targets.map((s) => riskFor(db, s, now)));
}

async function riskFor(db: Db, station: VirtualStation, now: Date): Promise<StationRisk> {
  const [points, thresholds] = await Promise.all([
    loadWatchPoints(db, station.id),
    loadThresholds(db, station.id),
  ]);
  const warnings: string[] = [];
  const components: RiskComponent[] = [];

  const hydro = points.filter((p) => p.role !== "rain_upstream" && p.role !== "rain_local");
  const rain = points.filter((p) => p.role === "rain_upstream" || p.role === "rain_local");

  const flow = await flowComponents(db, hydro, now, warnings);
  components.push(...flow.components);
  components.push(...(await rainObservedComponents(db, rain, thresholds, now, station)));
  components.push(...(await rainForecastComponents(db, station, thresholds, now)));

  const alerts = await alertsFor(db, station, now);
  for (const a of alerts) {
    if (!a.counts) continue;
    components.push({
      kind: "alert",
      level: a.level as RiskLevel,
      value: null,
      unit: null,
      threshold: null,
      source: a.id,
      detail: `aviso oficial vigente (vía ${a.source}): ${a.event ?? a.event_code ?? "sin descripción"} (${a.level}) hasta ${a.expires}`,
    });
  }
  if (points.length === 0) warnings.push("la localización no tiene sensores vigilados");
  if (components.length === 0) {
    warnings.push("sin datos evaluables: el verde no significa que no haya riesgo");
  }

  return {
    station: {
      id: station.id,
      name: station.name,
      lat: station.lat,
      lon: station.lon,
      primary: station.primary,
    },
    level: worstLevel(components.map((c) => c.level)),
    components,
    alerts,
    warnings,
    stale: flow.anyFresh === false && hydro.length > 0,
    computed_at: now.toISOString(),
  };
}

/** Caudal y embalses: último valor contra los umbrales oficiales de la CHJ. */
async function flowComponents(
  db: Db,
  points: WatchPointSpec[],
  now: Date,
  warnings: string[],
): Promise<{ components: RiskComponent[]; anyFresh: boolean }> {
  if (points.length === 0) return { components: [], anyFresh: false };
  const ids = points.map((p) => p.sensorId);
  // Se traen las últimas seis horas de cada sensor y la lectura creíble se elige en código:
  // distinguir un artefacto de una crecida exige mirar cómo llegó el valor, no cuánto vale.
  // La ventana es más larga que el margen de frescura a propósito, para poder distinguir un
  // sensor que lleva horas mudo de uno que nunca ha dado nada.
  const rows = await db.execute<ObsRow & { variable: string }>(sql`
      select s.id as sensor_id, s.variable, o.value, o.ts
      from sensors s
      join lateral (
        select value, ts from observations
        where source = s.source and station_id = s.station_id and variable = s.variable
          and ts >= now() - interval '6 hours'
        order by ts desc limit 72
      ) o on true
      where s.id in ${sql`(${sql.join(
        ids.map((i) => sql`${i}`),
        sql`, `,
      )})`}
    `);

  const jump = maxFlowJump();
  const series = new Map<string, (ObsRow & { variable: string })[]>();
  for (const r of rows) series.set(r.sensor_id, [...(series.get(r.sensor_id) ?? []), r]);

  const byId = new Map<string, ObsRow>();
  for (const [sensorId, serie] of series) {
    const variable = serie[0]!.variable;
    const conFiltro = variable === "river_flow_m3s" || variable === "river_level_m";
    const muestras = serie
      .filter((r) => r.value !== null)
      .map((r) => ({ value: Number(r.value), ts: new Date(r.ts) }));
    if (muestras.length === 0) continue;
    const elegida = conFiltro
      ? lastPlausible(muestras, { maxJump: jump }).sample
      : muestras.reduce((a, b) => (a.ts > b.ts ? a : b));
    if (elegida) byId.set(sensorId, { sensor_id: sensorId, value: elegida.value, ts: elegida.ts });
  }
  const components: RiskComponent[] = [];
  let anyFresh = false;

  for (const p of points) {
    const row = byId.get(p.sensorId);
    if (!row || row.value === null) {
      warnings.push(`sin dato de ${p.sensorStationName} (${p.sensorId})`);
      continue;
    }
    const ts = new Date(row.ts);
    const age = now.getTime() - ts.getTime();
    const value = round(Number(row.value));
    const level = thresholdLevel(value, p);
    // Un sensor sin umbrales (volumen de embalse) es contexto, no señal: ni cuenta ni avisa.
    if (level === null) continue;
    if (age > maxAgeMsFor(p.sensorStationKind)) {
      warnings.push(
        `dato obsoleto de ${p.sensorStationName} (${p.sensorId}): ${Math.round(age / 60_000)} min`,
      );
      continue;
    }
    anyFresh = true;
    components.push({
      kind: p.role === "reservoir" ? "reservoir" : "flow",
      level,
      value,
      unit: p.unit,
      threshold: thresholdOf(level, p),
      source: p.sensorId,
      detail: describe(level, value, p),
    });
  }
  return { components, anyFresh };
}

/**
 * Lluvia observada: se evalúa cada pluviómetro por separado y se toma el peor.
 * Promediar entre estaciones diluiría justo la señal que importa (en la DANA,
 * Turís marcó 771 mm mientras a 20 km apenas llovía).
 */
async function rainObservedComponents(
  db: Db,
  points: WatchPointSpec[],
  thresholds: Map<string, ThresholdSpec>,
  now: Date,
  station: VirtualStation,
): Promise<RiskComponent[]> {
  const rainPoints = points.filter((p) => p.variable === "precip_mm");
  // Las estaciones amateur cercanas son una fuente más de lluvia observada: en el Horteta,
  // la única que hay.
  const amateur = await amateurRain(db, station, now);
  if (rainPoints.length === 0 && amateur.length === 0) return [];
  const ids = rainPoints.length > 0 ? rainPoints.map((p) => p.sensorId) : ["sin-sensores"];
  // `precip_mm` es horario y solo existe para horas completas, así que una ventana móvil de
  // 1 h no contendría ninguna fila: la señal horaria es la hora más lluviosa de las últimas 6.
  const rows = await db.execute<RainRow>(sql`
      select s.id as sensor_id, st.name as station_name,
             max(o.value) filter (where o.ts >= ${new Date(now.getTime() - 6 * 3_600_000).toISOString()}::timestamptz) as mm1h,
             sum(o.value) filter (where o.ts >= ${new Date(now.getTime() - 12 * 3_600_000).toISOString()}::timestamptz) as mm12h
      from sensors s
      join stations st on st.id = s.station_id
      join observations o
        on o.source = s.source and o.station_id = s.station_id and o.variable = s.variable
      where s.id in ${sql`(${sql.join(
        ids.map((i) => sql`${i}`),
        sql`, `,
      )})`}
        and o.ts >= ${new Date(now.getTime() - 12 * 3_600_000).toISOString()}::timestamptz
      group by s.id, st.name
    `);

  const out: RiskComponent[] = [];
  for (const [signal, label, pick] of [
    ["observed_precip_1h", "en la hora más lluviosa de las últimas 6 h", (r: RainRow) => r.mm1h],
    ["observed_precip_12h", "en 12 h", (r: RainRow) => r.mm12h],
  ] as const) {
    const t = thresholds.get(signal);
    let worst: { level: RiskLevel; value: number; row: RainRow } | undefined;
    // Oficiales y amateur compiten por el mismo umbral: manda la lectura más alta, venga
    // de donde venga, y el detalle dice cuál es.
    for (const r of [...rows, ...amateur.filter((a) => a.signal === signal)]) {
      const raw = pick(r);
      if (raw === null) continue;
      const value = round(Number(raw));
      const level = levelFor(value, t);
      if (!level) continue;
      if (
        !worst ||
        rank(level) > rank(worst.level) ||
        (level === worst.level && value > worst.value)
      ) {
        worst = { level, value, row: r };
      }
    }
    if (!worst) continue;
    const threshold = thresholdValue(worst.level, t);
    out.push({
      kind: "rain_observed",
      level: worst.level,
      value: worst.value,
      unit: "mm",
      threshold,
      source: worst.row.sensor_id,
      // AVAMET publica acumulados móviles ya calculados y el SAIH horas completas: la frase
      // tiene que decir la verdad de cada fuente.
      detail: (() => {
        const ventana = worst.row.amateur
          ? signal === "observed_precip_1h"
            ? "en la última hora"
            : "en 12 h"
          : label;
        return worst.level === "verde"
          ? `${worst.value} mm ${ventana} en ${worst.row.station_name}, por debajo del primer umbral${threshold !== null ? ` (${threshold} mm)` : ""}`
          : `${worst.value} mm ${ventana} en ${worst.row.station_name} ≥ ${threshold} mm (${worst.level})`;
      })(),
    });
  }
  return out;
}

/**
 * Lluvia prevista: acumulado por fuente con su última emisión. El nivel lo marca la
 * mediana entre fuentes; el máximo viaja en el detalle. Un modelo desatado no debe
 * encender el semáforo, pero tampoco desaparecer de la vista.
 */
async function rainForecastComponents(
  db: Db,
  station: VirtualStation,
  thresholds: Map<string, ThresholdSpec>,
  now: Date,
): Promise<RiskComponent[]> {
  const rows = await db.execute<ForecastRow>(sql`
      with latest as (
        select source, max(forecast_ts) as forecast_ts
        from forecasts
        where station_id = ${station.id} and variable = 'precip_mm'
          and ts >= ${now.toISOString()}::timestamptz
        group by source
      )
      select f.source,
             sum(f.value) filter (where f.ts < ${new Date(now.getTime() + 12 * 3_600_000).toISOString()}::timestamptz) as mm12h,
             sum(f.value) filter (where f.ts < ${new Date(now.getTime() + 24 * 3_600_000).toISOString()}::timestamptz) as mm24h
      from forecasts f
      join latest l on l.source = f.source and l.forecast_ts = f.forecast_ts
      where f.station_id = ${station.id} and f.variable = 'precip_mm'
        and f.ts >= ${now.toISOString()}::timestamptz
        and f.ts < ${new Date(now.getTime() + 24 * 3_600_000).toISOString()}::timestamptz
      group by f.source
    `);
  if (rows.length === 0) return [];

  const out: RiskComponent[] = [];
  for (const [signal, hours, pick] of [
    ["forecast_precip_12h", 12, (r: ForecastRow) => r.mm12h],
    ["forecast_precip_24h", 24, (r: ForecastRow) => r.mm24h],
  ] as const) {
    const t = thresholds.get(signal);
    const values = rows
      .map((r) => (pick(r) === null ? null : Number(pick(r))))
      .filter((v): v is number => v !== null);
    const med = median(values);
    if (med === null) continue;
    const level = levelFor(round(med), t);
    if (!level) continue;
    const max = round(Math.max(...values));
    out.push({
      kind: "rain_forecast",
      level,
      value: round(med),
      unit: "mm",
      threshold: thresholdValue(level, t),
      source: `${values.length} fuentes`,
      detail: `mediana de ${round(med)} mm en ${hours} h entre ${values.length} fuentes (máximo ${max} mm)`,
    });
  }
  return out;
}

/** Avisos vigentes de la zona. Solo los de inundación elevan el nivel. */
async function alertsFor(
  db: Db,
  station: VirtualStation,
  now: Date,
): Promise<StationRisk["alerts"]> {
  if (!station.aemetZone) return [];
  const rows = await db.execute<AlertRow>(sql`
      select id, source, area_code, level, event, event_code, onset, expires from alerts
      where area_code = ${station.aemetZone}
        and expires > ${now.toISOString()}::timestamptz
        and onset <= ${now.toISOString()}::timestamptz
      order by expires
    `);
  // AEMET y Meteoalarm publican el mismo aviso con identificadores distintos: se resuelve aquí,
  // al leer, para no depender del orden en que corren los collectors.
  const unique = dedupeAlerts(
    rows.map((r) => ({
      ...r,
      areaCode: r.area_code,
      eventCode: r.event_code,
    })),
  );
  return unique.map((a) => ({
    id: a.id,
    source: a.source,
    level: a.level,
    event: a.event,
    event_code: a.event_code,
    expires: new Date(a.expires).toISOString(),
    counts: FLOOD_EVENT_CODES.has((a.event_code ?? "").toUpperCase()),
  }));
}

const RANK = { verde: 0, amarillo: 1, naranja: 2, rojo: 3 } as const;
const rank = (l: RiskLevel) => RANK[l];
const round = (n: number) => Math.round(n * 100) / 100;

function thresholdOf(level: RiskLevel, p: WatchPointSpec): number | null {
  if (level === "rojo") return p.thresholdHigh;
  if (level === "naranja") return p.thresholdMid;
  if (level === "amarillo") return p.thresholdLow;
  return p.thresholdLow;
}

function thresholdValue(level: RiskLevel, t: ThresholdSpec | undefined): number | null {
  if (!t) return null;
  if (level === "rojo") return t.red;
  if (level === "naranja") return t.orange;
  if (level === "amarillo") return t.yellow;
  return t.yellow;
}

function describe(level: RiskLevel, value: number, p: WatchPointSpec): string {
  const t = thresholdOf(level, p);
  const name = p.sensorStationName;
  if (level === "verde") {
    return t !== null
      ? `${value} ${p.unit} en ${name}, por debajo del primer umbral (${t} ${p.unit})`
      : `${value} ${p.unit} en ${name}`;
  }
  return `${value} ${p.unit} ≥ ${t} ${p.unit} (${level}) en ${name}`;
}

/**
 * Lluvia de las estaciones amateur de AVAMET cercanas a la localidad.
 *
 * AVAMET publica acumulados ya calculados (1 h y 12 h móviles), que se comparan con los mismos
 * umbrales de AEMET. Es dato sin control de calidad: cuenta para el semáforo —en el Horteta no
 * hay otra cosa— pero se muestra siempre indicando que es amateur.
 */
async function amateurRain(db: Db, station: VirtualStation, now: Date): Promise<RainRow[]> {
  const radius = avametRadiusKm() * 1000;
  const since = new Date(now.getTime() - 90 * 60_000).toISOString();
  const rows = await db.execute<{
    sensor_id: string;
    station_name: string;
    variable: string;
    value: number | string | null;
    km: number | string;
  }>(sql`
    select s.id as sensor_id, st.name as station_name, s.variable, o.value,
           ST_Distance(st.geom::geography, ST_SetSRID(ST_Point(${station.lon}, ${station.lat}), 4326)::geography) / 1000 as km
    from sensors s
    join stations st on st.id = s.station_id
    join lateral (
      select value from observations
      where source = s.source and station_id = s.station_id and variable = s.variable
        and ts >= ${since}::timestamptz
      order by ts desc limit 1
    ) o on true
    where s.source = 'avamet' and s.enabled
      and s.variable in ('precip_1h_mm', 'precip_12h_mm')
      and ST_DWithin(st.geom::geography,
                     ST_SetSRID(ST_Point(${station.lon}, ${station.lat}), 4326)::geography,
                     ${radius})
  `);
  return rows.map((r) => ({
    sensor_id: r.sensor_id,
    station_name: `${r.station_name} (amateur, a ${Math.round(Number(r.km) * 10) / 10} km)`,
    mm1h: r.variable === "precip_1h_mm" ? r.value : null,
    mm12h: r.variable === "precip_12h_mm" ? r.value : null,
    amateur: true,
    signal: r.variable === "precip_1h_mm" ? "observed_precip_1h" : "observed_precip_12h",
  }));
}
