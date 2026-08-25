import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHourly, type AemetHourly } from "../src/hourly.js";

const load = (f: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8")) as AemetHourly[];

describe("parseHourly", () => {
  const rows = parseHourly(load("horaria-28065.json"), { stationId: "virtual:albal" });

  it("forecast_ts = elaborado en hora local convertida a UTC", () => {
    // 2021-01-09T11:47:45 CET → 10:47:45Z
    expect(rows[0]!.forecastTs.toISOString()).toBe("2021-01-09T10:47:45.000Z");
  });

  it("precipitación: periodo 07 (06–07 local) → ts 05:00Z en invierno, valor numérico", () => {
    const p = rows.find((r) => r.variable === "precip_mm" && r.value === 1.4)!;
    expect(p.ts.toISOString()).toBe("2021-01-09T05:00:00.000Z");
    expect(p.unit).toBe("mm");
    expect(p.stationId).toBe("virtual:albal");
  });

  it("probabilidad por tramos de 6 h → una fila por hora; valor vacío se omite", () => {
    const prob = rows.filter(
      (r) => r.variable === "precip_prob_pct" && r.ts < new Date("2021-01-09T23:00:00Z"),
    );
    // tramo 0107 viene vacío ("") en el fixture → no hay filas antes de las 07 locales
    expect(prob.some((r) => r.ts.getTime() < new Date("2021-01-09T06:00:00Z").getTime())).toBe(
      false,
    );
    const tramo0713 = prob.filter(
      (r) => r.ts >= new Date("2021-01-09T06:00:00Z") && r.ts < new Date("2021-01-09T12:00:00Z"),
    );
    expect(tramo0713).toHaveLength(6);
    expect(tramo0713.every((r) => r.value === 100)).toBe(true);
  });

  it("viento y racha en km/h → m/s", () => {
    const w = rows.find(
      (r) => r.variable === "wind_ms" && r.ts.toISOString() === "2021-01-09T06:00:00.000Z",
    )!;
    expect(w.value).toBeCloseTo(28 / 3.6, 2);
    const g = rows.find(
      (r) => r.variable === "gust_ms" && r.ts.toISOString() === "2021-01-09T06:00:00.000Z",
    )!;
    expect(g.value).toBeCloseTo(41 / 3.6, 2);
  });

  it("temperatura y humedad instantáneas con ts = hora local", () => {
    const t = rows.find(
      (r) => r.variable === "temp_c" && r.ts.toISOString() === "2021-01-09T06:00:00.000Z",
    )!;
    expect(t.value).toBe(-1);
    const h = rows.find(
      (r) => r.variable === "rh_pct" && r.ts.toISOString() === "2021-01-09T06:00:00.000Z",
    )!;
    expect(h.value).toBe(96);
  });

  it("cambio de hora: ts estrictamente crecientes y sin duplicados por variable", () => {
    const dst = parseHourly(load("horaria-46007-dst.json"), { stationId: "virtual:albal" });
    expect(dst.length).toBeGreaterThan(100);
    for (const variable of ["precip_mm", "temp_c", "precip_prob_pct"]) {
      const ts = dst.filter((r) => r.variable === variable).map((r) => r.ts.getTime());
      const sorted = [...ts].sort((a, b) => a - b);
      expect(new Set(ts).size).toBe(ts.length);
      expect(ts).toEqual(sorted);
    }
    // 25-10-2026 03:00 local (ya CET) = 02:00Z; 01:00 local (CEST) = 23:00Z del día anterior
    const t = dst.filter((r) => r.variable === "temp_c").map((r) => r.ts.toISOString());
    expect(t).toContain("2026-10-24T23:00:00.000Z");
    expect(t).toContain("2026-10-25T02:00:00.000Z");
  });

  it("valor vacío no genera fila", () => {
    const one: AemetHourly = {
      elaborado: "2026-08-25T10:00:00",
      id: "46007",
      prediccion: {
        dia: [
          {
            fecha: "2026-08-25T00:00:00",
            precipitacion: [
              { value: "", periodo: "09" },
              { value: "0.3", periodo: "10" },
            ],
          },
        ],
      },
    };
    const r = parseHourly(one, { stationId: "s" });
    expect(r).toHaveLength(1);
    expect(r[0]!.ts.toISOString()).toBe("2026-08-25T07:00:00.000Z"); // 09:00 CEST inicio de intervalo
  });
});
