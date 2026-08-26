import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FENOMENO_EVENT_CODE,
  SITUACION_LEVEL,
  parseEmergencies,
  parseGvaTime,
  type GvaEmergencies,
} from "../src/parse.js";

const sinAvisos = JSON.parse(
  readFileSync(new URL("../fixtures/emergencias-sin-avisos.json", import.meta.url), "utf8"),
) as GvaEmergencies;

/**
 * OJO: esta fixture está **reconstruida** del parser del widget de la GVA, no capturada de una
 * respuesta real (cuando se escribió esto no había ninguna emergencia activa). Verifica la
 * FORMA de `z2`; captura una real en el próximo episodio de lluvias antes de fiarte del todo.
 */
const reconstruido = JSON.parse(
  readFileSync(new URL("../fixtures/emergencias-reconstruido.json", import.meta.url), "utf8"),
) as GvaEmergencies;

const NOW = new Date("2026-10-29T13:00:00Z");
const opts = { zones: new Set(["23", "28", "33", "51"]), now: NOW, ttlMinutes: 30 };

describe("parseGvaTime", () => {
  it("interpreta la hora como local de Madrid", () => {
    expect(parseGvaTime("2026-10-29 12:00:00.0")!.toISOString()).toBe("2026-10-29T11:00:00.000Z");
  });
  it("devuelve undefined si no hay fecha", () => {
    expect(parseGvaTime("nada")).toBeUndefined();
  });
});

describe("sin emergencias activas (fixture real)", () => {
  it("z2 vacío no produce ninguna fila", () => {
    expect(parseEmergencies(sinAvisos, opts)).toEqual([]);
  });
});

describe("con emergencias (fixture reconstruida — forma del z2)", () => {
  const rows = parseEmergencies(reconstruido, opts);

  it("una fila por (zona, aviso) de las zonas que nos afectan", () => {
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.areaCode).sort()).toEqual(["28", "33"]);
    expect(rows.every((r) => r.source === "gva")).toBe(true);
  });

  it("traduce la fase a nivel y el fenómeno a código de AEMET", () => {
    const horta = rows.find((r) => r.areaCode === "28")!; // sit 15 (SIT 1), fen 10 (Inundaciones)
    expect(horta.level).toBe("naranja");
    expect(horta.eventCode).toBe("IN");
    expect(horta.event).toContain("Situación 1");
    expect(horta.event).toContain("Inundaciones");
    const ribera = rows.find((r) => r.areaCode === "33")!; // sit 16 (SIT 2)
    expect(ribera.level).toBe("rojo");
  });

  it("la vigencia se infiere: expires = now + ttl, onset = el time del feed", () => {
    const horta = rows.find((r) => r.areaCode === "28")!;
    expect(horta.expires.getTime()).toBe(NOW.getTime() + 30 * 60_000);
    expect(horta.onset.toISOString()).toBe("2024-10-29T11:00:00.000Z"); // el `time` del feed reconstruido
  });

  it("id determinista para que un ciclo posterior refresque la misma fila", () => {
    expect(rows.find((r) => r.areaCode === "28")!.id).toBe("gva:28:10:15");
  });

  it("ignora zonas que no vigilamos", () => {
    const solo33 = parseEmergencies(reconstruido, { ...opts, zones: new Set(["33"]) });
    expect(solo33.map((r) => r.areaCode)).toEqual(["33"]);
  });
});

describe("tablas de traducción", () => {
  it("las cuatro situaciones del plan mapean a nivel", () => {
    expect(SITUACION_LEVEL[14]).toBe("amarillo"); // SIT 0 (preemergencia)
    expect(SITUACION_LEVEL[15]).toBe("naranja");
    expect(SITUACION_LEVEL[16]).toBe("rojo");
    expect(SITUACION_LEVEL[17]).toBe("rojo");
  });

  it("inundaciones y tormentas llevan el código que eleva el semáforo", () => {
    expect(FENOMENO_EVENT_CODE[10]).toBe("IN");
    expect(FENOMENO_EVENT_CODE[15]).toBe("TO");
  });

  it("un fenómeno desconocido no rompe: código nulo", () => {
    const feed: GvaEmergencies = {
      time: "2026-10-29 12:00:00.0",
      z2: { "28": [{ sit: 15, fen: 999 }] },
    };
    const [row] = parseEmergencies(feed, opts);
    expect(row!.eventCode).toBeNull();
    expect(row!.level).toBe("naranja");
  });
});
