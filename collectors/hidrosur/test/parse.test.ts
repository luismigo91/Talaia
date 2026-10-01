import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  numEs,
  parseEmbalsesTable,
  parseGrafica,
  parseRiosTable,
  parseUpdatedAt,
  SOURCE,
} from "../src/parse.js";
import { stationNumber } from "../src/run.js";

const fix = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

describe("tablas de última hora (capturas 01-10-2026 18:00)", () => {
  it("la marca temporal es hora local a UTC", () => {
    expect(parseUpdatedAt(fix("resumen-rios.html"))?.toISOString()).toBe(
      "2026-10-01T16:00:00.000Z",
    );
  });

  it("ríos: nivel, caudal y enlace a gráfica por estación", () => {
    const rows = parseRiosTable(fix("resumen-rios.html"));
    expect(rows.length).toBeGreaterThan(30);
    expect(rows.find((r) => r.number === "38")).toMatchObject({
      name: "RÍO GUADALHORCE (CARTAMA) (MA)",
      levelM: 0.01,
      flowM3s: 0.01,
      grafica: "038R03",
    });
  });

  it("embalses: porcentaje y hm³", () => {
    const rows = parseEmbalsesTable(fix("resumen-embalses.html"));
    expect(rows.find((r) => r.number === "20")).toMatchObject({
      name: "EMBALSE DEL LIMONERO",
      pct: 100,
      hm3: 14,
    });
  });

  it("numEs entiende coma decimal y asteriscos", () => {
    expect(numEs("14,00 *")).toBe(14);
    expect(numEs("0,27")).toBe(0.27);
    expect(numEs("")).toBeNull();
  });
});

describe("gráficas por estación (48 h horarias)", () => {
  it("río con datos: nivel horario con su hora", () => {
    const g = parseGrafica(fix("grafica-038R03.html"))!;
    expect(g.sensorTipo).toBe("R");
    expect(g.points).toHaveLength(49);
    expect(g.points[0]!.ts.toISOString()).toBe("2026-09-29T16:00:00.000Z");
    expect(g.points.at(-1)!.ts.toISOString()).toBe("2026-10-01T16:00:00.000Z");
    expect(g.points[0]!.value).toBeCloseTo(0.07, 5);
  });

  it("pluviómetro con lluvia: serie horaria en mm", () => {
    const g = parseGrafica(fix("grafica-086P01.html"))!;
    expect(g.sensorTipo).toBe("P");
    expect(g.points.length).toBeGreaterThan(40);
    expect(g.points.reduce((a, p) => a + p.value, 0)).toBeCloseTo(1.9, 5);
  });

  it("pluviómetro sin lluvia en 48 h: serie vacía, no error", () => {
    const g = parseGrafica(fix("grafica-022P01.html"))!;
    expect(g.sensorTipo).toBe("P");
    expect(g.points).toEqual([]);
  });
});

describe("identificadores", () => {
  it("la fuente es hidrosur y el número sale del id", () => {
    expect(SOURCE).toBe("hidrosur");
    expect(stationNumber("hidrosur:38:river_flow_m3s")).toBe("38");
    expect(stationNumber("hidrosur:22:precip_mm")).toBe("22");
    expect(stationNumber("saih:227")).toBeNull();
  });
});
