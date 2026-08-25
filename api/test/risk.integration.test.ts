import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  createDb,
  upsertForecasts,
  upsertObservations,
  type Db,
  type ForecastRow,
  type ObservationRow,
} from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { createApp } from "../src/app.js";
import { RiskService } from "../src/risk/risk.service.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";

describe.skipIf(!process.env.TALAIA_INTEGRATION)("semáforo de riesgo (integración)", () => {
  let app: NestFastifyApplication;
  let service: RiskService;
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  const now = new Date();
  const minsAgo = (n: number) => new Date(now.getTime() - n * 60_000);
  const hoursAhead = (n: number) => new Date(now.getTime() + n * 3.6e6);

  const flow = (sensorStation: string, value: number, ts = minsAgo(5)): ObservationRow => ({
    source: "saih",
    stationId: sensorStation,
    variable: "river_flow_m3s",
    ts,
    value,
    unit: "m³/s",
    quality: 0,
  });
  const rain = (sensorStation: string, value: number, ts = minsAgo(10)): ObservationRow => ({
    source: "saih",
    stationId: sensorStation,
    variable: "precip_mm",
    ts,
    value,
    unit: "mm",
    quality: 0,
  });
  const forecast = (source: string, mmPerHour: number, hours = 24): ForecastRow[] =>
    Array.from({ length: hours }, (_, i) => ({
      source,
      stationId: "virtual:albal",
      variable: "precip_mm",
      forecastTs: minsAgo(60),
      ts: hoursAhead(i + 0.5),
      value: mmPerHour,
      unit: "mm",
    }));

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    await resetDatabase(pg);
    await migrate(URL_);
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    service = new RiskService(db as Db);
  });
  afterAll(async () => {
    await app?.close();
    await close();
  });
  beforeEach(async () => {
    await pg`delete from observations`;
    await pg`delete from forecasts`;
    await pg`delete from alerts`;
  });

  const albal = async () => (await service.risk({ station: "virtual:albal", now }))[0]!;

  it("un caudal en rojo manda sobre el resto de señales", async () => {
    await upsertObservations(db, [flow("saih:227", 200)]); // umbrales 30/70/150
    const r = await albal();
    expect(r.level).toBe("rojo");
    const c = r.components.find((c) => c.kind === "flow")!;
    expect(c.value).toBe(200);
    expect(c.threshold).toBe(150);
    expect(c.detail).toContain("RAMBLA POYO");
  });

  it("sin ningún dato devuelve verde, pero avisando de que no es una garantía", async () => {
    const r = await albal();
    expect(r.level).toBe("verde");
    expect(r.components).toHaveLength(0);
    expect(r.warnings.join(" ")).toContain("sin datos evaluables");
  });

  it("un dato obsoleto no cuenta y genera advertencia", async () => {
    await upsertObservations(db, [flow("saih:227", 200, minsAgo(180))]);
    const r = await albal();
    expect(r.level).toBe("verde");
    expect(r.components.some((c) => c.kind === "flow")).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/obsoleto/);
    expect(r.stale).toBe(true);
  });

  it("evalúa la lluvia por pluviómetro: 45 mm en Chiva son naranja", async () => {
    await upsertObservations(db, [rain("saih:371", 45)]);
    const r = await albal();
    const c = r.components.find((c) => c.kind === "rain_observed")!;
    expect(c.level).toBe("naranja");
    expect(c.value).toBe(45);
    expect(c.threshold).toBe(40);
    expect(c.detail).toContain("CHIVA");
    expect(r.level).toBe("naranja");
  });

  it("la hora más lluviosa reciente no se diluye por la ventana del reloj", async () => {
    // `precip_mm` solo existe para horas completas: con una ventana móvil de 1 h esta señal
    // no se activaría nunca.
    await upsertObservations(db, [
      rain("saih:371", 45, minsAgo(240)),
      rain("saih:371", 0, minsAgo(60)),
    ]);
    const r = await albal();
    const c = r.components.find(
      (c) => c.kind === "rain_observed" && c.detail.includes("hora más lluviosa"),
    )!;
    expect(c.level).toBe("naranja");
    expect(c.value).toBe(45);
  });

  it("un sensor sin umbrales no genera componente ni advertencia de frescura", async () => {
    // volumen de Tous: contexto, no señal (y se publica cada media hora)
    await upsertObservations(db, [
      {
        source: "saih",
        stationId: "saih:300",
        variable: "reservoir_hm3",
        ts: minsAgo(90),
        value: 82.9,
        unit: "hm³",
        quality: 0,
      },
    ]);
    const mareny = (await service.risk({ station: "virtual:mareny-barraquetes", now }))[0]!;
    expect(mareny.components.some((c) => c.kind === "reservoir")).toBe(false);
    expect(mareny.warnings.join(" ")).not.toMatch(/obsoleto/);
  });

  it("un embalse conserva su margen de frescura: publica cada media hora", async () => {
    // caudal de salida de Benagéber (umbrales 15/50/100) con 45 min de antigüedad
    await upsertObservations(db, [flow("saih:293", 80, minsAgo(45))]);
    const bena = (await service.risk({ station: "virtual:benaguasil", now }))[0]!;
    const c = bena.components.find((c) => c.source === "saih:16693")!;
    expect(c.level).toBe("naranja"); // 80 ≥ 50; no se descarta por "obsoleto"
    expect(bena.warnings.join(" ")).not.toMatch(/obsoleto de EMBALSE DE BENAGÉBER/);
    expect(bena.level).toBe("naranja");
  });

  it("pero un embalse mudo de verdad (3 h) sí se descarta", async () => {
    await upsertObservations(db, [flow("saih:293", 80, minsAgo(180))]);
    const bena = (await service.risk({ station: "virtual:benaguasil", now }))[0]!;
    expect(bena.components.some((c) => c.source === "saih:16693")).toBe(false);
    expect(bena.warnings.join(" ")).toMatch(/obsoleto/);
  });

  it("no suma entre estaciones: 15 mm en tres pluviómetros siguen siendo verde", async () => {
    await upsertObservations(db, [
      rain("saih:371", 15),
      rain("saih:232", 15),
      rain("saih:227", 15),
    ]);
    const r = await albal();
    const c = r.components.find((c) => c.kind === "rain_observed")!;
    expect(c.value).toBe(15);
    expect(c.level).toBe("verde");
    expect(r.level).toBe("verde");
  });

  it("la lluvia prevista la marca la mediana: un modelo desatado no enciende el semáforo", async () => {
    const rows = [
      ...forecast("open-meteo:icon_eu", 0.5),
      ...forecast("open-meteo:ecmwf_ifs", 0.5),
      ...forecast("open-meteo:gfs_seamless", 0.5),
      ...forecast("open-meteo:arpege_europe", 0.5),
      ...forecast("aemet", 0.5),
      ...forecast("open-meteo:meteofrance_arome_france_hd", 20), // 240 mm en 12 h
    ];
    await upsertForecasts(db, rows);
    const r = await albal();
    const c12 = r.components.find((c) => c.kind === "rain_forecast" && c.detail.includes("12 h"))!;
    expect(c12.level).toBe("verde"); // mediana 6 mm
    expect(c12.detail).toContain("máximo 240 mm");
    expect(r.level).toBe("verde");
  });

  it("cuando los modelos coinciden en lluvia fuerte, el semáforo sube", async () => {
    const rows = ["aemet", "open-meteo:icon_eu", "open-meteo:ecmwf_ifs"].flatMap((s) =>
      forecast(s, 10),
    ); // 120 mm en 12 h
    await upsertForecasts(db, rows);
    const r = await albal();
    const c12 = r.components.find((c) => c.kind === "rain_forecast" && c.detail.includes("12 h"))!;
    expect(c12.level).toBe("naranja"); // mediana 120 ≥ 100
    expect(r.level).toBe("naranja");
  });

  it("un aviso de lluvias eleva el nivel; uno de viento no", async () => {
    const add = (id: string, code: string, level: string) =>
      pg`insert into alerts (id, source, area_code, event_code, event, level, severity, onset, expires, sent, raw)
         values (${id}, 'aemet', '774602', ${code}, ${"Aviso " + code}, ${level}, 'Severe',
                 now() - interval '1 hour', now() + interval '6 hours', now(), '{}'::jsonb)`;
    await add("viento", "VI", "rojo");
    let r = await albal();
    expect(r.level).toBe("verde");
    expect(r.alerts.find((a) => a.id === "viento")!.counts).toBe(false);

    await add("lluvias", "PR", "naranja");
    r = await albal();
    expect(r.level).toBe("naranja");
    expect(r.components.some((c) => c.kind === "alert" && c.level === "naranja")).toBe(true);
    expect(r.alerts).toHaveLength(2);
  });

  it("un aviso caducado no cuenta", async () => {
    await pg`insert into alerts (id, source, area_code, event_code, event, level, severity, onset, expires, sent, raw)
             values ('viejo', 'aemet', '774602', 'PR', 'Aviso', 'rojo', 'Severe',
                     now() - interval '12 hours', now() - interval '1 hour', now(), '{}'::jsonb)`;
    const r = await albal();
    expect(r.alerts).toHaveLength(0);
    expect(r.level).toBe("verde");
  });

  it("Albal y Benetússer comparten el aforo del Poyo", async () => {
    await upsertObservations(db, [flow("saih:227", 80)]);
    const all = await service.risk({ now });
    const albalR = all.find((s) => s.station.id === "virtual:albal")!;
    const bene = all.find((s) => s.station.id === "virtual:benetusser")!;
    expect(albalR.level).toBe("naranja");
    expect(bene.level).toBe("naranja");
    expect(bene.components[0]!.source).toBe("saih:13873");
  });

  it("GET /api/v1/risk devuelve las 4 localizaciones con Albal primero", async () => {
    const r = await app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: "GET", url: "/api/v1/risk" });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      stations: { station: { id: string; primary: boolean }; level: string }[];
    };
    expect(body.stations).toHaveLength(4);
    expect(body.stations[0]!.station.id).toBe("virtual:albal");
    expect(body.stations[0]!.station.primary).toBe(true);
    expect(
      body.stations.every((s) => ["verde", "amarillo", "naranja", "rojo"].includes(s.level)),
    ).toBe(true);
  });

  it("GET /api/v1/risk?station= filtra, y una estación inexistente da 404", async () => {
    const get = (url: string) => app.getHttpAdapter().getInstance().inject({ method: "GET", url });
    const ok = await get("/api/v1/risk?station=virtual:benaguasil");
    expect((ok.json() as { stations: unknown[] }).stations).toHaveLength(1);
    expect((await get("/api/v1/risk?station=virtual:nada")).statusCode).toBe(404);
  });
});
