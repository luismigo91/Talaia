import {
  bigserial,
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
export type ForecastRow = typeof forecasts.$inferInsert;
export type ObservationRow = typeof observations.$inferInsert;
export type AlertRow = typeof alerts.$inferInsert;
export type SourceStatusRow = typeof sourceStatus.$inferSelect;
