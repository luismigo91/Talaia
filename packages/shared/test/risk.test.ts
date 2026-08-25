import { describe, expect, it } from "vitest";
import { levelFor, median, worstLevel, type ThresholdSpec } from "../src/risk.js";
import { thresholdLevel } from "../src/sensors.js";

const t = (y: number | null, o: number | null, r: number | null): ThresholdSpec => ({
  signal: "test",
  stationId: null,
  yellow: y,
  orange: o,
  red: r,
  meta: {},
});

describe("worstLevel", () => {
  it("se queda con el peor nivel", () => {
    expect(worstLevel(["verde", "naranja", "amarillo"])).toBe("naranja");
    expect(worstLevel(["rojo", "verde"])).toBe("rojo");
  });

  it("ignora nulos y devuelve verde si no hay nada", () => {
    expect(worstLevel([null, undefined])).toBe("verde");
    expect(worstLevel([])).toBe("verde");
    expect(worstLevel([null, "amarillo"])).toBe("amarillo");
  });

  it("nunca promedia: un rojo aislado manda sobre tres verdes", () => {
    expect(worstLevel(["verde", "verde", "verde", "rojo"])).toBe("rojo");
  });
});

describe("levelFor", () => {
  it("aplica los umbrales oficiales de lluvia en 1 h (20/40/90)", () => {
    const u = t(20, 40, 90);
    expect(levelFor(0, u)).toBe("verde");
    expect(levelFor(19.9, u)).toBe("verde");
    expect(levelFor(20, u)).toBe("amarillo");
    expect(levelFor(45, u)).toBe("naranja");
    expect(levelFor(90, u)).toBe("rojo");
    expect(levelFor(184.6, u)).toBe("rojo"); // récord de Turís el 29-10-2024
  });

  it("admite umbrales parciales (solo amarillo)", () => {
    expect(levelFor(25, t(20, null, null))).toBe("amarillo");
    expect(levelFor(500, t(20, null, null))).toBe("amarillo");
  });

  it("devuelve null sin valor, sin regla o con la regla vacía", () => {
    expect(levelFor(null, t(20, 40, 90))).toBeNull();
    expect(levelFor(10, undefined)).toBeNull();
    expect(levelFor(10, t(null, null, null))).toBeNull();
  });
});

describe("thresholdLevel (umbrales de la CHJ)", () => {
  it("clasifica el caudal del Poyo con 30/70/150", () => {
    const poyo = { thresholdLow: 30, thresholdMid: 70, thresholdHigh: 150 };
    expect(thresholdLevel(0, poyo)).toBe("verde");
    expect(thresholdLevel(30, poyo)).toBe("amarillo");
    expect(thresholdLevel(80, poyo)).toBe("naranja");
    expect(thresholdLevel(2282.9, poyo)).toBe("rojo"); // último dato de la DANA
  });
});

describe("median", () => {
  it("impar, par y vacío", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("un modelo desatado no mueve la mediana", () => {
    expect(median([10, 10, 10, 10, 10, 150])).toBe(10);
  });
});
