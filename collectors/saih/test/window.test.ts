import { describe, expect, it } from "vitest";
import type { SensorSpec } from "@talaia/shared";
import { OVERLAP_MS, backfillHours, windowStart } from "../src/run.js";

const s: SensorSpec = {
  id: "saih:13873",
  source: "saih",
  stationId: "saih:227",
  stationName: "Poyo",
  externalId: "13873",
  variable: "river_flow_m3s",
  unit: "m³/s",
  thresholdLow: 30,
  thresholdMid: 70,
  thresholdHigh: 150,
  meta: {},
};
const now = new Date("2026-08-25T12:00:00Z");
const key = "saih:227|river_flow_m3s";

describe("windowStart", () => {
  it("usa el backfill cuando no hay dato previo", () => {
    expect(windowStart(s, new Map(), now, 24).toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });

  it("arranca en el último dato menos el solape", () => {
    const last = new Date("2026-08-25T11:40:00Z");
    const from = windowStart(s, new Map([[key, last]]), now, 24);
    expect(from.getTime()).toBe(last.getTime() - OVERLAP_MS);
  });

  it("nunca retrocede más allá del backfill aunque el dato sea muy viejo", () => {
    const from = windowStart(s, new Map([[key, new Date("2026-01-01T00:00:00Z")]]), now, 24);
    expect(from.toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });

  it("no confunde sensores de la misma estación", () => {
    const latest = new Map([["saih:227|precip_rate_mmh", new Date("2026-08-25T11:55:00Z")]]);
    expect(windowStart(s, latest, now, 24).toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });
});

describe("backfillHours", () => {
  it("por defecto 24 h", () => {
    expect(backfillHours({} as NodeJS.ProcessEnv)).toBe(24);
  });
  it("respeta la variable de entorno", () => {
    expect(backfillHours({ SAIH_BACKFILL_HOURS: "6" } as NodeJS.ProcessEnv)).toBe(6);
  });
  it("tope de 168 h y valores absurdos al defecto", () => {
    expect(backfillHours({ SAIH_BACKFILL_HOURS: "9999" } as NodeJS.ProcessEnv)).toBe(168);
    expect(backfillHours({ SAIH_BACKFILL_HOURS: "-3" } as NodeJS.ProcessEnv)).toBe(24);
    expect(backfillHours({ SAIH_BACKFILL_HOURS: "hola" } as NodeJS.ProcessEnv)).toBe(24);
  });
});
