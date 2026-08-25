import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, evaluateRisk, type AlertRow } from "@talaia/shared";
import { migrate } from "@talaia/db";
import { resetDatabase } from "@talaia/db/testing";
import { MeteoalarmClient } from "../src/client.js";
import { collect, upsertAlerts } from "../src/run.js";
import { parseFeed } from "../src/parse.js";
import type { MeteoalarmFeed } from "../src/client.js";

const URL_ = process.env.DATABASE_URL ?? "postgres://talaia:talaia@localhost:5433/talaia";
const raw = readFileSync(new URL("../fixtures/feeds-spain.json", import.meta.url), "utf8");
const feed = JSON.parse(raw) as MeteoalarmFeed;

const client = (body = raw) =>
  new MeteoalarmClient({
    fetch: (async () => new Response(body, { status: 200 })) as unknown as typeof fetch,
  });

describe.skipIf(!process.env.TALAIA_INTEGRATION)("collector Meteoalarm (integración)", () => {
  const { db, sql: pg, close } = createDb(URL_, { max: 2 });
  const now = new Date();

  /** Las fechas de la fixture ya pasaron: para probar la vigencia se desplazan a ahora. */
  const vigente = (rows: AlertRow[]): AlertRow[] =>
    rows.map((r) => ({
      ...r,
      onset: new Date(now.getTime() - 3.6e6),
      expires: new Date(now.getTime() + 6 * 3.6e6),
    }));

  beforeAll(async () => {
    await resetDatabase(pg);
    await migrate(URL_);
  });
  afterAll(close);
  beforeEach(async () => {
    await pg`delete from alerts`;
    await pg`update source_status set payload_hash = null where source = 'meteoalarm'`;
  });

  it("escribe en alerts solo los avisos de nuestras zonas", async () => {
    const r = await collect(db, { client: client() });
    expect(r.recordsWritten).toBeGreaterThan(0);
    const rows = await db.execute<{ source: string; area_code: string; level: string }>(
      sql`select source, area_code, level from alerts`,
    );
    expect(rows.every((x) => x.source === "meteoalarm")).toBe(true);
    expect(rows.every((x) => ["774602", "774604"].includes(x.area_code))).toBe(true);
    expect(rows.every((x) => x.level !== "verde")).toBe(true);
  });

  it("no reescribe si el feed no ha cambiado", async () => {
    const first = await collect(db, { client: client() });
    await pg`insert into source_status (source, payload_hash) values ('meteoalarm', ${first.payloadHash!})
             on conflict (source) do update set payload_hash = excluded.payload_hash`;
    const second = await collect(db, { client: client() });
    expect(second.recordsWritten).toBe(0);
  });

  it("el semáforo usa el aviso de Meteoalarm cuando no hay clave de AEMET", async () => {
    await upsertAlerts(db, vigente(parseFeed(feed, new Set(["774602", "774604"]))));
    const [albal] = await evaluateRisk(db, { station: "virtual:albal", now });
    const aviso = albal!.alerts.find((a) => a.event_code === "PR")!;
    expect(aviso.source).toBe("meteoalarm");
    expect(aviso.counts).toBe(true);
    expect(albal!.level).toBe("amarillo");
    // el aviso de costeros aparece, pero no eleva el semáforo
    expect(albal!.alerts.find((a) => a.event_code === "CO")?.counts).toBe(false);
  });

  it("cuando AEMET publica el mismo aviso, se cuenta una vez y manda AEMET", async () => {
    const rows = vigente(parseFeed(feed, new Set(["774602"])));
    await upsertAlerts(db, rows);
    const lluvia = rows.find((r) => r.eventCode === "PR")!;
    // el mismo aviso tal como lo escribiría el collector de AEMET: otro id, misma alerta
    await pg`insert into alerts (id, source, area_code, event_code, event, level, severity,
                                 onset, expires, sent, raw)
             values ('2.49.0.0.724.0.ES.20260825120000.774602PRP1#774602', 'aemet', '774602', 'PR',
                     ${lluvia.event!}, ${lluvia.level}, 'Moderate',
                     ${lluvia.onset.toISOString()}::timestamptz,
                     ${lluvia.expires.toISOString()}::timestamptz, now(), '{}'::jsonb)`;

    const [albal] = await evaluateRisk(db, { station: "virtual:albal", now });
    const lluvias = albal!.alerts.filter((a) => a.event_code === "PR");
    expect(lluvias).toHaveLength(1);
    expect(lluvias[0]!.source).toBe("aemet");
    // y el semáforo no cuenta dos veces el mismo aviso
    expect(albal!.components.filter((c) => c.kind === "alert")).toHaveLength(1);
  });
});
