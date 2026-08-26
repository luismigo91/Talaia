import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, evaluateRisk } from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { GvaClient } from "../src/client.js";
import { collect } from "../src/run.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";
const fx = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");
const NOW = new Date("2026-10-29T13:00:00Z");

const client = (body: string) =>
  new GvaClient({
    fetch: (async () => new Response(body, { status: 200 })) as unknown as typeof fetch,
  });

describe.skipIf(!process.env.TALAIA_INTEGRATION)("collector GVA (integración)", () => {
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  beforeAll(async () => {
    await resetDatabase(pg);
    await migrate(URL_);
  });
  afterAll(close);
  beforeEach(() => pg`delete from alerts`);

  it("las estaciones se sembraron con sus zonas de emergencia", async () => {
    const rows = await db.execute<{ id: string; gz: string }>(
      sql`select id, meta->>'gva_zones' as gz from stations where source='virtual' order by id`,
    );
    const byId = new Map(rows.map((r) => [r.id, r.gz]));
    expect(byId.get("virtual:albal")).toContain("28");
    expect(byId.get("virtual:mareny-barraquetes")).toContain("33");
    expect(byId.get("virtual:benaguasil")).toContain("23");
  });

  it("sin emergencias activas no escribe nada", async () => {
    const r = await collect(db, {
      client: client(fx("emergencias-sin-avisos.json")),
      now: () => NOW,
    });
    expect(r.recordsWritten).toBe(0);
  });

  it("un aviso de Situación por inundaciones eleva el semáforo de la comarca", async () => {
    // fixture reconstruida: L'Horta Sud (28) en Situación 1, La Ribera Baixa (33) en Situación 2
    const r = await collect(db, {
      client: client(fx("emergencias-reconstruido.json")),
      now: () => NOW,
    });
    expect(r.recordsWritten).toBe(2);

    const [albal] = await evaluateRisk(db, { station: "virtual:albal", now: NOW });
    const comp = albal!.alerts.find((a) => a.source === "gva")!;
    expect(comp.level).toBe("naranja"); // Situación 1
    expect(comp.counts).toBe(true); // inundaciones sí eleva
    expect(albal!.level).toBe("naranja");

    // Sueca (Ribera Baixa) está en Situación 2 → rojo
    const [mareny] = await evaluateRisk(db, { station: "virtual:mareny-barraquetes", now: NOW });
    expect(mareny!.level).toBe("rojo");

    // Benaguasil (Camp de Túria, zona 23) no tiene aviso: no le afecta el de otra comarca
    const [benaguasil] = await evaluateRisk(db, { station: "virtual:benaguasil", now: NOW });
    expect(benaguasil!.alerts.some((a) => a.source === "gva")).toBe(false);
  });

  it("un aviso provincial (zona 51) afecta a todas las localidades de Valencia", async () => {
    const provincial = JSON.stringify({
      time: "2026-10-29 14:00:00.0",
      z2: { "51": [{ sit: 16, fen: 10 }] },
    });
    await collect(db, { client: client(provincial), now: () => NOW });
    for (const id of ["virtual:albal", "virtual:benaguasil", "virtual:mareny-barraquetes"]) {
      const [risk] = await evaluateRisk(db, { station: id, now: NOW });
      expect(risk!.alerts.some((a) => a.source === "gva" && a.level === "rojo")).toBe(true);
    }
  });

  it("el aviso caduca solo cuando desaparece de z2 (TTL)", async () => {
    await collect(db, { client: client(fx("emergencias-reconstruido.json")), now: () => NOW });
    // pasado el TTL, con z2 vacío, ya no cuenta
    const despues = new Date(NOW.getTime() + 31 * 60_000);
    await collect(db, { client: client(fx("emergencias-sin-avisos.json")), now: () => despues });
    const [albal] = await evaluateRisk(db, { station: "virtual:albal", now: despues });
    expect(albal!.alerts.some((a) => a.source === "gva")).toBe(false);
  });
});
