import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { XMLParser } from "fast-xml-parser";
import { extract } from "tar-stream";
import type { AlertRow } from "@talaia/shared";

export interface CapAlert extends Omit<AlertRow, "geom"> {
  /** Polígonos como listas de [lon, lat] (CAP usa "lat,lon"). */
  polygons: [number, number][][];
}

const LEVELS = new Set(["verde", "amarillo", "naranja", "rojo"]);

/** Extrae todos los ficheros .xml de un tar.gz. */
export async function extractXmlFromTarGz(tarGz: Buffer): Promise<{ name: string; xml: string }[]> {
  const out: { name: string; xml: string }[] = [];
  const ex = extract();
  ex.on("entry", (header, stream, next) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      if (header.type === "file" && header.name.toLowerCase().endsWith(".xml")) {
        out.push({ name: header.name, xml: Buffer.concat(chunks).toString("utf8") });
      }
      next();
    });
    stream.resume();
  });
  await new Promise<void>((resolve, reject) => {
    ex.on("finish", resolve);
    ex.on("error", reject);
    Readable.from(tarGz).pipe(createGunzip()).on("error", reject).pipe(ex);
  });
  return out;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  isArray: (name) =>
    ["info", "parameter", "area", "polygon", "geocode", "eventCode"].includes(name),
  parseTagValue: false,
  trimValues: true,
});

/**
 * Parsea un CAP 1.2 de AEMET y devuelve una alerta por `<area>` del bloque `<info>` en español
 * cuya zona esté en `zones`. Los mensajes "sin aviso" (`severity=Minor`, nivel verde) se descartan.
 */
export function parseCap(xml: string, zones: Set<string>): CapAlert[] {
  const doc = parser.parse(xml) as { alert?: Record<string, unknown> };
  const alert = doc.alert;
  if (!alert) return [];
  const infos = (alert.info as Record<string, unknown>[] | undefined) ?? [];
  const info =
    infos.find((i) =>
      String(i.language ?? "")
        .toLowerCase()
        .startsWith("es"),
    ) ?? infos[0];
  if (!info) return [];

  const params = paramMap(info.parameter as { valueName: string; value: string }[] | undefined);
  const level = (params.get("AEMET-Meteoalerta nivel") ?? "").toLowerCase();
  const severity = String(info.severity ?? "");
  if (severity === "Minor" || level === "verde" || !LEVELS.has(level)) return [];

  const eventCodeRaw = ((info.eventCode as { value?: string }[] | undefined)?.[0]?.value ??
    "") as string;
  const [eventCode, eventName] = eventCodeRaw.split(";");
  const out: CapAlert[] = [];
  for (const area of (info.area as Record<string, unknown>[] | undefined) ?? []) {
    const geocodes = (area.geocode as { valueName: string; value: string }[] | undefined) ?? [];
    const zone = geocodes.find((g) => g.valueName === "AEMET-Meteoalerta zona")?.value;
    if (!zone || !zones.has(zone)) continue;
    const polygons = ((area.polygon as string[] | undefined) ?? [])
      .map(parsePolygon)
      .filter((p) => p.length >= 4);
    out.push({
      id: `${String(alert.identifier)}#${zone}`,
      source: "aemet",
      areaCode: zone,
      areaName: String(area.areaDesc ?? ""),
      eventCode: eventCode ?? null,
      event: eventName ?? null,
      level: level as AlertRow["level"],
      severity,
      parameter: params.get("AEMET-Meteoalerta parametro") ?? null,
      onset: new Date(String(info.onset)),
      expires: new Date(String(info.expires)),
      sent: new Date(String(alert.sent)),
      headline: (info.headline as string | undefined) ?? null,
      description: (info.description as string | undefined) ?? null,
      raw: {
        identifier: alert.identifier,
        msgType: alert.msgType,
        references: alert.references,
        info,
      },
      polygons,
    });
  }
  return out;
}

function paramMap(params: { valueName: string; value: string }[] | undefined): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of params ?? []) m.set(p.valueName, p.value);
  return m;
}

/** "43.47,-7.05 43.47,-7.0 …" → [[lon,lat], …] */
function parsePolygon(s: string): [number, number][] {
  return s
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter((p) => p.length === 2 && p.every(Number.isFinite))
    .map(([lat, lon]) => [lon!, lat!] as [number, number]);
}

/** WKT MultiPolygon (SRID 4326) a partir de polígonos [lon,lat]; null si no hay. */
export function toMultiPolygonWkt(polygons: [number, number][][]): string | null {
  if (polygons.length === 0) return null;
  const rings = polygons.map((ring) => {
    const closed =
      ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1]
        ? ring
        : [...ring, ring[0]!];
    return `((${closed.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
  });
  return `SRID=4326;MULTIPOLYGON(${rings.join(", ")})`;
}
