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
  const forecast = (
    source: string,
    mmPerHour: number,
    hours = 24,
    forecastTs = minsAgo(60),
  ): ForecastRow[] =>
    Array.from({ length: hours }, (_, i) => ({
      source,
      stationId: "virtual:albal",
      variable: "precip_mm",
      forecastTs,
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
    await pg`delete from runoff_models`;
  });

  /** Modelo lluvia‑caudal de prueba para el Poyo: Q = 0,5·P^1,8, ventana 3 h, 120 min. */
  const poyoModel = () =>
    pg`insert into runoff_models (id, station_id, flow_sensor_id, rain_sensor_ids, window_hours, lag_minutes, coef_a, coef_b, min_rain_mm, meta)
       values ('test:poyo', 'virtual:albal', 'saih:13873',
               array['saih:371:precip_mm','saih:232:precip_mm','saih:789:precip_mm'],
               3, 120, 0.5, 1.8, 1, '{"source":"test"}'::jsonb)`;

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

  it("la lluvia de cabecera anticipa el caudal del Poyo con el modelo calibrado", async () => {
    await poyoModel();
    // 3 h × 20 mm en Chiva y Turís, Siete Aguas seca: media de cabecera = 40 mm en 3 h
    const hours = [minsAgo(70), minsAgo(130), minsAgo(190)];
    await upsertObservations(db, [
      ...hours.map((ts) => rain("saih:371", 20, ts)),
      ...hours.map((ts) => rain("saih:789", 20, ts)),
      ...hours.map((ts) => rain("saih:232", 0, ts)),
    ]);
    const r = await albal();
    const c = r.components.find((c) => c.kind === "flow_projected")!;
    expect(c).toBeDefined();
    // media 40 mm → 0,5·40^1,8 ≈ 386 m³/s → supera el rojo (150) pero se queda en naranja
    expect(c.value).toBeGreaterThan(150);
    expect(c.level).toBe("naranja");
    expect(c.threshold).toBe(70);
    expect(c.horizon_minutes).toBe(120);
    expect(c.source).toBe("saih:13873");
    expect(c.detail).toMatch(/^la lluvia en cabecera anticipa/);
    expect(c.detail).toContain("dentro de ~120 min");
    expect(c.detail).toContain("el rojo exige caudal medido");
    expect(r.level).toBe("naranja");
  });

  it("una proyección moderada da su nivel real y explica la ventana", async () => {
    await poyoModel();
    // 4 mm/h en las tres estaciones durante 3 h → 12 mm de media → 0,5·12^1,8 ≈ 44 m³/s → amarillo (≥ 30)
    const hours = [minsAgo(70), minsAgo(130), minsAgo(190)];
    await upsertObservations(
      db,
      ["saih:371", "saih:232", "saih:789"].flatMap((st) => hours.map((ts) => rain(st, 4, ts))),
    );
    const r = await albal();
    const c = r.components.find((c) => c.kind === "flow_projected")!;
    expect(c.level).toBe("amarillo");
    expect(c.value).toBeCloseTo(43.7, 0);
    expect(c.detail).toContain("12 mm de media en 3 h");
    expect(c.detail).toContain("CHIVA");
  });

  it("sin lluvia apreciable, o sin modelo, no hay caudal anticipado", async () => {
    await poyoModel();
    await upsertObservations(db, [rain("saih:371", 0.5, minsAgo(70))]);
    expect((await albal()).components.some((c) => c.kind === "flow_projected")).toBe(false);
    await pg`delete from runoff_models`;
    await upsertObservations(db, [rain("saih:371", 40, minsAgo(70))]);
    const r = await albal();
    expect(r.components.some((c) => c.kind === "flow_projected")).toBe(false);
    expect(r.components.some((c) => c.kind === "rain_observed")).toBe(true);
  });

  it("un modelo deshabilitado no se usa", async () => {
    await poyoModel();
    await pg`update runoff_models set enabled = false`;
    await upsertObservations(db, [rain("saih:371", 40, minsAgo(70))]);
    expect((await albal()).components.some((c) => c.kind === "flow_projected")).toBe(false);
  });

  it("la tendencia compara con las corridas de hace medio día para la misma ventana", async () => {
    const sources = ["open-meteo:icon_eu", "open-meteo:ecmwf_ifs", "open-meteo:gfs_seamless"];
    await upsertForecasts(db, [
      // hace 7 h: 2 mm/h → 24 mm en 12 h
      ...sources.flatMap((s) => forecast(s, 2, 24, minsAgo(7 * 60))),
      // hace 1 h: 10 mm/h → 120 mm en 12 h
      ...sources.flatMap((s) => forecast(s, 10, 24, minsAgo(60))),
    ]);
    const r = await albal();
    const c12 = r.components.find((c) => c.kind === "rain_forecast" && c.detail.includes("12 h"))!;
    expect(c12.level).toBe("naranja"); // el nivel lo sigue marcando la corrida vigente
    expect(c12.value).toBe(120);
    expect(c12.trend).toMatchObject({ previous: 24, delta: 96, direction: "sube", sources: 3 });
    expect(c12.detail).toContain("al alza: las corridas de hace 7 h daban 24 mm");
  });

  it("una corrida de hace solo 3 h no cuenta como anterior: sin tendencia", async () => {
    await upsertForecasts(db, [
      ...forecast("open-meteo:icon_eu", 2, 24, minsAgo(3 * 60)),
      ...forecast("open-meteo:icon_eu", 10, 24, minsAgo(60)),
    ]);
    const r = await albal();
    const c12 = r.components.find((c) => c.kind === "rain_forecast" && c.detail.includes("12 h"))!;
    expect(c12.trend).toBeNull();
    expect(c12.detail).not.toContain("corridas");
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

  it("un aviso futuro no sube el nivel pero aparece como preaviso de subida", async () => {
    await pg`insert into alerts (id, source, area_code, event_code, event, level, severity, onset, expires, sent, raw)
             values ('futuro', 'meteoalarm', '774602', 'PR', 'Aviso', 'rojo', 'Severe',
                     now() + interval '4 hours', now() + interval '10 hours', now(), '{}'::jsonb)`;
    const r = await albal();
    expect(r.level).toBe("verde");
    expect(r.upcoming_alerts).toHaveLength(1);
    expect(r.upcoming_alerts[0]).toMatchObject({ id: "futuro", level: "rojo" });
    expect(r.upcoming_alerts[0]!.onset).toBeDefined();
    expect(r.next_change).toMatchObject({ level: "rojo", direction: "sube" });
  });

  it("al vencer el rojo el preaviso anuncia la bajada al naranja vigente", async () => {
    await pg`insert into alerts (id, source, area_code, event_code, event, level, severity, onset, expires, sent, raw)
             values ('rojo-ahora', 'meteoalarm', '774602', 'PR', 'Aviso', 'rojo', 'Severe',
                     now() - interval '1 hour', now() + interval '2 hours', now(), '{}'::jsonb),
                    ('naranja-largo', 'meteoalarm', '774602', 'PR', 'Aviso', 'naranja', 'Severe',
                     now() - interval '1 hour', now() + interval '10 hours', now(), '{}'::jsonb)`;
    const r = await albal();
    expect(r.level).toBe("rojo");
    expect(r.next_change).toMatchObject({ level: "naranja", direction: "baja" });
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
