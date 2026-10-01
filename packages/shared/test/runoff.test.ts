import { describe, expect, it } from "vitest";
import { plausibleSeries } from "../src/plausibility.js";
import {
  accumulate,
  basinRainHourly,
  fitIsUsable,
  fitRunoff,
  projectFlow,
  runoffVerdict,
  type HourlyRain,
} from "../src/runoff.js";

const T0 = Date.UTC(2026, 0, 1);
const hour = (i: number) => new Date(T0 + i * 3_600_000);

/** Cuenca sintética: lluvia media de 3 h → caudal 0,5·P^1,8 dos horas después. */
function synthetic(opts: { lagHours: number; a: number; b: number; noise?: number }) {
  const rainA: HourlyRain[] = [];
  const rainB: HourlyRain[] = [];
  const hours = 24 * 20;
  // Tres episodios de lluvia de distinta intensidad, el resto seco.
  const storm = (start: number, mmPerHour: number, len: number) => {
    for (let i = 0; i < len; i++) {
      rainA.push({ ts: hour(start + i), mm: mmPerHour * 1.2 });
      rainB.push({ ts: hour(start + i), mm: mmPerHour * 0.8 });
    }
  };
  for (let i = 0; i < hours; i++) {
    if (!rainA.some((p) => p.ts.getTime() === hour(i).getTime())) {
      rainA.push({ ts: hour(i), mm: 0 });
      rainB.push({ ts: hour(i), mm: 0 });
    }
  }
  storm(24, 8, 4);
  storm(120, 20, 5);
  storm(300, 35, 3);
  const basin = accumulate(basinRainHourly([rainA, rainB]), 3);
  const flow = [];
  for (const p of basin) {
    const q = opts.a * Math.pow(p.mm, opts.b) * (1 + (opts.noise ?? 0) * Math.sin(p.ts.getTime()));
    for (let m = 0; m < 60; m += 5) {
      flow.push({
        ts: new Date(p.ts.getTime() + opts.lagHours * 3_600_000 + m * 60_000),
        value: q,
      });
    }
  }
  return { flow, rainByGauge: [rainA, rainB] };
}

describe("basinRainHourly / accumulate", () => {
  it("promedia entre pluviómetros con dato y acumula la ventana", () => {
    const a: HourlyRain[] = [
      { ts: hour(0), mm: 10 },
      { ts: hour(1), mm: 20 },
    ];
    const b: HourlyRain[] = [{ ts: hour(1), mm: 10 }];
    const basin = basinRainHourly([a, b]);
    expect(basin).toEqual([
      { ts: hour(0), mm: 10 },
      { ts: hour(1), mm: 15 },
    ]);
    expect(accumulate(basin, 2).map((p) => p.mm)).toEqual([10, 25]);
  });
});

describe("fitRunoff", () => {
  it("recupera el retardo y los coeficientes de una cuenca sintética", () => {
    const { flow, rainByGauge } = synthetic({ lagHours: 2, a: 0.5, b: 1.8 });
    const fit = fitRunoff(flow, rainByGauge, { windowHours: 3, maxJump: 1e9 });
    expect(fit.lagMinutes).toBe(120);
    expect(fit.coefA).toBeCloseTo(0.5, 2);
    expect(fit.coefB).toBeCloseTo(1.8, 2);
    expect(fit.r2).toBeGreaterThan(0.99);
    expect(fit.episodes).toHaveLength(3);
    expect(fit.episodes[0]!.rainMm).toBeGreaterThan(fit.episodes[2]!.rainMm);
    expect(fitIsUsable(fit, { minPeakFlow: 30 })).toBe(true);
    expect(runoffVerdict(fit, { minPeakFlow: 30 })).toMatch(/^ajuste razonable/);
    expect(fit.peakFlow).toBeGreaterThan(30);
    // Proyección con el modelo ajustado: 40 mm → 0,5·40^1,8 ≈ 386 m³/s
    expect(projectFlow({ coefA: fit.coefA!, coefB: fit.coefB! }, 40)).toBeCloseTo(386, -1);
  });

  it("una cuenca que no corre nunca: diagnóstico claro y sin coeficientes", () => {
    const { rainByGauge } = synthetic({ lagHours: 2, a: 0.5, b: 1.8 });
    const dry = Array.from({ length: 24 * 20 * 12 }, (_, i) => ({
      ts: new Date(T0 + i * 300_000),
      value: 0.1,
    }));
    const fit = fitRunoff(dry, rainByGauge, { windowHours: 3 });
    expect(fit.rainyHours).toBeGreaterThan(0);
    expect(fit.respondingHours).toBe(0);
    expect(fit.coefA).toBeNull();
    expect(fitIsUsable(fit)).toBe(false);
    expect(runoffVerdict(fit)).toMatch(/no respondió en ninguna/);
  });

  it("los artefactos del SAIH no cuentan como respuesta", () => {
    const { rainByGauge } = synthetic({ lagHours: 2, a: 0.5, b: 1.8 });
    // Seco, con un escalón imposible de media hora en mitad de un episodio de lluvia.
    const flow = Array.from({ length: 24 * 20 * 12 }, (_, i) => ({
      ts: new Date(T0 + i * 300_000),
      value: i >= 122 * 12 && i < 122 * 12 + 6 ? 855 : 0,
    }));
    const fit = fitRunoff(flow, rainByGauge, { windowHours: 3 });
    expect(fit.discardedFlowSamples).toBe(6);
    expect(fit.respondingHours).toBe(0);
  });

  it("pocas horas con respuesta: insuficiente", () => {
    const { flow, rainByGauge } = synthetic({ lagHours: 1, a: 0.5, b: 1.8 });
    // Solo el primer episodio (4 h)
    const cut = hour(30).getTime();
    const fit = fitRunoff(
      flow.filter((s) => s.ts.getTime() < cut),
      rainByGauge.map((g) => g.filter((p) => p.ts.getTime() < cut)),
      { windowHours: 3, maxJump: 1e9 },
    );
    expect(fit.n).toBeLessThan(5);
    expect(fitIsUsable(fit)).toBe(false);
    expect(runoffVerdict(fit)).toMatch(/insuficiente/);
  });
});

describe("fitIsUsable: rango del ajuste", () => {
  it("un buen r² sobre el goteo no sirve para hablar de los umbrales", () => {
    // Cuenca que responde siempre, pero con caudales entre 0,5 y 2 m³/s (el Poyo real).
    const { flow, rainByGauge } = synthetic({ lagHours: 2, a: 0.24, b: 0.5 });
    const fit = fitRunoff(flow, rainByGauge, { windowHours: 3, maxJump: 1e9 });
    expect(fit.r2).toBeGreaterThan(0.9);
    expect(fit.peakFlow).toBeLessThan(5);
    expect(fitIsUsable(fit, { minPeakFlow: 30 })).toBe(false);
    expect(runoffVerdict(fit, { minPeakFlow: 30 })).toMatch(/lejos del primer umbral \(30\)/);
    // Sin umbral de referencia sigue valiendo (otro uso, otra decisión).
    expect(fitIsUsable(fit)).toBe(true);
  });
});

describe("plausibleSeries", () => {
  it("elimina el escalón del 17-09-2025 y conserva una crecida real", () => {
    const at = (m: number) => new Date(T0 + m * 60_000);
    const artefacto = [0.1, 855.5, 850, 845, 848, 839.5, 0.0, 0.0].map((v, i) => ({
      ts: at(i * 5),
      value: v,
    }));
    expect(plausibleSeries(artefacto, { maxJump: 250 }).map((s) => s.value)).toEqual([
      0.1, 0.0, 0.0,
    ]);
    const crecida = Array.from({ length: 20 }, (_, i) => ({ ts: at(i * 5), value: i * 60 }));
    expect(plausibleSeries(crecida, { maxJump: 250 })).toHaveLength(20);
  });
});
