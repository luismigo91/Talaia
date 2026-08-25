import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, loadSensors, runWithStatus, thresholdLevel } from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { SaihClient } from "../src/client.js";
import { collect, SOURCE } from "../src/run.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";
const fx = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

const caudal = fx("valor-13873-caudal.json");
const muestrasCaudal = (JSON.parse(caudal) as unknown[]).length;
const lluvia = fx("valor-13871-intensidad.json");

/** Cliente contra un portal simulado: caudal para 13873, intensidad para 13871, vacío para el resto. */
function client(opts: { failing?: string[] } = {}) {
  const fetchFn = (async (url: string) => {
    const id = /valor\/(\d+)\//.exec(url)?.[1] ?? "";
    if (opts.failing?.includes(id)) return new Response("boom", { status: 500 });
    if (id === "13873") return new Response(caudal, { status: 200 });
    if (id === "13871") return new Response(lluvia, { status: 200 });
    return new Response("[]", { status: 200 });
  }) as unknown as typeof fetch;
  return new SaihClient({ fetch: fetchFn, minIntervalMs: 0, sleep: async () => {} });
}

const NOW = new Date("2026-08-25T12:00:00Z");

describe.skipIf(!process.env.TALAIA_INTEGRATION)("collector SAIH (integración)", () => {
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  beforeAll(async () => {
    await resetDatabase(pg);
    await migrate(URL_);
  });
  afterAll(close);

  it("siembra el catálogo con geometría en WGS84 y umbrales oficiales", async () => {
    const sensors = await loadSensors(db, SOURCE);
    expect(sensors.length).toBeGreaterThan(50);
    const poyo = sensors.find((s) => s.externalId === "13873")!;
    expect(poyo.stationId).toBe("saih:227");
    expect(poyo.variable).toBe("river_flow_m3s");
    expect([poyo.thresholdLow, poyo.thresholdMid, poyo.thresholdHigh]).toEqual([30, 70, 150]);
    expect(thresholdLevel(80, poyo)).toBe("naranja");

    const [geo] = await db.execute<{ lat: number; lon: number }>(
      sql`select ST_Y(geom) as lat, ST_X(geom) as lon from stations where id = 'saih:227'`,
    );
    expect(Number(geo!.lat)).toBeCloseTo(39.47, 1);
    expect(Number(geo!.lon)).toBeCloseTo(-0.58, 1);

    // las estaciones virtuales del MVP no se ven afectadas
    const [n] = await db.execute<{ n: number }>(
      sql`select count(*)::int n from stations where source = 'virtual'`,
    );
    expect(n!.n).toBe(4);
  });

  it("escribe observaciones y deriva precipitación horaria, de forma idempotente", async () => {
    const r1 = await collect(db, { client: client(), now: () => NOW });
    expect(r1.recordsWritten).toBeGreaterThan(0);

    const flow = await db.execute<{ n: number; q: number }>(sql`
      select count(*)::int n, max(quality)::int q from observations
      where source = 'saih' and station_id = 'saih:227' and variable = 'river_flow_m3s'
    `);
    expect(flow[0]!.n).toBe(muestrasCaudal);
    expect(flow[0]!.q).toBe(128);

    const rate = await db.execute<{ n: number }>(sql`
      select count(*)::int n from observations
      where station_id = 'saih:227' and variable = 'precip_rate_mmh'
    `);
    expect(rate[0]!.n).toBeGreaterThan(0);

    const precip = await db.execute<{ n: number; unit: string }>(sql`
      select count(*)::int n, min(unit) as unit from observations
      where station_id = 'saih:227' and variable = 'precip_mm'
    `);
    expect(precip[0]!.n).toBeGreaterThan(0);
    expect(precip[0]!.unit).toBe("mm");

    // segunda pasada: mismos datos, sin duplicar
    await collect(db, { client: client(), now: () => NOW });
    const after = await db.execute<{ n: number }>(sql`
      select count(*)::int n from observations where source = 'saih' and station_id = 'saih:227'
    `);
    const total = await db.execute<{ n: number }>(sql`
      select count(*)::int n from observations where source = 'saih'
    `);
    expect(after[0]!.n).toBe(flow[0]!.n + Number(rate[0]!.n) + Number(precip[0]!.n));
    expect(total[0]!.n).toBeGreaterThan(0);
  });

  it("un sensor caído no tumba el ciclo: éxito con aviso en source_status", async () => {
    const result = await runWithStatus(db, "saih:test", () =>
      collect(db, { client: client({ failing: ["13873"] }), now: () => NOW }),
    );
    expect(result).toBeDefined();
    expect(result!.warning).toContain("13873");

    const [row] = await db.execute<{
      last_success_at: string | null;
      last_error: string | null;
      records_written: number | null;
    }>(sql`
      select last_success_at, last_error, records_written
      from source_status where source = 'saih:test'
    `);
    expect(row!.last_success_at).not.toBeNull();
    expect(row!.last_error).toContain("13873");
  });

  it("si falla todo el portal, el ciclo se registra como fallo", async () => {
    const fetchFn = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    const dead = new SaihClient({ fetch: fetchFn, minIntervalMs: 0, sleep: async () => {} });
    const result = await runWithStatus(db, "saih:dead", () =>
      collect(db, { client: dead, now: () => NOW }),
    );
    expect(result).toBeUndefined();
    const [row] = await db.execute<{ last_success_at: string | null; last_error: string | null }>(
      sql`select last_success_at, last_error from source_status where source = 'saih:dead'`,
    );
    expect(row!.last_success_at).toBeNull();
    expect(row!.last_error).toMatch(/ningún sensor respondió/);
  });
});
