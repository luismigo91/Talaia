import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATIONS,
  observationStations,
  parseFint,
  parseObservations,
  stationId,
  type AemetObservation,
} from "../src/observation.js";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/observacion-8337X.json", import.meta.url), "utf8"),
) as AemetObservation[];

describe("parseFint", () => {
  it("interpreta `fint` como UTC aunque venga sin sufijo", () => {
    expect(parseFint("2026-08-25T18:00:00")!.toISOString()).toBe("2026-08-25T18:00:00.000Z");
  });

  it("respeta el sufijo cuando lo trae", () => {
    expect(parseFint("2026-08-25T18:00:00Z")!.toISOString()).toBe("2026-08-25T18:00:00.000Z");
  });

  it("devuelve null si la fecha es inválida", () => {
    expect(parseFint("no-es-fecha")).toBeNull();
  });
});

describe("parseObservations", () => {
  const rows = parseObservations(fixture);

  it("traduce cada variable a la canónica con su unidad", () => {
    const byVar = new Map(rows.map((r) => [`${r.variable}@${r.ts.toISOString()}`, r]));
    const temp = byVar.get("temp_c@2026-08-25T17:00:00.000Z")!;
    expect(temp.value).toBe(28.1);
    expect(temp.unit).toBe("°C");
    expect(temp.stationId).toBe("aemet:8337X");
    expect(temp.source).toBe("aemet:observation");
    expect(byVar.get("pressure_hpa@2026-08-25T17:00:00.000Z")!.value).toBe(995.1);
    expect(byVar.get("gust_ms@2026-08-25T17:00:00.000Z")!.value).toBe(6.2);
  });

  it("la precipitación cubre la hora anterior: ts al inicio del intervalo", () => {
    // prec=1.4 con fint=17:00 es la lluvia de 16:00 a 17:00
    const lluvia = rows.find((r) => r.variable === "precip_mm" && r.value === 1.4)!;
    expect(lluvia.ts.toISOString()).toBe("2026-08-25T16:00:00.000Z");
  });

  it("las variables ausentes se omiten sin romper la fila", () => {
    const ultima = rows.filter((r) => r.ts.toISOString() === "2026-08-25T18:00:00.000Z");
    const variables = ultima.map((r) => r.variable);
    expect(variables).toContain("temp_c");
    expect(variables).not.toContain("pressure_hpa"); // esa fila no trae `pres`
    expect(
      rows.some(
        (r) => r.variable === "precip_mm" && r.ts.getTime() === Date.parse("2026-08-25T17:00:00Z"),
      ),
    ).toBe(false);
  });

  it("un cero es un dato, no un hueco", () => {
    expect(rows.some((r) => r.variable === "precip_mm" && r.value === 0)).toBe(true);
  });

  it("ignora filas sin `idema` o con fecha inválida", () => {
    expect(parseObservations([{ idema: "", fint: "2026-08-25T18:00:00" }])).toHaveLength(0);
    expect(parseObservations([{ idema: "8416", fint: "x" }])).toHaveLength(0);
  });
});

describe("catálogo de estaciones", () => {
  it("por defecto vigila las cercanas a las localizaciones objetivo", () => {
    expect(observationStations({} as NodeJS.ProcessEnv)).toEqual(DEFAULT_STATIONS);
    expect(DEFAULT_STATIONS).toContain("8337X"); // Turís: 771 mm el 29-10-2024
  });

  it("se puede cambiar la lista sin desplegar", () => {
    expect(
      observationStations({ AEMET_OBSERVATION_STATIONS: " 8416 , 8414A " } as NodeJS.ProcessEnv),
    ).toEqual(["8416", "8414A"]);
  });

  it("el id de estación va prefijado por la fuente", () => {
    expect(stationId("8337X")).toBe("aemet:8337X");
  });
});
