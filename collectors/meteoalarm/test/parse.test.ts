import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFeed, parseAwareness, pickInfo, EVENT_CODES, LEVELS } from "../src/parse.js";
import { EMMA_TO_AEMET_ZONE, zoneFromIdentifier } from "../src/zones.js";
import type { MeteoalarmFeed } from "../src/client.js";

const feed = JSON.parse(
  readFileSync(new URL("../fixtures/feeds-spain.json", import.meta.url), "utf8"),
) as MeteoalarmFeed;

const ZONES = new Set(["774602", "774604"]);

describe("mapa de zonas", () => {
  it("traduce las zonas de las localizaciones objetivo", () => {
    expect(EMMA_TO_AEMET_ZONE.ES247).toBe("774602"); // Litoral norte de Valencia
    expect(EMMA_TO_AEMET_ZONE.ES249).toBe("774604"); // Litoral sur de Valencia
  });

  it("las zonas costeras apuntan a la misma zona terrestre", () => {
    expect(EMMA_TO_AEMET_ZONE.ES864).toBe("774602");
    expect(EMMA_TO_AEMET_ZONE.ES863).toBe("774604");
  });

  it("extrae la zona del identifier como respaldo", () => {
    expect(zoneFromIdentifier("2.49.0.0.724.0.ES.260822091208.774602PRP1230889928")).toBe("774602");
    expect(zoneFromIdentifier("2.49.0.0.724.0.ES.260820215208.61VV61NIN")).toBeUndefined();
  });
});

describe("parseAwareness", () => {
  it("descompone los parámetros de Meteoalarm", () => {
    expect(parseAwareness("2; yellow; Moderate")).toEqual({ code: "2", label: "yellow" });
    expect(parseAwareness("10; Rain")).toEqual({ code: "10", label: "rain" });
    expect(parseAwareness(undefined)).toEqual({ code: "", label: "" });
  });
});

describe("parseFeed sobre la fixture real", () => {
  const rows = parseFeed(feed, ZONES);

  it("solo escribe avisos de nuestras zonas", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => ZONES.has(r.areaCode))).toBe(true);
    // el aviso de tormentas de Huesca (ES100) queda fuera
    expect(rows.some((r) => (r.event ?? "").includes("tormentas"))).toBe(false);
  });

  it("descarta los avisos verdes", () => {
    expect(rows.every((r) => r.level !== "verde")).toBe(true);
    expect(rows.some((r) => (r.event ?? "").includes("nieblas"))).toBe(false);
  });

  it("traduce el aviso de lluvias al vocabulario de AEMET", () => {
    const lluvia = rows.find((r) => r.eventCode === "PR")!;
    expect(lluvia.level).toBe("amarillo");
    expect(lluvia.areaCode).toBe("774602");
    expect(lluvia.source).toBe("meteoalarm");
    expect(lluvia.id).toContain("meteoalarm:");
    expect(lluvia.id).toContain("#774602");
    expect(lluvia.event).toContain("lluvias"); // bloque en español, no "Rain warning"
    expect(lluvia.onset.getTime()).toBeLessThan(lluvia.expires.getTime());
    expect(lluvia.geom).toBeUndefined(); // el feed no publica polígonos
  });

  it("marca los costeros con su propio código, que no eleva el semáforo", () => {
    const costero = rows.find((r) => r.eventCode === "CO");
    expect(costero?.level).toBe("amarillo");
  });

  it("guarda la procedencia en raw", () => {
    const r = rows[0]!;
    expect(r.raw).toMatchObject({ identifier: expect.any(String) });
    expect((r.raw as { awareness_level: string }).awareness_level).toContain(";");
  });

  it("no repite la misma zona dos veces en un aviso", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("con otro conjunto de zonas no devuelve nada nuestro", () => {
    expect(parseFeed(feed, new Set(["771202"]))).toHaveLength(0);
  });
});

describe("tablas de traducción", () => {
  it("cubre los tipos que importan para inundación", () => {
    expect(EVENT_CODES["10"]).toBe("PR");
    expect(EVENT_CODES["3"]).toBe("TO");
    expect(EVENT_CODES["11"]).toBe("IN");
    expect(EVENT_CODES["12"]).toBe("IN");
  });

  it("traduce los cuatro niveles", () => {
    expect(LEVELS.yellow).toBe("amarillo");
    expect(LEVELS.orange).toBe("naranja");
    expect(LEVELS.red).toBe("rojo");
    expect(LEVELS.green).toBe("verde");
  });

  it("un tipo desconocido deja el código nulo sin romper el parseo", () => {
    const fake: MeteoalarmFeed = {
      warnings: [
        {
          alert: {
            identifier: "2.49.0.0.724.0.ES.260822091208.774602XXP1",
            sent: "2026-08-22T09:12:08+00:00",
            info: [
              {
                language: "es-ES",
                event: "Aviso raro",
                onset: "2026-08-23T03:00:00+02:00",
                expires: "2026-08-23T09:59:59+02:00",
                parameter: [
                  { valueName: "awareness_level", value: "3; orange; Severe" },
                  { valueName: "awareness_type", value: "99; unknown" },
                ],
                area: [{ areaDesc: "x", geocode: [{ valueName: "EMMA_ID", value: "ES247" }] }],
              },
            ],
          },
        },
      ],
    };
    const [row] = parseFeed(fake, ZONES);
    expect(row!.eventCode).toBeNull();
    expect(row!.level).toBe("naranja");
  });

  it("prefiere el bloque en español", () => {
    const alert = feed.warnings[0]!.alert;
    expect(pickInfo(alert)!.language).toBe("es-ES");
  });
});
