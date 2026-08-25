import { writeFile } from "node:fs/promises";
import cron from "node-cron";
import { createDb, logger, waitForDb, type Db } from "@talaia/shared";
import { run as runOpenMeteo } from "@talaia/collector-open-meteo";

interface Job {
  name: string;
  intervalMin: number;
  fn: (db: Db) => Promise<unknown>;
}

const minutes = (env: string, def: number) => Math.max(1, Number(process.env[env] ?? def) || def);
const HEARTBEAT = process.env.HEARTBEAT_FILE ?? "/tmp/talaia-heartbeat";

const jobs: Job[] = [
  { name: "open-meteo", intervalMin: minutes("OPEN_METEO_INTERVAL_MIN", 30), fn: runOpenMeteo },
];

async function main() {
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
