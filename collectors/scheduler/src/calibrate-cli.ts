import { createDb, loadWatchPoints, sensorStats, verdict } from "@talaia/shared";

/**
 * Informe de calibración: qué dice el histórico sobre los umbrales de los sensores vigilados.
 *   pnpm --filter @talaia/scheduler calibrate [virtual:albal]
 */
const stationArg = process.argv[2];
const { db, close } = createDb();

const fmt = (v: number | null, unit: string) =>
  v === null ? "—" : `${(Math.round(v * 100) / 100).toString().replace(".", ",")} ${unit}`;

try {
  const points = await loadWatchPoints(db, stationArg);
  const conUmbral = points.filter((p) => p.thresholdLow !== null);
  const vistos = new Set<string>();

  for (const p of conUmbral) {
    if (vistos.has(p.sensorId)) continue;
    vistos.add(p.sensorId);
    const stats = await sensorStats(db, p.sensorId);
    if (!stats || stats.samples === 0) {
      console.log(`\n${p.sensorId} · ${p.sensorStationName}: sin histórico descargado`);
      continue;
    }
    const u = stats.unit;
    console.log(`\n=== ${stats.sensorId} · ${stats.stationName} (${stats.variable})`);
    console.log(
      `    periodo: ${stats.from?.slice(0, 10)} → ${stats.to?.slice(0, 10)} · ${stats.samples.toLocaleString("es-ES")} muestras`,
    );
    console.log(
      `    umbrales: ${fmt(stats.thresholds.low, u)} / ${fmt(stats.thresholds.mid, u)} / ${fmt(stats.thresholds.high, u)}`,
    );
    console.log(
      `    mediana ${fmt(stats.median, u)} · p90 ${fmt(stats.p90, u)} · p99 ${fmt(stats.p99, u)} · p99,9 ${fmt(stats.p999, u)} · máx ${fmt(stats.max, u)}`,
    );
    console.log(
      `    horas por encima: amarillo ${stats.hoursAbove.low} · naranja ${stats.hoursAbove.mid} · rojo ${stats.hoursAbove.high}`,
    );
    console.log(`    veredicto: ${verdict(stats)}`);
    if (stats.episodes.length > 0) {
      console.log("    episodios (los mayores):");
      for (const e of stats.episodes.slice(0, 5)) {
        console.log(
          `      ${e.start.slice(0, 16).replace("T", " ")} → ${e.end.slice(11, 16)}  pico ${fmt(e.peak, u)} (${e.level})`,
        );
      }
    }
  }
  if (vistos.size === 0) console.log("No hay sensores con umbrales para esa selección.");
} finally {
  await close();
}
