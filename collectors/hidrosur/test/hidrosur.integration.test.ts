import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, loadSensors } from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { HidrosurClient } from "../src/client.js";
import { collect, SOURCE } from "../src/run.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";
const fx = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

const rios = fx("resumen-rios.html");
const embalses = fx("resumen-embalses.html");
const graficaR = fx("grafica-038R03.html");
const graficaP = fx("grafica-086P01.html");

/** Portal simulado con las capturas reales: tablas + una gráfica con datos para todo. */
function client() {
  const fetchFn = (async (url: string) => {
    if (url.endsWith("/resumen/rios")) return new Response(rios, { status: 200 });
    if (url.endsWith("/resumen/embalses")) return new Response(embalses, { status: 200 });
    if (url.includes("/grafica/")) {
      return new Response(url.includes("P01") ? graficaP : graficaR, { status: 200 });
    }
    return new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
  return new HidrosurClient({ fetch: fetchFn });
}

describe.skipIf(!process.env.TALAIA_INTEGRATION)("collector Hidrosur (integración)", () => {
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  beforeAll(async () => {
    await resetDatabase(pg);
    await migrate(URL_);
  });
  afterAll(close);

  it("siembra el catálogo Hidrosur con watch_points en Málaga y Rincón", async () => {
    const sensors = await loadSensors(db, SOURCE);
    expect(sensors.length).toBe(24);
    expect(sensors.find((s) => s.id === "hidrosur:38:river_flow_m3s")?.stationId).toBe(
      "hidrosur:38",
    );
    const points = await db.execute<{ station_id: string; n: number }>(
      sql`select station_id, count(*)::int n from watch_points where station_id in ('virtual:malaga', 'virtual:rincon-de-la-victoria') group by 1 order by 1`,
    );
    expect(points.map((p) => [p.station_id, p.n])).toEqual([
      ["virtual:malaga", 8],
      ["virtual:rincon-de-la-victoria", 6],
    ]);
  });

  it("escribe nivel, caudal, lluvia y volúmenes desde las capturas", async () => {
    const r = await collect(db, { client: client() });
    expect(r.recordsWritten).toBeGreaterThan(100);
    const rows = await db.execute<{ station_id: string; variable: string; value: number }>(
      sql`select station_id, variable, value from observations where source = 'hidrosur' and station_id in ('hidrosur:38', 'hidrosur:22', 'hidrosur:20')`,
    );
    const get = (s: string, v: string) => rows.find((x) => x.station_id === s && x.variable === v);
    expect(Number(get("hidrosur:38", "river_flow_m3s")!.value)).toBeCloseTo(0.01, 5);
    expect(Number(get("hidrosur:20", "reservoir_hm3")!.value)).toBeCloseTo(14, 5);
    expect(Number(get("hidrosur:22", "precip_mm")!.value)).toBeGreaterThanOrEqual(0);
  });
});
