import { createDb, logger, runRiskCycle, runWithStatus } from "@talaia/shared";

/** Fuerza un ciclo de evaluación del semáforo (mismo camino que el job `risk`). */
const { db, close } = createDb();
runWithStatus(db, "risk", () => runRiskCycle(db))
  .then((r) => logger.info({ r }, "riesgo: fin"))
  .finally(close);
