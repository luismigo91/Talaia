import { describe, expect, it } from "vitest";
import { lastPlausible, type Sample } from "../src/plausibility.js";

const serie = (values: number[], startMin = 0): Sample[] =>
  values.map((value, i) => ({
    value,
    ts: new Date(Date.UTC(2026, 7, 26, 5, startMin + i * 5)),
  }));

const MAX_JUMP = 250;

describe("lastPlausible", () => {
  it("descarta el artefacto real del Poyo del 17-09-2025", () => {
    // 0,1 → 855 en cinco minutos, sostenido 25 y de vuelta a cero
    const r = lastPlausible(serie([0, 0, 0.1, 0.1, 855.5, 849.9, 843.3, 839.5, 0, 0]), {
      maxJump: MAX_JUMP,
    });
    expect(r.sample!.value).toBe(0);
    expect(r.discarded).toBe(4); // las cuatro muestras del pico, descartadas
  });

  it("en mitad del artefacto tampoco se lo cree", () => {
    const r = lastPlausible(serie([0, 0.1, 855.5, 849.9, 843.3]), { maxJump: MAX_JUMP });
    expect(r.sample!.value).toBe(0.1);
    expect(r.discarded).toBe(3);
  });

  it("no estorba a una crecida real: la DANA subía ~65 m³/s cada cinco minutos", () => {
    const rampa = Array.from({ length: 34 }, (_, i) => Math.round(i * 65));
    const r = lastPlausible(serie(rampa), { maxJump: MAX_JUMP });
    expect(r.sample!.value).toBe(rampa.at(-1));
    expect(r.discarded).toBe(0);
  });

  it("un escalón brusco pero sostenido una hora se acepta: puede ser una suelta de embalse", () => {
    const r = lastPlausible(serie([2, 2, 2, ...Array.from({ length: 14 }, () => 600)]), {
      maxJump: MAX_JUMP,
      sustainedSamples: 12,
    });
    expect(r.sample!.value).toBe(600);
  });

  it("una bajada imposible también es sospechosa", () => {
    const r = lastPlausible(serie([800, 800, 800, 0, 800, 800]), { maxJump: MAX_JUMP });
    expect(r.sample!.value).toBe(800);
  });

  it("con una sola muestra la toma tal cual: no hay con qué compararla", () => {
    expect(lastPlausible(serie([500]), { maxJump: MAX_JUMP }).sample!.value).toBe(500);
  });

  it("sin muestras no inventa nada", () => {
    expect(lastPlausible([], { maxJump: MAX_JUMP }).sample).toBeUndefined();
  });

  it("ordena por tiempo aunque lleguen desordenadas", () => {
    const s = serie([1, 2, 3]).reverse();
    expect(lastPlausible(s, { maxJump: MAX_JUMP }).sample!.value).toBe(3);
  });
});
