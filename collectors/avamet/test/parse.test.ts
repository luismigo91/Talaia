import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseNumber,
  parsePrecipitationTable,
  parseStationPage,
  parseTimestamp,
  stationId,
  toObservations,
} from "../src/parse.js";

const tabla = readFileSync(new URL("../fixtures/mxo-prec-c16.html", import.meta.url), "utf8");
const ficha = readFileSync(new URL("../fixtures/fitxa-c16m244e03.html", import.meta.url), "utf8");

describe("parseNumber", () => {
  it("entiende la coma decimal y el punto de millar", () => {
    expect(parseNumber("0,0")).toBe(0);
    expect(parseNumber("176,2")).toBe(176.2);
    expect(parseNumber("1.013,5")).toBe(1013.5);
  });

  it("vacío o guion es ausencia de dato, no un cero", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("-")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
  });
});

describe("parseTimestamp", () => {
  it("interpreta la hora como local de Madrid (verano, UTC+2)", () => {
    expect(parseTimestamp("26-08-2026 07:51")!.toISOString()).toBe("2026-08-26T05:51:00.000Z");
  });

  it("y en invierno (UTC+1)", () => {
    expect(parseTimestamp("15-01-2026 07:51")!.toISOString()).toBe("2026-01-15T06:51:00.000Z");
  });

  it("devuelve null si no hay hora", () => {
    expect(parseTimestamp("sin hora")).toBeNull();
  });
});

describe("parsePrecipitationTable sobre la fixture real", () => {
  const readings = parsePrecipitationTable(tabla);

  it("saca una lectura por estación con su hora", () => {
    expect(readings.length).toBeGreaterThanOrEqual(5);
    expect(readings.every((r) => /^c\d+m\d+e\d+$/.test(r.id))).toBe(true);
    expect(readings.every((r) => r.ts instanceof Date && !Number.isNaN(r.ts.getTime()))).toBe(true);
  });

  it("incluye las estaciones que cubren el hueco del Horteta", () => {
    const ids = readings.map((r) => r.id);
    expect(ids).toContain("c16m244e03"); // Torrent - Av. al Vedat
    expect(ids).toContain("c16m186e02"); // Paiporta
  });

  it("lee el nombre de la estación", () => {
    const torrent = readings.find((r) => r.id === "c16m244e03")!;
    expect(torrent.name).toContain("Torrent");
  });

  it("guarda las ventanas que dicen algo distinto", () => {
    const torrent = readings.find((r) => r.id === "c16m244e03")!;
    expect(Object.keys(torrent.values).sort()).toEqual([
      "precip_12h_mm",
      "precip_1h_mm",
      "precip_24h_mm",
      "precip_day_mm",
    ]);
  });

  it("un HTML sin la tabla no revienta: devuelve vacío", () => {
    expect(parsePrecipitationTable("<html><body>nada</body></html>")).toEqual([]);
  });
});

describe("toObservations", () => {
  it("convierte al esquema común con la fuente y el id prefijados", () => {
    const rows = toObservations(parsePrecipitationTable(tabla));
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.source === "avamet")).toBe(true);
    expect(rows.every((r) => r.stationId.startsWith("avamet:"))).toBe(true);
    expect(rows.every((r) => r.unit === "mm")).toBe(true);
    expect(stationId("c16m186e02")).toBe("avamet:c16m186e02");
  });
});

describe("parseStationPage", () => {
  it("saca las coordenadas de la ficha técnica", () => {
    const info = parseStationPage(ficha)!;
    expect(info.lat).toBeCloseTo(39.4286, 3);
    expect(info.lon).toBeCloseTo(-0.4778, 3);
    expect(info.name).toContain("Torrent");
  });

  it("una ficha sin coordenadas devuelve null", () => {
    expect(parseStationPage("<html>sin datos</html>")).toBeNull();
  });
});
