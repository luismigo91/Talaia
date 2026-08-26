import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  createDb,
  listenRiskChanges,
  runRiskCycle,
  upsertObservations,
  type Notifier,
  type ObservationRow,
  type RiskNotification,
} from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { createApp } from "../src/app.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";

/** Notificador de prueba: recuerda lo enviado y puede fallar a voluntad. */
class SpyNotifier implements Notifier {
  sent: RiskNotification[] = [];
  fail = false;
  async send(n: RiskNotification) {
    if (this.fail) throw new Error("ntfy respondió HTTP 500");
    this.sent.push(n);
  }
}

describe.skipIf(!process.env.TALAIA_INTEGRATION)("histórico y notificaciones (integración)", () => {
  let app: NestFastifyApplication;
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  const now = new Date();
  const minsAgo = (n: number) => new Date(now.getTime() - n * 60_000);
  const flow = (value: number, ts = minsAgo(5)): ObservationRow => ({
    source: "saih",
    stationId: "saih:227",
    variable: "river_flow_m3s",
    ts,
    value,
    unit: "m³/s",
    quality: 0,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    await resetDatabase(pg);
    await migrate(URL_);
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
    await close();
  });
  beforeEach(async () => {
    await pg`delete from risk_events`;
    await pg`delete from risk_state`;
    await pg`delete from observations`;
    await pg`delete from forecasts`;
    await pg`delete from alerts`;
  });

  const cycle = (notifier: Notifier, at = now) =>
    runRiskCycle(db, { notifier, now: at, confirmations: 3 });
  const eventsOf = (station: string) =>
    pg`select level, previous_level, direction, notified, notify_error from risk_events
       where station_id = ${station} order by id`;
  const levelOf = async (station: string) =>
    (
      await pg`select level, pending_level, pending_count from risk_state where station_id = ${station}`
    )[0];

  it("una subida se registra y se notifica en el mismo ciclo", async () => {
    await upsertObservations(db, [flow(80)]); // Poyo: 30/70/150 → naranja
    const spy = new SpyNotifier();
    const r = await cycle(spy);
    expect(
      r.transitions.some((t) => t.stationId === "virtual:albal" && t.level === "naranja"),
    ).toBe(true);

    const events = await eventsOf("virtual:albal");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ level: "naranja", direction: "subida", notified: true });
    const aviso = spy.sent.find((n) => n.stationId === "virtual:albal")!;
    expect(aviso.previousLevel).toBeNull();
    expect(aviso.reason).toContain("RAMBLA POYO");
  });

  it("un nivel que se mantiene no vuelve a notificar", async () => {
    await upsertObservations(db, [flow(80)]);
    const spy = new SpyNotifier();
    await cycle(spy);
    await cycle(spy);
    await cycle(spy);
    expect(await eventsOf("virtual:albal")).toHaveLength(1);
    expect(spy.sent.filter((n) => n.stationId === "virtual:albal")).toHaveLength(1);
  });

  it("una bajada necesita tres ciclos; el nivel se mantiene mientras tanto", async () => {
    await upsertObservations(db, [flow(80)]);
    const spy = new SpyNotifier();
    await cycle(spy);
    await pg`delete from observations`;
    await upsertObservations(db, [flow(1)]); // vuelve a verde

    await cycle(spy);
    expect((await levelOf("virtual:albal")).level).toBe("naranja");
    expect((await levelOf("virtual:albal")).pending_level).toBe("verde");
    await cycle(spy);
    expect((await levelOf("virtual:albal")).level).toBe("naranja");
    await cycle(spy);
    expect((await levelOf("virtual:albal")).level).toBe("verde");

    const events = await eventsOf("virtual:albal");
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      level: "verde",
      previous_level: "naranja",
      direction: "bajada",
    });
  });

  it("una subida durante una bajada pendiente se aplica de inmediato", async () => {
    await upsertObservations(db, [flow(80)]);
    const spy = new SpyNotifier();
    await cycle(spy);
    await pg`delete from observations`;
    await upsertObservations(db, [flow(1)]);
    await cycle(spy); // bajada pendiente
    await pg`delete from observations`;
    await upsertObservations(db, [flow(200)]); // rojo
    await cycle(spy);

    const state = await levelOf("virtual:albal");
    expect(state.level).toBe("rojo");
    expect(state.pending_level).toBeNull();
    const events = await eventsOf("virtual:albal");
    expect(events.at(-1)).toMatchObject({ level: "rojo", direction: "subida" });
  });

  it("sin datos evaluables se conserva el nivel anterior", async () => {
    await upsertObservations(db, [flow(80)]);
    const spy = new SpyNotifier();
    await cycle(spy);
    await pg`delete from observations`; // todo mudo
    await cycle(spy);
    await cycle(spy);
    await cycle(spy);
    await cycle(spy);
    expect((await levelOf("virtual:albal")).level).toBe("naranja");
    expect(await eventsOf("virtual:albal")).toHaveLength(1);
  });

  it("si el canal falla, la transición queda registrada con el error", async () => {
    await upsertObservations(db, [flow(200)]);
    const spy = new SpyNotifier();
    spy.fail = true;
    const r = await cycle(spy);
    expect(r.transitions.length).toBeGreaterThan(0); // el ciclo no falla
    const events = await eventsOf("virtual:albal");
    expect(events[0]).toMatchObject({ level: "rojo", notified: false });
    expect(events[0]!.notify_error).toContain("HTTP 500");
  });

  it("GET /api/v1/risk/history devuelve las transiciones, de la más reciente a la más antigua", async () => {
    const spy = new SpyNotifier();
    await upsertObservations(db, [flow(80)]);
    await cycle(spy);
    await pg`delete from observations`;
    await upsertObservations(db, [flow(200)]);
    await cycle(spy, new Date(now.getTime() + 60_000));

    const get = (url: string) => app.getHttpAdapter().getInstance().inject({ method: "GET", url });
    const r = await get("/api/v1/risk/history?station=virtual:albal");
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      events: {
        level: string;
        previous_level: string | null;
        direction: string;
        station: { id: string };
      }[];
    };
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({
      level: "rojo",
      previous_level: "naranja",
      direction: "subida",
    });
    expect(body.events[0]!.station.id).toBe("virtual:albal");

    expect((await get("/api/v1/risk/history?limit=1")).json()).toHaveProperty("events.length", 1);
    expect((await get("/api/v1/risk/history?limit=999")).statusCode).toBe(400);
  });

  it("el ciclo registra su estado en source_status como cualquier collector", async () => {
    const { runWithStatus } = await import("@talaia/shared");
    await upsertObservations(db, [flow(80)]);
    await runWithStatus(db, "risk", () => cycle(new SpyNotifier()));
    const [row] =
      await pg`select last_success_at, records_written from source_status where source = 'risk'`;
    expect(row!.last_success_at).not.toBeNull();
    expect(Number(row!.records_written)).toBeGreaterThan(0);
  });

  it("un cambio de nivel se anuncia por Postgres para el stream en vivo", async () => {
    const recibidos: string[] = [];
    const stop = await listenRiskChanges((payload) => recibidos.push(payload), URL_);
    try {
      await upsertObservations(db, [flow(200)]);
      await cycle(new SpyNotifier());
      // el NOTIFY viaja por otra conexión: se espera un momento a que llegue
      for (let i = 0; i < 40 && recibidos.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(recibidos.length).toBeGreaterThan(0);
      const evento = JSON.parse(recibidos[0]!) as {
        stationId: string;
        level: string;
        direction: string;
      };
      expect(evento.level).toBe("rojo");
      expect(evento.direction).toBe("subida");
      expect(evento.stationId).toMatch(/^virtual:/);
    } finally {
      await stop();
    }
  });
});
