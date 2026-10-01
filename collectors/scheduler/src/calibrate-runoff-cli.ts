import {
  createDb,
  fitIsUsable,
  fitRunoff,
  loadRunoffHistory,
  loadWatchPoints,
  runoffVerdict,
  upsertRunoffModel,
} from "@talaia/shared";

/**
 * Calibración lluvia‑caudal: qué dice el histórico sobre la relación entre la lluvia de
 * cabecera y el caudal del aforo de una localización.
 *
 *   pnpm --filter @talaia/scheduler calibrate-runoff [virtual:albal] [--window 3] [--apply]
 *     [--flow saih:13896] [--rain saih:225:precip_mm,saih:408:precip_mm]
 *
 * Por defecto usa el aforo `flow_primary` y los pluviómetros `rain_upstream` de `watch_points`;
 * `--flow` y `--rain` permiten probar otra cuenca (una rambla secundaria, por ejemplo). Informa
 * siempre; solo escribe en `runoff_models` con `--apply` y si el ajuste cumple lo mínimo.
 */
const args = process.argv.slice(2);
const stationArg = args.find((a) => !a.startsWith("--")) ?? "virtual:albal";
const apply = args.includes("--apply");
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const windowHours = Number(opt("--window")) || 3;
const flowOverride = opt("--flow");
const rainOverride = opt("--rain")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const { db, close } = createDb();
const fmt = (v: number | null, dec = 2) => (v === null ? "—" : v.toFixed(dec).replace(".", ","));

try {
  const points = await loadWatchPoints(db, stationArg);
  const all = await loadWatchPoints(db);
  const flow = flowOverride
    ? all.find((p) => p.sensorId === flowOverride)
    : points.find((p) => p.role === "flow_primary");
  const rain = rainOverride
    ? rainOverride.flatMap((id) => all.find((p) => p.sensorId === id) ?? [])
    : points.filter((p) => p.role === "rain_upstream" && p.variable === "precip_mm");
  if (!flow || rain.length === 0) {
    console.log(`${stationArg}: sin aforo principal o sin pluviómetros de cabecera vigilados`);
    process.exit(0);
  }
  console.log(`=== ${stationArg} · aforo ${flow.sensorId} (${flow.sensorStationName})`);
  console.log(
    `    cabecera: ${rain.map((p) => `${p.sensorId} (${p.sensorStationName})`).join(", ")}`,
  );
  console.log(
    `    ventana: ${windowHours} h · umbrales del aforo: ${flow.thresholdLow}/${flow.thresholdMid}/${flow.thresholdHigh} ${flow.unit}`,
  );

  const history = await loadRunoffHistory(db, {
    flowSensorId: flow.sensorId,
    rainSensorIds: rain.map((p) => p.sensorId),
  });
  const first = history.flow[0]?.ts;
  const last = history.flow.at(-1)?.ts;
  console.log(
    `    histórico: ${history.flow.length.toLocaleString("es-ES")} muestras de caudal` +
      (first && last
        ? ` (${first.toISOString().slice(0, 10)} → ${last.toISOString().slice(0, 10)})`
        : "") +
      `, ${history.rainByGauge.map((g: unknown[]) => g.length).join("+")} horas de lluvia`,
  );
  if (history.flow.length === 0) {
    console.log("    sin histórico de caudal descargado: nada que ajustar");
    process.exit(0);
  }

  const fit = fitRunoff(history.flow, history.rainByGauge, { windowHours });
  // El ajuste tiene que conocer, al menos, el primer umbral del aforo: si no, extrapola.
  const usable = { minPeakFlow: flow.thresholdLow ?? 10 };
  console.log(`    muestras de caudal descartadas por implausibles: ${fit.discardedFlowSamples}`);
  console.log(
    `    horas con ≥ 5 mm de media en cabecera (${windowHours} h): ${fit.rainyHours} · con respuesta del aforo (≥ 0,5 m³/s): ${fit.respondingHours}`,
  );
  console.log(
    `    retardo: ${fit.lagMinutes === null ? "—" : `${fit.lagMinutes} min`} (r ${fmt(fit.lagCorrelation, 3)})` +
      ` · vigilancia actual: ${rain.map((p) => p.lagMinutes ?? "—").join("/")} min`,
  );
  console.log(
    `    ajuste Q = a·P^b: a ${fmt(fit.coefA, 4)} · b ${fmt(fit.coefB, 3)} · r² ${fmt(fit.r2, 3)} · n ${fit.n} · caudal máximo con respuesta ${fmt(fit.peakFlow, 1)} m³/s`,
  );
  if (fit.coefA !== null && fit.coefB !== null) {
    const q = (p: number) => fmt(fit.coefA! * Math.pow(p, fit.coefB!), 1);
    console.log(`    proyección: 20 mm → ${q(20)} · 40 mm → ${q(40)} · 90 mm → ${q(90)} m³/s`);
  }
  if (fit.episodes.length > 0) {
    console.log("    episodios con lluvia apreciable (los mayores) y pico de caudal que siguió:");
    for (const e of fit.episodes.slice(0, 8)) {
      console.log(
        `      ${e.start.slice(0, 16).replace("T", " ")} → ${e.end.slice(5, 16).replace("T", " ")}  ${fmt(e.rainMm, 1)} mm  →  pico ${fmt(e.peakFlow, 1)} m³/s`,
      );
    }
  }
  console.log(`    veredicto: ${runoffVerdict(fit, usable)}`);

  if (apply) {
    if (!fitIsUsable(fit, usable)) {
      console.log("    --apply: el ajuste no cumple lo mínimo; no se escribe nada");
    } else {
      const id = `${stationArg}:${flow.sensorId}`;
      await upsertRunoffModel(db, {
        id,
        stationId: stationArg,
        flowSensorId: flow.sensorId,
        rainSensorIds: rain.map((p) => p.sensorId),
        windowHours,
        lagMinutes: fit.lagMinutes!,
        coefA: fit.coefA!,
        coefB: fit.coefB!,
        minRainMm: 1,
        meta: {
          fitted_at: new Date().toISOString(),
          fitted_from: first?.toISOString() ?? null,
          fitted_to: last?.toISOString() ?? null,
          n_hours: fit.n,
          n_episodes: fit.episodes.length,
          r2: fit.r2,
          lag_correlation: fit.lagCorrelation,
          source: "calibrate-runoff sobre el histórico del SAIH",
        },
      });
      console.log(`    --apply: modelo ${id} escrito`);
    }
  }
} finally {
  await close();
}
