import { describe, expect, it } from "vitest";
import { forecastTrend, trendPhrase, type ForecastRunRow } from "../src/risk-eval.js";

const now = new Date("2026-09-11T12:00:00Z");
const prev = (source: string, mm24h: number, hoursAgo = 6): ForecastRunRow => ({
  source,
  run: "previous",
  forecast_ts: new Date(now.getTime() - hoursAgo * 3_600_000),
  mm12h: mm24h / 2,
  mm24h,
});
const pick = (r: ForecastRunRow) => r.mm24h;

describe("forecastTrend", () => {
  it("sube cuando la mediana crece de forma apreciable", () => {
    const t = forecastTrend(30, [prev("a", 10), prev("b", 12), prev("c", 8)], pick)!;
    expect(t.previous).toBe(10);
    expect(t.delta).toBe(20);
    expect(t.direction).toBe("sube");
    expect(t.sources).toBe(3);
  });

  it("baja cuando las corridas anteriores daban más", () => {
    const t = forecastTrend(5, [prev("a", 40), prev("b", 35)], pick)!;
    expect(t.direction).toBe("baja");
    expect(t.delta).toBe(-32.5);
  });

  it("bailar entre 0,4 y 0,6 mm no es tendencia: estable", () => {
    expect(forecastTrend(0.6, [prev("a", 0.4)], pick)!.direction).toBe("estable");
    // 2 mm de 1 no llegan al 20 % de... sí llegan; pero el mínimo absoluto son 2 mm.
    expect(forecastTrend(1.5, [prev("a", 0)], pick)!.direction).toBe("estable");
  });

  it("un cambio pequeño en un total grande también es estable (menos del 20 %)", () => {
    expect(forecastTrend(105, [prev("a", 100)], pick)!.direction).toBe("estable");
    expect(forecastTrend(125, [prev("a", 100)], pick)!.direction).toBe("sube");
  });

  it("sin corridas anteriores no hay tendencia", () => {
    expect(forecastTrend(30, [], pick)).toBeNull();
    expect(forecastTrend(30, [{ ...prev("a", 0), mm24h: null }], pick)).toBeNull();
  });

  it("recuerda la emisión más reciente de las anteriores", () => {
    const t = forecastTrend(30, [prev("a", 10, 9), prev("b", 10, 6)], pick)!;
    expect(t.previous_forecast_ts).toBe("2026-09-11T06:00:00.000Z");
  });
});

describe("trendPhrase", () => {
  it("dice cuánto daban las corridas anteriores y hace cuánto", () => {
    const t = forecastTrend(30, [prev("a", 10), prev("b", 12), prev("c", 8)], pick)!;
    expect(trendPhrase(t, now)).toBe("al alza: las corridas de hace 6 h daban 10 mm");
  });

  it("estable y a la baja", () => {
    expect(trendPhrase(forecastTrend(10, [prev("a", 10)], pick)!, now)).toMatch(/^estable:/);
    expect(trendPhrase(forecastTrend(2, [prev("a", 30)], pick)!, now)).toMatch(/^a la baja:/);
  });
});
