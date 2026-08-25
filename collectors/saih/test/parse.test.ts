import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SensorSpec } from "@talaia/shared";
import { derivePrecipHourly, toObservations } from "../src/parse.js";
import type { SaihSample } from "../src/client.js";

const caudal = JSON.parse(
  readFileSync(new URL("../fixtures/valor-13873-caudal.json", import.meta.url), "utf8"),
) as SaihSample[];
const lluvia = JSON.parse(
  readFileSync(new URL("../fixtures/valor-13871-intensidad.json", import.meta.url), "utf8"),
) as SaihSample[];

const sensor = (over: Partial<SensorSpec> = {}): SensorSpec => ({
  id: "saih:13873",
  source: "saih",
  stationId: "saih:227",
  stationName: "MC RAMBLA POYO N-III",
  externalId: "13873",
  variable: "river_flow_m3s",
  unit: "m³/s",
  thresholdLow: 30,
  thresholdMid: 70,
  thresholdHigh: 150,
  meta: {},
  ...over,
});

const rain = sensor({
  id: "saih:13871",
  externalId: "13871",
  variable: "precip_rate_mmh",
  unit: "mm/h",
  thresholdLow: null,
  thresholdMid: null,
  thresholdHigh: null,
});

describe("toObservations", () => {
  it("normaliza la fixture real del Poyo con ts en UTC y estado en quality", () => {
    const rows = toObservations(caudal, sensor());
    expect(rows.length).toBe(caudal.length);
    expect(rows[0]!.source).toBe("saih");
    expect(rows[0]!.stationId).toBe("saih:227");
    expect(rows[0]!.variable).toBe("river_flow_m3s");
    expect(rows[0]!.unit).toBe("m³/s");
    expect(rows[0]!.ts.toISOString()).toBe("2026-08-25T08:00:00.000Z");
    expect(rows[0]!.quality).toBe(128);
    // registro cincominutal
    expect(rows[1]!.ts.getTime() - rows[0]!.ts.getTime()).toBe(300_000);
  });

  it("omite valores nulos o no numéricos y fechas inválidas", () => {
    const rows = toObservations(
      [
        { valor: null, fecha: "2026-08-25T08:00:00.000Z", estado: 0 },
        { valor: 1.5, fecha: "2026-08-25T08:05:00.000Z", estado: 0 },
        { valor: 2, fecha: "no-es-fecha" },
      ],
      sensor(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(1.5);
  });

  it("deja quality en null cuando el portal no manda estado", () => {
    const rows = toObservations([{ valor: 1, fecha: "2026-08-25T08:00:00.000Z" }], sensor());
    expect(rows[0]!.quality).toBeNull();
  });
});

describe("derivePrecipHourly", () => {
  it("agrega la intensidad real (mm/h) a milímetros por hora completa", () => {
    const rows = toObservations(lluvia, rain);
    const derived = derivePrecipHourly(rows, rain, new Date("2026-03-05T15:00:00Z"));
    const h12 = derived.find((r) => r.ts.toISOString() === "2026-03-05T12:00:00.000Z")!;
    expect(h12.variable).toBe("precip_mm");
    expect(h12.unit).toBe("mm");
    expect(h12.stationId).toBe("saih:227");
    // Σ(v · 5/60) de las 12 muestras de esa hora
    const esperado =
      rows
        .filter(
          (r) =>
            r.ts >= new Date("2026-03-05T12:00:00Z") && r.ts < new Date("2026-03-05T13:00:00Z"),
        )
        .reduce((a, r) => a + (r.value as number), 0) *
      (5 / 60);
    expect(h12.value).toBeCloseTo(esperado, 3);
    // valores cuantizados en múltiplos de 0,2 mm (cazoleta)
    expect(h12.value!).toBeGreaterThan(0);
  });

  it("descarta la hora en curso", () => {
    const rows = toObservations(lluvia, rain);
    const derived = derivePrecipHourly(rows, rain, new Date("2026-03-05T13:30:00Z"));
    expect(derived.some((r) => r.ts.toISOString() === "2026-03-05T13:00:00.000Z")).toBe(false);
    expect(derived.some((r) => r.ts.toISOString() === "2026-03-05T12:00:00.000Z")).toBe(true);
    // la fixture arranca a las 11:10 → exactamente 10 muestras, el mínimo aceptado
    expect(derived.some((r) => r.ts.toISOString() === "2026-03-05T11:00:00.000Z")).toBe(true);
  });

  it("descarta una hora con menos de 10 muestras", () => {
    const samples: SaihSample[] = Array.from({ length: 9 }, (_, i) => ({
      valor: 2.4,
      fecha: new Date(Date.UTC(2026, 2, 5, 10, i * 5)).toISOString(),
      estado: 0,
    }));
    const derived = derivePrecipHourly(
      toObservations(samples, rain),
      rain,
      new Date("2026-03-05T12:00:00Z"),
    );
    expect(derived).toHaveLength(0);
  });

  it("12 muestras de 2,4 mm/h equivalen a 2,4 mm en la hora", () => {
    const samples: SaihSample[] = Array.from({ length: 12 }, (_, i) => ({
      valor: 2.4,
      fecha: new Date(Date.UTC(2026, 2, 5, 10, i * 5)).toISOString(),
      estado: 0,
    }));
    const derived = derivePrecipHourly(
      toObservations(samples, rain),
      rain,
      new Date("2026-03-05T12:00:00Z"),
    );
    expect(derived).toHaveLength(1);
    expect(derived[0]!.value).toBeCloseTo(2.4, 6);
    expect(derived[0]!.ts.toISOString()).toBe("2026-03-05T10:00:00.000Z");
  });

  it("propaga el peor estado de la hora a quality", () => {
    const samples: SaihSample[] = Array.from({ length: 12 }, (_, i) => ({
      valor: 2.4,
      fecha: new Date(Date.UTC(2026, 2, 5, 10, i * 5)).toISOString(),
      estado: i === 3 ? 128 : 0,
    }));
    const derived = derivePrecipHourly(
      toObservations(samples, rain),
      rain,
      new Date("2026-03-05T12:00:00Z"),
    );
    expect(derived[0]!.quality).toBe(128);
  });
});
