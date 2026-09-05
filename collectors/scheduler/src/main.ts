import { writeFile } from "node:fs/promises";
import cron from "node-cron";
import { migrate } from "@talaia/db";
import { checkEnv, createDb, logger, waitForDb, type Db } from "@talaia/shared";
import { run as runOpenMeteo } from "@talaia/collector-open-meteo";
import { run as runSaih } from "@talaia/collector-saih";
import { run as runMeteoalarm } from "@talaia/collector-meteoalarm";
import { run as runAvamet } from "@talaia/collector-avamet";
import { run as runGva } from "@talaia/collector-gva";
import {
  run as runAemet,
  AemetClient,
  resolveApiKey,
  runForecasts,
  collectAlerts,
  collectObservations,
  ALERTS_SOURCE,
  OBSERVATION_SOURCE,
} from "@talaia/collector-aemet";
import { runWithStatus, runRiskCycle } from "@talaia/shared";

interface Job {
  name: string;
  intervalMin: number;
  fn: (db: Db) => Promise<unknown>;
}

const minutes = (env: string, def: number) => Math.max(1, Number(process.env[env] ?? def) || def);
const HEARTBEAT = process.env.HEARTBEAT_FILE ?? "/tmp/talaia-heartbeat";

/** Un único cliente AEMET por proceso: el limitador de cuota es compartido entre jobs. */
let aemet: AemetClient | undefined;
function aemetClient(): AemetClient | undefined {
  if (!aemet && resolveApiKey()) aemet = new AemetClient();
  return aemet;
}

const jobs: Job[] = [
  { name: "open-meteo", intervalMin: minutes("OPEN_METEO_INTERVAL_MIN", 30), fn: runOpenMeteo },
  {
    name: "aemet-forecast",
    intervalMin: minutes("AEMET_FORECAST_INTERVAL_MIN", 30),
    fn: async (db) => {
      const c = aemetClient();
      return c ? runForecasts(db, c) : runAemet(db); // sin clave: runAemet registra el error
    },
  },
  { name: "saih", intervalMin: minutes("SAIH_INTERVAL_MIN", 10), fn: runSaih },
  {
    name: "meteoalarm",
    intervalMin: minutes("METEOALARM_INTERVAL_MIN", 10),
    fn: runMeteoalarm,
  },
  {
    // Estaciones amateur: la única señal del Horteta, que está fuera del SAIH.
    name: "avamet",
    intervalMin: minutes("AVAMET_INTERVAL_MIN", 10),
    fn: runAvamet,
  },
  {
    // Protección Civil autonómica: activación de fases del plan de emergencias.
    name: "gva",
    intervalMin: minutes("GVA_INTERVAL_MIN", 5),
    fn: runGva,
  },
  {
    name: "aemet-alerts",
    intervalMin: minutes("AEMET_ALERTS_INTERVAL_MIN", 10),
    fn: async (db) => {
      const c = aemetClient();
      if (!c)
        return runWithStatus(db, ALERTS_SOURCE, () =>
          Promise.reject(new Error("falta AEMET_API_KEY")),
        );
      return runWithStatus(db, ALERTS_SOURCE, () => collectAlerts(db, c, "77"));
    },
  },
  {
    // La observación oficial es la referencia con la que contrastar la lluvia derivada del SAIH.
    name: "aemet-observation",
    intervalMin: minutes("AEMET_OBSERVATION_INTERVAL_MIN", 30),
    fn: async (db) => {
      const c = aemetClient();
      return runWithStatus(db, OBSERVATION_SOURCE, () =>
        c ? collectObservations(db, c) : Promise.reject(new Error("falta AEMET_API_KEY")),
      );
    },
  },
  {
    name: "risk",
    intervalMin: minutes("RISK_INTERVAL_MIN", 5),
    // El semáforo se evalúa después de los collectors, sobre los datos recién escritos.
    fn: (db) => runWithStatus(db, "risk", () => runRiskCycle(db)),
  },
];

async function main() {
  checkEnv();
  if (process.env.RUN_MIGRATIONS !== "false") {
    const applied = await migrate();
    logger.info({ applied: applied.length }, "migraciones al día");
  }
  const { db, sql } = createDb();
  await waitForDb(sql);
  logger.info({ jobs: jobs.map((j) => `${j.name}@${j.intervalMin}m`) }, "scheduler arrancado");

  const running = new Set<string>();
  const execute = async (job: Job) => {
    if (running.has(job.name)) {
      logger.warn({ job: job.name }, "ejecución anterior todavía en curso; se omite");
      return;
    }
    running.add(job.name);
    const started = Date.now();
    try {
      await job.fn(db); // los collectors nunca lanzan: registran en source_status
    } catch (err) {
      logger.error({ job: job.name, err }, "fallo no controlado en collector");
    } finally {
      running.delete(job.name);
      logger.info({ job: job.name, ms: Date.now() - started }, "collector terminado");
      await writeFile(HEARTBEAT, new Date().toISOString()).catch(() => {});
    }
  };

  for (const job of jobs) {
    cron.schedule(`*/${job.intervalMin} * * * *`, () => void execute(job));
  }
  // Ejecución inicial al arrancar
  for (const job of jobs) await execute(job);

  const stop = () => {
    logger.info("scheduler parando");
    void sql.end({ timeout: 5 }).then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  logger.error({ err }, "scheduler no pudo arrancar");
  process.exit(1);
});
