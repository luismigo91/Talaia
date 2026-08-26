import { describe, expect, it } from "vitest";
import { dedupeAlerts } from "../src/alerts.js";

const base = {
  areaCode: "774602",
  eventCode: "PR",
  level: "naranja",
  onset: new Date("2026-08-25T10:00:00Z"),
  expires: new Date("2026-08-25T20:00:00Z"),
};

describe("dedupeAlerts", () => {
  it("el mismo aviso en dos fuentes se cuenta una vez, y manda AEMET", () => {
    const out = dedupeAlerts([
      { id: "m", source: "meteoalarm", ...base },
      { id: "a", source: "aemet", ...base },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("aemet");
  });

  it("da igual el orden de llegada", () => {
    const out = dedupeAlerts([
      { id: "a", source: "aemet", ...base },
      { id: "m", source: "meteoalarm", ...base },
    ]);
    expect(out[0]!.id).toBe("a");
  });

  it("si solo está Meteoalarm, se usa Meteoalarm", () => {
    const out = dedupeAlerts([{ id: "m", source: "meteoalarm", ...base }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("meteoalarm");
  });

  it("avisos distintos de la misma zona se conservan los dos", () => {
    const out = dedupeAlerts([
      { id: "a", source: "aemet", ...base },
      { id: "b", source: "aemet", ...base, eventCode: "TO" },
    ]);
    expect(out).toHaveLength(2);
  });

  it("distinta vigencia o nivel no es el mismo aviso", () => {
    const out = dedupeAlerts([
      { id: "a", source: "aemet", ...base },
      { id: "b", source: "meteoalarm", ...base, level: "rojo" },
      { id: "c", source: "meteoalarm", ...base, expires: new Date("2026-08-26T20:00:00Z") },
    ]);
    expect(out).toHaveLength(3);
  });

  it("tolera diferencias de segundos: cada fuente sella el aviso a su manera", () => {
    const out = dedupeAlerts([
      { id: "a", source: "aemet", ...base },
      {
        id: "m",
        source: "meteoalarm",
        ...base,
        onset: new Date("2026-08-25T10:00:41Z"),
        expires: new Date("2026-08-25T20:00:12Z"),
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("aemet");
  });

  it("pero un minuto de diferencia ya es otro aviso", () => {
    const out = dedupeAlerts([
      { id: "a", source: "aemet", ...base },
      { id: "m", source: "meteoalarm", ...base, expires: new Date("2026-08-25T20:01:00Z") },
    ]);
    expect(out).toHaveLength(2);
  });

  it("compara fechas por instante, no por representación", () => {
    const out = dedupeAlerts([
      { id: "a", source: "aemet", ...base },
      { id: "m", source: "meteoalarm", ...base, onset: "2026-08-25T12:00:00+02:00" },
    ]);
    expect(out).toHaveLength(1);
  });

  it("una fuente desconocida cede ante las conocidas", () => {
    const out = dedupeAlerts([
      { id: "x", source: "otra", ...base },
      { id: "m", source: "meteoalarm", ...base },
    ]);
    expect(out[0]!.source).toBe("meteoalarm");
  });
});
