import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractXmlFromTarGz, parseCap, toMultiPolygonWkt } from "../src/cap.js";

const tarGz = readFileSync(new URL("../fixtures/avisos-77.tar.gz", import.meta.url));
const zones = new Set(["774602", "774604"]);

describe("CAP de AEMET", () => {
  it("extrae los XML del tar.gz", async () => {
    const files = await extractXmlFromTarGz(tarGz);
    expect(files.map((f) => f.name).sort()).toHaveLength(4);
    expect(files.every((f) => f.xml.includes("urn:oasis:names:tc:emergency:cap:1.2"))).toBe(true);
  });

  it("aviso amarillo por lluvia en 774602 con nivel, parámetro, fechas UTC y polígono", async () => {
    const files = await extractXmlFromTarGz(tarGz);
    const f = files.find((x) => x.name.includes("774602PR"))!;
    const [a] = parseCap(f.xml, zones);
    expect(a).toBeDefined();
    expect(a!.level).toBe("amarillo");
    expect(a!.event).toBe("Lluvias");
    expect(a!.eventCode).toBe("PR");
    expect(a!.areaCode).toBe("774602");
    expect(a!.parameter).toBe("P2;Precipitación acumulada en 12 horas;60 mm");
    expect(a!.onset.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(a!.expires.toISOString()).toBe("2026-10-25T21:59:59.000Z");
    expect(a!.id).toContain("774602");
    expect(a!.polygons[0]![0]).toEqual([-0.55, 39.65]); // [lon, lat]
    expect(toMultiPolygonWkt(a!.polygons)).toMatch(/^SRID=4326;MULTIPOLYGON\(\(\(-0\.55 39\.65/);
  });

  it("aviso naranja en 774604 (Litoral sur) se acepta", async () => {
    const files = await extractXmlFromTarGz(tarGz);
    const f = files.find((x) => x.name.includes("774604"))!;
    const [a] = parseCap(f.xml, zones);
    expect(a?.level).toBe("naranja");
    expect(a?.areaCode).toBe("774604");
  });

  it("aviso de otra zona (774601) se descarta", async () => {
    const files = await extractXmlFromTarGz(tarGz);
    const f = files.find((x) => x.name.includes("774601"))!;
    expect(parseCap(f.xml, zones)).toEqual([]);
  });

  it('mensaje "sin aviso" (Minor/verde) se descarta aunque liste nuestras zonas', async () => {
    const files = await extractXmlFromTarGz(tarGz);
    const f = files.find((x) => x.name.includes("77VV77"))!;
    expect(f.xml).toContain("774602");
    expect(parseCap(f.xml, zones)).toEqual([]);
  });

  it("todo el tar → exactamente 2 alertas para nuestras zonas", async () => {
    const files = await extractXmlFromTarGz(tarGz);
    const all = files.flatMap((f) => parseCap(f.xml, zones));
    expect(all.map((a) => a.areaCode).sort()).toEqual(["774602", "774604"]);
  });
});
