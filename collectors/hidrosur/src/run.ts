import {
  loadSensors,
  logger,
  runWithStatus,
  upsertObservations,
  type Db,
  type ObservationRow,
  type RunResult,
} from "@talaia/shared";
import { HidrosurClient } from "./client.js";
import {
  parseEmbalsesTable,
  parseGrafica,
  parseRiosTable,
  parseUpdatedAt,
  SOURCE,
  type HistoryPoint,
} from "./parse.js";

export { SOURCE };

/** `hidrosur:{numero}:{variable}` → número de estación del visor Hidrosur. */
export function stationNumber(sensorId: string): string | null {
  return sensorId.match(/^hidrosur:(\d+):/)?.[1] ?? null;
}

export interface RunOptions {
  client?: HidrosurClient;
}

/** Nunca lanza; registra el resultado en `source_status`. */
export async function run(db: Db, opts: RunOptions = {}): Promise<RunResult | undefined> {
  return runWithStatus(db, SOURCE, () => collect(db, opts));
}

/**
 * SAIH Hidrosur (Junta de Andalucía): nivel y caudal de ríos, lluvia de
 * pluviómetros y volumen de embalses de Málaga y la Axarquía.
 *
 * Las tablas `resumen/*` traen la última hora con su "Datos actualizados a";
 * las gráficas por estación, el histórico horario de 48 h (lluvia y nivel).
 * La gráfica de río no trae caudal, así que `river_flow_m3s` entra solo con
 * el último valor; la de embalse trae cota (no %), así que los embalses
 * también van solo con último valor hasta que haya backfill por "datos a la
 * carta".
 */
export async function collect(db: Db, opts: RunOptions = {}): Promise<RunResult> {
  const client = opts.client ?? new HidrosurClient();
  const specs = await loadSensors(db, SOURCE);
  if (specs.length === 0) throw new Error("sin sensores hidrosur sembrados en el catálogo");

  const byStation = new Map<string, Set<string>>();
  for (const s of specs) {
    const n = stationNumber(s.id);
    if (!n) continue;
    if (!byStation.has(n)) byStation.set(n, new Set());
    byStation.get(n)!.add(s.variable);
  }

  const [riosHtml, embHtml] = await Promise.all([client.resumenRios(), client.resumenEmbalses()]);
  const riosAt = parseUpdatedAt(riosHtml);
  const embAt = parseUpdatedAt(embHtml);
  if (!riosAt || !embAt) throw new Error("resumen sin 'Datos actualizados a' (¿cambió el HTML?)");
  const rios = new Map(parseRiosTable(riosHtml).map((r) => [r.number, r]));
  const embalses = new Map(parseEmbalsesTable(embHtml).map((r) => [r.number, r]));
  if (rios.size === 0) throw new Error("la tabla de ríos no devolvió ninguna estación");

  const rows: ObservationRow[] = [];
  const problems: string[] = [];
  const push = (
    stationId: string,
    variable: ObservationRow["variable"],
    ts: Date,
    value: number | null,
    unit: string,
  ) => {
    if (value === null || !Number.isFinite(value)) return;
    rows.push({ source: SOURCE, stationId, variable, ts, value, unit, quality: 0 });
  };

  for (const [num, variables] of byStation) {
    const stationId = `hidrosur:${num}`;
    try {
      const river = rios.get(num);
      const emb = embalses.get(num);
      if (variables.has("river_flow_m3s") && river)
        push(stationId, "river_flow_m3s", riosAt, river.flowM3s, "m³/s");
      if (variables.has("reservoir_pct") && emb)
        push(stationId, "reservoir_pct", embAt, emb.pct, "%");
      if (variables.has("reservoir_hm3") && emb)
        push(stationId, "reservoir_hm3", embAt, emb.hm3, "hm³");

      // El caudal solo existe como último valor de la tabla; el histórico de la
      // gráfica es de nivel (ríos) o de lluvia (pluviómetros).
      const needsHistory = variables.has("precip_mm") || variables.has("river_level_m");
      if (!needsHistory) continue;
      // El código de gráfica sale de los enlaces de la propia tabla; en
      // pluviómetros es regular (`{num}P01`) y se verifica por `sensorTipo`.
      let code: string | null = river?.grafica ?? emb?.grafica ?? null;
      let expectTipo = "R";
      if (variables.has("precip_mm") && !variables.has("river_level_m")) {
        code = `${num}P01`;
        expectTipo = "P";
      }
      if (!code) {
        problems.push(`${stationId} (sin enlace a gráfica)`);
        continue;
      }
      const g = parseGrafica(await client.grafica(code));
      if (!g || g.points.length === 0) continue; // serie vacía = sin lluvia en 48 h
      if (expectTipo === "P" && g.sensorTipo !== "P") {
        problems.push(`${stationId} (la gráfica ${code} no es de lluvia)`);
        continue;
      }
      const serie: HistoryPoint[] = g.points;
      if (variables.has("precip_mm") && g.sensorTipo === "P") {
        for (const p of serie) push(stationId, "precip_mm", p.ts, p.value, "mm");
      }
      if (variables.has("river_level_m") && g.sensorTipo === "R") {
        for (const p of serie) push(stationId, "river_level_m", p.ts, p.value, "m");
      }
    } catch (err) {
      problems.push(`${stationId} (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  const written = await upsertObservations(db, rows);
  logger.info({ rows: written, problems: problems.length }, "hidrosur: observaciones escritas");
  if (rows.length === 0 && problems.length > 0) {
    throw new Error(`hidrosur sin datos: ${problems.slice(0, 3).join("; ")}`);
  }
  return {
    recordsWritten: written,
    ...(problems.length > 0 ? { warning: `hidrosur parcial: ${problems.join("; ")}` } : {}),
  };
}
