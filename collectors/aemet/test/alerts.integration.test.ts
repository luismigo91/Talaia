import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@talaia/shared";
import { AemetClient } from "../src/client.js";
import {
  collectAlerts,
  collectForecast,
  collectObservations,
  forecastSource,
  upsertAlerts,
} from "../src/run.js";
import { extractXmlFromTarGz, parseCap } from "../src/cap.js";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";

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

  it("observación: da de alta la estación con sus coordenadas y escribe las series", async () => {
    const obs = readFileSync(fx("observacion-8337X.json"));
    const fetchFn = (async (url: string) => {
      if (url.includes("/api/")) {
        return new Response(JSON.stringify({ estado: 200, datos: "https://x/sh/obs" }), {
          status: 200,
        });
      }
      return new Response(obs, { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const client = new AemetClient({ apiKey: "KEY", fetch: fetchFn, minIntervalMs: 0 });

    const r = await collectObservations(db, client, ["8337X"]);
    expect(r.recordsWritten).toBeGreaterThan(10);
    expect(r.warning).toBeUndefined();

    // la estación se autopobla con las coordenadas que trae la propia respuesta
    const [station] = await db.execute<{ name: string; lat: number; lon: number; alt: number }>(
      sql`select name, ST_Y(geom) as lat, ST_X(geom) as lon, elevation_m as alt
          from stations where id = 'aemet:8337X'`,
    );
    expect(station!.name).toBe("TURIS");
    expect(Number(station!.lat)).toBeCloseTo(39.389, 2);
    expect(Number(station!.lon)).toBeCloseTo(-0.7125, 3);

    // y sus variables entran en el catálogo de sensores, sin umbrales
    const sensores = await db.execute<{ n: number }>(
      sql`select count(*)::int n from sensors where source = 'aemet' and station_id = 'aemet:8337X'`,
    );
    expect(sensores[0]!.n).toBeGreaterThan(3);

    const lluvia = await db.execute<{ value: number; ts: string }>(sql`
      select value, ts from observations
      where source = 'aemet:observation' and station_id = 'aemet:8337X' and variable = 'precip_mm'
      order by ts
    `);
    expect(lluvia.map((r) => Number(r.value))).toEqual([0, 1.4]);

    // repetir no duplica
    await collectObservations(db, client, ["8337X"]);
    const [n] = await db.execute<{ n: number }>(
      sql`select count(*)::int n from observations where source = 'aemet:observation'`,
    );
    expect(n!.n).toBe(r.recordsWritten);
  });

  it("una estación caída no impide las demás; si fallan todas, el ciclo falla", async () => {
    const fetchFn = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const client = new AemetClient({ apiKey: "KEY", fetch: fetchFn, minIntervalMs: 0 });
    await expect(collectObservations(db, client, ["8416"])).rejects.toThrow(/ninguna estación/);
  });
});
