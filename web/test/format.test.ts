import { describe, expect, it } from "vitest";
import { ago, byRisk, dateTimeMadrid, formatValue, rank, timeMadrid } from "../src/lib/format.js";
import type { StationRisk } from "../src/lib/api.js";

const station = (name: string, level: StationRisk["level"], primary = false): StationRisk => ({
  station: { id: `virtual:${name}`, name, lat: 0, lon: 0, primary },
  level,
  components: [],
  alerts: [],
  warnings: [],
  stale: false,
  computed_at: "2026-08-25T18:00:00Z",
});

describe("byRisk", () => {
  it("lo que está peor se ve primero", () => {
    const out = [station("Albal", "verde", true), station("Benaguasil", "naranja")].sort(byRisk);
    expect(out.map((s) => s.station.name)).toEqual(["Benaguasil", "Albal"]);
  });

  it("a igualdad de nivel, primero la localización principal", () => {
    const out = [station("Benetússer", "verde"), station("Albal", "verde", true)].sort(byRisk);
    expect(out[0]!.station.name).toBe("Albal");
  });

  it("a igualdad, orden alfabético español", () => {
    const out = [station("Sueca", "verde"), station("Benetússer", "verde")].sort(byRisk);
    expect(out.map((s) => s.station.name)).toEqual(["Benetússer", "Sueca"]);
  });

  it("el orden de gravedad es verde < amarillo < naranja < rojo", () => {
    expect(rank("verde")).toBeLessThan(rank("amarillo"));
    expect(rank("naranja")).toBeLessThan(rank("rojo"));
  });
});

describe("horas en Europe/Madrid", () => {
  it("convierte desde UTC en verano (UTC+2)", () => {
    expect(timeMadrid("2026-08-25T18:00:00Z")).toBe("20:00");
  });

  it("convierte desde UTC en invierno (UTC+1)", () => {
    expect(timeMadrid("2026-01-15T23:30:00Z")).toBe("00:30");
  });

  it("la fecha completa va en local y con dos dígitos, para que la tabla quede alineada", () => {
    expect(dateTimeMadrid("2026-01-15T23:30:00Z")).toBe("16/01 00:30");
    expect(dateTimeMadrid("2026-08-05T06:05:00Z")).toBe("05/08 08:05");
  });
});

describe("ago", () => {
  it("describe la frescura en lenguaje natural", () => {
    expect(ago(null)).toBe("sin datos");
    expect(ago(30)).toBe("hace un momento");
    expect(ago(600)).toBe("hace 10 min");
    expect(ago(7200)).toBe("hace 2 h");
    expect(ago(60 * 60 * 72)).toBe("hace 3 días");
  });
});

describe("formatValue", () => {
  it("ajusta decimales al orden de magnitud y usa coma decimal", () => {
    expect(formatValue(2282.9, "m³/s")).toBe("2283 m³/s");
    expect(formatValue(21.34, "m³/s")).toBe("21,3 m³/s");
    expect(formatValue(0.2, "mm")).toBe("0,20 mm");
  });

  it("sin dato lo dice, no muestra cero", () => {
    expect(formatValue(null, "mm")).toBe("sin datos");
  });
});
