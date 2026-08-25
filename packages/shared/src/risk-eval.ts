import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { loadVirtualStations, type VirtualStation } from "./stations.js";
import { thresholdLevel } from "./sensors.js";
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
};
type ForecastRow = { source: string; mm12h: number | string | null; mm24h: number | string | null };
type AlertRow = {
  id: string;
  level: string;
  event: string | null;
  event_code: string | null;
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
  components.push(...(await rainObservedComponents(db, rain, thresholds, now)));
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
      detail: `aviso de AEMET vigente: ${a.event ?? a.event_code ?? "sin descripción"} (${a.level}) hasta ${a.expires}`,
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
  const rows = await db.execute<ObsRow>(sql`
      select s.id as sensor_id, o.value, o.ts
      from sensors s
      join lateral (
        select value, ts from observations
        where source = s.source and station_id = s.station_id and variable = s.variable
        order by ts desc limit 1
      ) o on true
      where s.id in ${sql`(${sql.join(
        ids.map((i) => sql`${i}`),
        sql`, `,
      )})`}
    `);
  const byId = new Map(rows.map((r) => [r.sensor_id, r]));
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
): Promise<RiskComponent[]> {
  const rainPoints = points.filter((p) => p.variable === "precip_mm");
  if (rainPoints.length === 0) return [];
  const ids = rainPoints.map((p) => p.sensorId);
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
    for (const r of rows) {
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
      detail:
        worst.level === "verde"
          ? `${worst.value} mm ${label} en ${worst.row.station_name}, por debajo del primer umbral${threshold !== null ? ` (${threshold} mm)` : ""}`
          : `${worst.value} mm ${label} en ${worst.row.station_name} ≥ ${threshold} mm (${worst.level})`,
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
      select id, level, event, event_code, expires from alerts
      where area_code = ${station.aemetZone}
        and expires > ${now.toISOString()}::timestamptz
        and onset <= ${now.toISOString()}::timestamptz
      order by expires
    `);
  return rows.map((a) => ({
    id: a.id,
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
