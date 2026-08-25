import {
  bigserial,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/** Columna PostGIS. Drizzle no la modela nativamente con SRID en todas las versiones. */
const geometry = (type: "Point" | "MultiPolygon") =>
  customType<{ data: string; driverData: string }>({
    dataType: () => `geometry(${type},4326)`,
  });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["official", "model", "amateur"] }).notNull(),
  url: text("url"),
});

export const stations = pgTable("stations", {
  id: text("id").primaryKey(),
  source: text("source")
    .notNull()
    .references(() => sources.id),
  name: text("name").notNull(),
  kind: text("kind", {
    enum: ["station", "municipality", "locality", "gauge", "reservoir", "rain_gauge"],
  }).notNull(),
  geom: geometry("Point")("geom").notNull(),
  elevationM: real("elevation_m"),
  meta: jsonb("meta").$type<StationMeta>().notNull().default({}),
});

export interface StationMeta {
  ine?: string;
  aemet_zone?: string;
  primary?: boolean;
  aemet_note?: string;
  [k: string]: unknown;
}

/** Una fila por fuente lógica de collector (p. ej. `aemet:forecast:46007`). Sin FK a `sources`. */
export const sourceStatus = pgTable("source_status", {
  source: text("source").primaryKey(),
  lastRunAt: ts("last_run_at"),
  lastSuccessAt: ts("last_success_at"),
  lastError: text("last_error"),
  recordsWritten: integer("records_written"),
  payloadHash: text("payload_hash"),
});

/** Catálogo de sensores externos: sensor de la fuente → variable canónica, unidad y umbrales. */
export const sensors = pgTable(
  "sensors",
  {
    id: text("id").primaryKey(),
    source: text("source")
      .notNull()
      .references(() => sources.id),
    stationId: text("station_id")
      .notNull()
      .references(() => stations.id),
    externalId: text("external_id").notNull(),
    variable: text("variable").notNull(),
    unit: text("unit").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    thresholdLow: doublePrecision("threshold_low"),
    thresholdMid: doublePrecision("threshold_mid"),
    thresholdHigh: doublePrecision("threshold_high"),
    meta: jsonb("meta").$type<SensorMeta>().notNull().default({}),
  },
  (t) => [
    unique("sensors_source_external_variable_key").on(t.source, t.externalId, t.variable),
    index("sensors_station_idx").on(t.stationId, t.variable),
  ],
);

export interface SensorMeta {
  /** idEstacionRemota del SAIH. */
  saih_station?: string;
  saih_name?: string;
  note?: string;
  /** Sensor del que se deriva (p. ej. precip_mm derivado de la intensidad). */
  derived_from?: string;
  [k: string]: unknown;
}

/** Localización objetivo → sensores que la amenazan (semilla del semáforo). */
export const watchPoints = pgTable(
  "watch_points",
  {
    stationId: text("station_id")
      .notNull()
      .references(() => stations.id),
    sensorId: text("sensor_id")
      .notNull()
      .references(() => sensors.id),
    role: text("role", {
      enum: ["flow_primary", "flow_secondary", "reservoir", "rain_upstream", "rain_local"],
    }).notNull(),
    lagMinutes: integer("lag_minutes"),
    note: text("note"),
  },
  (t) => [
    primaryKey({ columns: [t.stationId, t.sensorId] }),
    index("watch_points_sensor_idx").on(t.sensorId),
  ],
);

/** Umbrales de lluvia (prevista y observada). Los de caudal viven en `sensors`. */
export const thresholds = pgTable(
  "thresholds",
  {
    id: text("id").primaryKey(),
    /** NULL = regla global; una fila con estación tiene prioridad. */
    stationId: text("station_id").references(() => stations.id),
    signal: text("signal").notNull(),
    levelYellow: doublePrecision("level_yellow"),
    levelOrange: doublePrecision("level_orange"),
    levelRed: doublePrecision("level_red"),
    enabled: boolean("enabled").notNull().default(true),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [unique("thresholds_station_signal_key").on(t.stationId, t.signal)],
);

export const forecasts = pgTable(
  "forecasts",
  {
    source: text("source").notNull(),
    stationId: text("station_id")
      .notNull()
      .references(() => stations.id),
    variable: text("variable").notNull(),
    forecastTs: ts("forecast_ts").notNull(),
    ts: ts("ts").notNull(),
    value: doublePrecision("value"),
    unit: text("unit").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.stationId, t.variable, t.forecastTs, t.ts] }),
    index("forecasts_latest_idx").on(t.source, t.stationId, t.variable, t.forecastTs, t.ts),
  ],
);

export const observations = pgTable(
  "observations",
  {
    source: text("source").notNull(),
    stationId: text("station_id")
      .notNull()
      .references(() => stations.id),
    variable: text("variable").notNull(),
    ts: ts("ts").notNull(),
    value: doublePrecision("value"),
    unit: text("unit").notNull(),
    quality: smallint("quality"),
  },
  (t) => [primaryKey({ columns: [t.source, t.stationId, t.variable, t.ts] })],
);

export const rawPayloads = pgTable(
  "raw_payloads",
  {
    id: bigserial("id", { mode: "number" }).notNull(),
    source: text("source").notNull(),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
    url: text("url").notNull(),
    hash: text("hash").notNull(),
    body: bytea("body").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.fetchedAt] })],
);

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    areaCode: text("area_code").notNull(),
    areaName: text("area_name"),
    eventCode: text("event_code"),
    event: text("event"),
    level: text("level", { enum: ["verde", "amarillo", "naranja", "rojo"] }).notNull(),
    severity: text("severity"),
    parameter: text("parameter"),
    onset: ts("onset").notNull(),
    expires: ts("expires").notNull(),
    sent: ts("sent").notNull(),
    headline: text("headline"),
    description: text("description"),
    geom: geometry("MultiPolygon")("geom"),
    raw: jsonb("raw").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("alerts_active_idx").on(t.areaCode, t.expires)],
);

export type Station = typeof stations.$inferSelect;
export type Sensor = typeof sensors.$inferSelect;
export type WatchPoint = typeof watchPoints.$inferSelect;
export type Threshold = typeof thresholds.$inferSelect;
export type ForecastRow = typeof forecasts.$inferInsert;
export type ObservationRow = typeof observations.$inferInsert;
export type AlertRow = typeof alerts.$inferInsert;
export type SourceStatusRow = typeof sourceStatus.$inferSelect;
