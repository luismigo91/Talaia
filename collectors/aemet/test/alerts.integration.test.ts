import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@talaia/shared";
import { AemetClient } from "../src/client.js";
import { collectAlerts, collectForecast, forecastSource, upsertAlerts } from "../src/run.js";
import { extractXmlFromTarGz, parseCap } from "../src/cap.js";
import { migrate } from "../../../db/src/migrate.js";
import { resetDatabase } from "../../../db/src/testing.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";
const fx = (f: string) => new URL(`../fixtures/${f}`, import.meta.url);

describe.skipIf(!process.env.TALAIA_INTEGRATION)("collector AEMET (integración)", () => {
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  beforeAll(async () => {
    await resetDatabase(pg);
    await migrate(URL_);
  });
  afterAll(close);

  it("upsert de avisos: inserta 2, actualiza sin duplicar y guarda geometría", async () => {
    const files = await extractXmlFromTarGz(readFileSync(fx("avisos-77.tar.gz")));
    const found = files.flatMap((f) => parseCap(f.xml, new Set(["774602", "774604"])));
    expect(await upsertAlerts(db, found)).toBe(2);
    const updated = found.map((a) => ({
      ...a,
      level: "rojo" as const,
      sent: new Date(a.sent.getTime() + 3600e3),
    }));
    await upsertAlerts(db, updated);
    const rows = await db.execute<{
      id: string;
      level: string;
      has_geom: boolean;
      area_code: string;
    }>(
      sql`select id, level, geom is not null as has_geom, area_code from alerts order by area_code`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.level)).toEqual(["rojo", "rojo"]);
    expect(rows.every((r) => r.has_geom)).toBe(true);
    const inside = await db.execute<{ n: number }>(
      sql`select count(*)::int n from alerts a join stations s on s.id='virtual:albal' where ST_Contains(a.geom, s.geom)`,
    );
    expect(inside[0]!.n).toBe(1); // el polígono de Litoral norte contiene Albal
  });

  it("predicción por INE con caché por hash y avisos con cliente simulado", async () => {
    const hourly = readFileSync(fx("horaria-28065.json"));
    const tar = readFileSync(fx("avisos-77.tar.gz"));
    const fetchFn = (async (url: string) => {
      if (url.includes("/api/")) {
        const datos = url.includes("avisos_cap") ? "https://x/sh/cap" : "https://x/sh/hourly";
        return new Response(JSON.stringify({ estado: 200, datos }), { status: 200 });
      }
      if (url.endsWith("/cap")) return new Response(tar, { status: 200 });
      return new Response(hourly, {
        status: 200,
        headers: { "content-type": "text/plain;charset=UTF-8" },
      });
    }) as unknown as typeof fetch;
    const client = new AemetClient({ apiKey: "KEY", fetch: fetchFn, minIntervalMs: 0 });

    const r1 = await collectForecast(db, client, "46007", [
      {
        id: "virtual:albal",
        name: "Albal",
        lat: 0,
        lon: 0,
        ine: "46007",
        aemetZone: "774602",
        primary: true,
      },
    ]);
    expect(r1.recordsWritten).toBeGreaterThan(100);
    // guardamos el hash como haría runWithStatus y repetimos: sin cambios
    await pg`insert into source_status (source, payload_hash) values (${forecastSource("46007")}, ${r1.payloadHash!})`;
    const r2 = await collectForecast(db, client, "46007", []);
    expect(r2.recordsWritten).toBe(0);

    const a = await collectAlerts(db, client, "77");
    expect(a.recordsWritten).toBe(2);
  });
});
