import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  createDb,
  upsertForecasts,
  upsertObservations,
  type ForecastRow,
  type ObservationRow,
} from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { createApp } from "../src/app.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";

describe.skipIf(!process.env.TALAIA_INTEGRATION)("API (integración)", () => {
  let app: NestFastifyApplication;
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  const now = new Date();
  const hour = new Date(Math.floor(now.getTime() / 3.6e6) * 3.6e6);
  const h = (n: number) => new Date(hour.getTime() + n * 3.6e6);

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    await resetDatabase(pg);
    await migrate(URL_);
    const rows: ForecastRow[] = [];
    const add = (
      source: string,
      forecastTs: Date,
      station = "virtual:albal",
      vals: number[] = [0, 1, 2, 3],
    ) =>
      vals.forEach((v, i) =>
        rows.push({
          source,
          stationId: station,
          variable: "precip_mm",
          forecastTs,
          ts: h(i),
          value: v,
          unit: "mm",
        }),
      );
    add("aemet", h(-6));
    add("open-meteo:icon_eu", h(-12), "virtual:albal", [9, 9, 9, 9]); // corrida vieja
    add("open-meteo:icon_eu", h(-6), "virtual:albal", [1, 1, 1, 1]); // corrida nueva
    add("open-meteo:ecmwf_ifs", h(-6));
    add("open-meteo:gfs_seamless", h(-6), "virtual:mareny-barraquetes", [5, 5, 5, 5]);
    // fuente con datos solo fuera de la ventana
    rows.push({
      source: "open-meteo:arpege_europe",
      stationId: "virtual:albal",
      variable: "precip_mm",
      forecastTs: h(-80),
      ts: h(-72),
      value: 7,
      unit: "mm",
    });
    await upsertForecasts(db, rows);
    await pg`insert into source_status (source, last_success_at, records_written) values ('open-meteo', now() - interval '600 seconds', 10)`;

    // observaciones del SAIH: caudal del Poyo (umbrales 30/70/150) y lluvia del Tancat de la Pipa
    const obs: ObservationRow[] = [];
    const min5 = (n: number) => new Date(now.getTime() - n * 300_000);
    [10, 25, 80].forEach((v, i) =>
      obs.push({
        source: "saih",
        stationId: "saih:227",
        variable: "river_flow_m3s",
        ts: min5(3 - i),
        value: v,
        unit: "m³/s",
        quality: 128,
      }),
    );
    obs.push({
      source: "saih",
      stationId: "saih:802",
      variable: "precip_rate_mmh",
      ts: min5(1),
      value: 4.8,
      unit: "mm/h",
      quality: 0,
    });
    await upsertObservations(db, obs);
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
    await close();
  });

  const get = (url: string) => app.getHttpAdapter().getInstance().inject({ method: "GET", url });

  it("GET /health", async () => {
    const r = await get("/api/v1/health");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, db: true });
  });

  it("GET /stations devuelve 4 con albal primaria", async () => {
    const r = await get("/api/v1/stations");
    const { stations } = r.json() as { stations: { id: string; primary: boolean; ine: string }[] };
    expect(stations).toHaveLength(4);
    expect(stations[0]).toMatchObject({ id: "virtual:albal", primary: true, ine: "46007" });
  });

  it("GET /status con age_seconds", async () => {
    const r = await get("/api/v1/status");
    const { sources } = r.json() as { sources: { source: string; age_seconds: number }[] };
    const om = sources.find((s) => s.source === "open-meteo")!;
    expect(om.age_seconds).toBeGreaterThanOrEqual(600);
    expect(om.age_seconds).toBeLessThan(620);
  });

  it("GET /compare: una serie por fuente, última emisión, totales en servidor", async () => {
    const r = await get("/api/v1/compare");
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      station: { id: string };
      series: {
        source: string;
        forecast_ts: string;
        total: number;
        max_hourly: number;
        points: unknown[];
      }[];
      summary: { sources: number; min_total: number; median_total: number; max_total: number };
      unit: string;
    };
    expect(body.station.id).toBe("virtual:albal");
    expect(body.unit).toBe("mm");
    expect(body.series.map((s) => s.source).sort()).toEqual([
      "aemet",
      "open-meteo:ecmwf_ifs",
      "open-meteo:icon_eu",
    ]);
    const icon = body.series.find((s) => s.source === "open-meteo:icon_eu")!;
    expect(icon.forecast_ts).toBe(h(-6).toISOString());
    expect(icon.total).toBe(4);
    expect(icon.max_hourly).toBe(1);
    expect(icon.points).toHaveLength(4);
    const aemet = body.series.find((s) => s.source === "aemet")!;
    expect(aemet.total).toBe(6);
    expect(body.summary).toEqual({ sources: 3, min_total: 4, median_total: 6, max_total: 6 });
  });

  it("GET /compare?station=virtual:mareny-barraquetes filtra por estación", async () => {
    const r = await get("/api/v1/compare?station=virtual:mareny-barraquetes&hours=3");
    const body = r.json() as { series: { source: string; points: unknown[] }[] };
    expect(body.series.map((s) => s.source)).toEqual(["open-meteo:gfs_seamless"]);
    expect(body.series[0]!.points).toHaveLength(3);
  });

  it("parámetros inválidos → 400; estación inexistente → 404", async () => {
    expect((await get("/api/v1/compare?hours=100")).statusCode).toBe(400);
    expect((await get("/api/v1/compare?variable=foo")).statusCode).toBe(400);
    expect((await get("/api/v1/compare?station=virtual:nada")).statusCode).toBe(404);
  });

  it("GET /sensors: catálogo con último valor y nivel calculado en servidor", async () => {
    const r = await get("/api/v1/sensors?source=saih");
    expect(r.statusCode).toBe(200);
    const { sensors } = r.json() as {
      sensors: {
        id: string;
        variable: string;
        unit: string;
        station: { id: string; name: string; lat: number; lon: number };
        thresholds: { low: number | null; mid: number | null; high: number | null };
        last_value: number | null;
        age_seconds: number | null;
        level: string | null;
      }[];
    };
    expect(sensors.length).toBeGreaterThan(50);

    const poyo = sensors.find((s) => s.id === "saih:13873")!;
    expect(poyo.station.id).toBe("saih:227");
    expect(poyo.station.lat).toBeCloseTo(39.47, 1);
    expect(poyo.thresholds).toEqual({ low: 30, mid: 70, high: 150 });
    expect(poyo.last_value).toBe(80);
    expect(poyo.level).toBe("naranja"); // 80 ≥ 70 y < 150
    expect(poyo.age_seconds).toBeGreaterThanOrEqual(0);

    // sensor de lluvia: sin umbrales → sin nivel, pero con su último valor
    const pipa = sensors.find(
      (s) => s.station.id === "saih:802" && s.variable === "precip_rate_mmh",
    )!;
    expect(pipa.unit).toBe("mm/h");
    expect(pipa.last_value).toBe(4.8);
    expect(pipa.level).toBeNull();

    // sensor sin observaciones: aparece igualmente, en blanco
    const sinDatos = sensors.find((s) => s.last_value === null)!;
    expect(sinDatos.level).toBeNull();
    expect(sinDatos.age_seconds).toBeNull();
  });

  it("GET /sensors?variable= filtra por variable", async () => {
    const r = await get("/api/v1/sensors?variable=river_flow_m3s");
    const { sensors } = r.json() as { sensors: { variable: string }[] };
    expect(sensors.length).toBeGreaterThan(10);
    expect(sensors.every((s) => s.variable === "river_flow_m3s")).toBe(true);
  });

  it("GET /observations devuelve la serie del sensor con su resumen", async () => {
    const r = await get("/api/v1/observations?sensor=saih:13873&hours=6");
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      sensor: { id: string; unit: string; station: { id: string } };
      hours: number;
      summary: { points: number; last: number; max: number; level: string };
      points: { ts: string; value: number; quality: number }[];
    };
    expect(body.sensor.id).toBe("saih:13873");
    expect(body.sensor.unit).toBe("m³/s");
    expect(body.sensor.station.id).toBe("saih:227");
    expect(body.hours).toBe(6);
    expect(body.summary).toMatchObject({ points: 3, last: 80, max: 80, level: "naranja" });
    expect(body.points.map((p) => p.value)).toEqual([10, 25, 80]);
    expect(body.points[0]!.quality).toBe(128);
  });

  it("GET /observations acepta estación + variable", async () => {
    const r = await get("/api/v1/observations?station=saih:227&variable=river_flow_m3s");
    expect(r.statusCode).toBe(200);
    expect((r.json() as { summary: { last: number } }).summary.last).toBe(80);
  });

  it("GET /alerts devuelve los vigentes de nuestras zonas, deduplicados entre fuentes", async () => {
    // Fechas explícitas: `now()` cambia entre transacciones y estos avisos han de ser el mismo.
    const onset = new Date(now.getTime() - 3.6e6).toISOString();
    const expires = new Date(now.getTime() + 6 * 3.6e6).toISOString();
    const add = (id: string, source: string, code: string, level: string) =>
      pg`insert into alerts (id, source, area_code, event_code, event, level, severity,
                             onset, expires, sent, raw)
         values (${id}, ${source}, '774602', ${code}, ${"Aviso " + code}, ${level}, 'Severe',
                 ${onset}::timestamptz, ${expires}::timestamptz, now(), '{}'::jsonb)
         on conflict (id) do nothing`;
    await add("a1", "aemet", "PR", "naranja");
    await add("m1", "meteoalarm", "PR", "naranja"); // el mismo aviso, otra fuente
    await add("v1", "meteoalarm", "VI", "amarillo");
    await pg`insert into alerts (id, source, area_code, event_code, event, level, severity,
                                 onset, expires, sent, raw)
             values ('viejo', 'aemet', '774602', 'PR', 'Caducado', 'rojo', 'Severe',
                     now() - interval '12 hours', now() - interval '1 hour', now(), '{}'::jsonb)
             on conflict (id) do nothing`;

    const r = await get("/api/v1/alerts");
    expect(r.statusCode).toBe(200);
    const { alerts } = r.json() as {
      alerts: {
        id: string;
        source: string;
        event_code: string;
        active: boolean;
        stations: string[];
      }[];
    };
    // el aviso duplicado se cuenta una vez y manda AEMET; el caducado no sale
    expect(alerts.filter((a) => a.event_code === "PR")).toHaveLength(1);
    expect(alerts.find((a) => a.event_code === "PR")!.source).toBe("aemet");
    expect(alerts.some((a) => a.id === "viejo")).toBe(false);
    expect(alerts.every((a) => a.active)).toBe(true);
    // la zona se traduce a las localidades que dependen de ella
    expect(alerts[0]!.stations.length).toBeGreaterThan(0);

    const todos = await get("/api/v1/alerts?active=false");
    expect((todos.json() as { alerts: unknown[] }).alerts.length).toBeGreaterThan(alerts.length);
    await pg`delete from alerts`;
  });

  it("GET /observations sin parámetros → 400; sensor inexistente → 404", async () => {
    expect((await get("/api/v1/observations")).statusCode).toBe(400);
    expect((await get("/api/v1/observations?sensor=saih:99999")).statusCode).toBe(404);
    expect((await get("/api/v1/observations?sensor=saih:13873&hours=999")).statusCode).toBe(400);
  });
});
