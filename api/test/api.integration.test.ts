import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createDb, upsertForecasts, type ForecastRow } from "@talaia/shared";
import { migrate } from "../../db/src/migrate.js";
import { resetDatabase } from "../../db/src/testing.js";
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
});
