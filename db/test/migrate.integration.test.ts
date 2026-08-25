import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, latestForecastTs, loadVirtualStations, upsertForecasts } from "@talaia/shared";
import { OpenMeteoClient, collect } from "@talaia/collector-open-meteo";
import { migrate } from "../src/migrate.js";
import { resetDatabase } from "../src/testing.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";

describe.skipIf(!process.env.TALAIA_INTEGRATION)(
  "migraciones y collector Open-Meteo (integración)",
  () => {
    const { db, sql: pg, close } = createDb(URL_, { max: 2 });

    beforeAll(async () => {
      await resetDatabase(pg);
      const applied = await migrate(URL_);
      expect(applied.length).toBe(6);
    });
    afterAll(close);

    it("migración idempotente", async () => {
      expect(await migrate(URL_)).toEqual([]);
    });

    it("hypertables, políticas y semillas", async () => {
      const ht = await db.execute<{ hypertable_name: string }>(
        sql`select hypertable_name from timescaledb_information.hypertables order by 1`,
      );
      expect(ht.map((r) => r.hypertable_name)).toEqual([
        "forecasts",
        "observations",
        "raw_payloads",
      ]);
      const jobs = await db.execute<{ n: number }>(
        sql`select count(*)::int n from timescaledb_information.jobs where proc_name='policy_retention'`,
      );
      expect(jobs[0]!.n).toBe(2);
      const stations = await loadVirtualStations(db);
      expect(stations.map((s) => s.id)).toEqual([
        "virtual:albal",
        "virtual:benaguasil",
        "virtual:benetusser",
        "virtual:mareny-barraquetes",
      ]);
      expect(stations[0]!.primary).toBe(true);
      expect(stations[0]!.ine).toBe("46007");
    });

    it("upsert de forecasts: la misma clave con otro valor deja una sola fila", async () => {
      const base = {
        source: "open-meteo:icon_eu",
        stationId: "virtual:albal",
        variable: "precip_mm",
        forecastTs: new Date("2026-01-01T00:00:00Z"),
        ts: new Date("2026-01-01T03:00:00Z"),
        unit: "mm",
      };
      await upsertForecasts(db, [{ ...base, value: 1 }]);
      await upsertForecasts(db, [{ ...base, value: 2 }]);
      const rows = await db.execute<{ value: number; n: number }>(
        sql`select value, count(*) over() n from forecasts where source='open-meteo:icon_eu' and variable='precip_mm'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe(2);
      await pg`delete from forecasts`;
    });

    it("collector con fixture: escribe 4 estaciones y es idempotente por corrida", async () => {
      const body = readFileSync(
        new URL("../../collectors/open-meteo/fixtures/forecast-2loc.json", import.meta.url),
        "utf8",
      );
      const two = JSON.parse(body) as unknown[];
      const four = JSON.stringify([...two, ...two]);
      const meta = readFileSync(
        new URL("../../collectors/open-meteo/fixtures/meta-dwd_icon_eu.json", import.meta.url),
        "utf8",
      );
      let calls = 0;
      const fetchFn = (async (url: string) => {
        calls++;
        return new Response(String(url).includes("/static/meta.json") ? meta : four, {
          status: 200,
        });
      }) as unknown as typeof fetch;
      const client = new OpenMeteoClient({ fetch: fetchFn });

      const r1 = await collect(db, { client });
      expect(r1.recordsWritten).toBeGreaterThan(1000);
      const perStation = await db.execute<{ station_id: string; n: number }>(
        sql`select station_id, count(*)::int n from forecasts group by 1 order by 1`,
      );
      expect(perStation).toHaveLength(4);
      const ts = await latestForecastTs(db, "open-meteo:icon_eu");
      expect(ts?.toISOString()).toBe(
        new Date(JSON.parse(meta).last_run_initialisation_time * 1000).toISOString(),
      );

      const before = calls;
      const r2 = await collect(db, { client });
      expect(r2.recordsWritten).toBe(0);
      // solo consultas meta.json (6), ninguna al forecast
      expect(calls - before).toBe(6);
    });
  },
);
