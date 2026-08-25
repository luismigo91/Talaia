import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseForecast, parseUtc } from "../src/parse.js";
import type { OpenMeteoResponse } from "../src/client.js";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/forecast-2loc.json", import.meta.url), "utf8"),
) as OpenMeteoResponse[];

const T = new Date("2026-08-25T06:00:00Z");
const allModels = () =>
  new Map(
    [
      "meteofrance_arome_france_hd",
      "icon_eu",
      "ecmwf_ifs",
      "gfs_seamless",
      "arpege_europe",
      "ukmo_global_deterministic_10km",
    ].map((m) => [m, T]),
  );

describe("parseForecast", () => {
  it("genera filas por modelo y variable con sufijo, omitiendo null", () => {
    const rows = parseForecast(fixture[0]!, {
      stationId: "virtual:albal",
      forecastTs: allModels(),
    });
    const sources = new Set(rows.map((r) => r.source));
    expect(sources.has("open-meteo:icon_eu")).toBe(true);
    expect(sources.has("open-meteo:meteofrance_arome_france_hd")).toBe(true);
    // AROME HD no da probabilidad de precipitación
    expect(
      rows.some(
        (r) =>
          r.source === "open-meteo:meteofrance_arome_france_hd" && r.variable === "precip_prob_pct",
      ),
    ).toBe(false);
    expect(
      rows.some((r) => r.source === "open-meteo:icon_eu" && r.variable === "precip_prob_pct"),
    ).toBe(true);
    expect(rows.every((r) => typeof r.value === "number")).toBe(true);
    expect(rows.every((r) => r.stationId === "virtual:albal")).toBe(true);
  });

  it("convención de intervalo: precipitación con ts = time − 1 h; instantáneas con ts = time", () => {
    const res: OpenMeteoResponse = {
      latitude: 39.4,
      longitude: -0.4,
      hourly: {
        time: ["2026-08-25T03:00", "2026-08-25T04:00"],
        precipitation_icon_eu: [2.5, 0],
        temperature_2m_icon_eu: [20.1, 19.8],
      },
    };
    const rows = parseForecast(res, { stationId: "s", forecastTs: new Map([["icon_eu", T]]) });
    const p = rows.find((r) => r.variable === "precip_mm" && r.value === 2.5)!;
    expect(p.ts.toISOString()).toBe("2026-08-25T02:00:00.000Z");
    const t = rows.find((r) => r.variable === "temp_c" && r.value === 20.1)!;
    expect(t.ts.toISOString()).toBe("2026-08-25T03:00:00.000Z");
    expect(p.forecastTs).toBe(T);
  });

  it("modelo ausente en la respuesta no falla y solo cuenta los presentes", () => {
    const res: OpenMeteoResponse = {
      latitude: 0,
      longitude: 0,
      hourly: { time: ["2026-08-25T03:00"], precipitation_icon_eu: [1] },
    };
    const rows = parseForecast(res, { stationId: "s", forecastTs: allModels() });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("open-meteo:icon_eu");
  });

  it("solo escribe los modelos con forecastTs (idempotencia por corrida)", () => {
    const rows = parseForecast(fixture[1]!, {
      stationId: "virtual:benetusser",
      forecastTs: new Map([["ecmwf_ifs", T]]),
    });
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(["open-meteo:ecmwf_ifs"]));
  });

  it("parseUtc interpreta el formato de Open-Meteo como UTC", () => {
    expect(parseUtc("2026-08-25T03:00").toISOString()).toBe("2026-08-25T03:00:00.000Z");
  });
});
