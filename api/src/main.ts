import { migrate } from "@talaia/db";
import { checkEnv, logger } from "@talaia/shared";
import { createApp } from "./app.js";

checkEnv();

const port = Number(process.env.API_PORT ?? 3000);
const runMigrations = process.env.RUN_MIGRATIONS !== "false";
(runMigrations
  ? migrate().then((a) => logger.info({ applied: a.length }, "migraciones al día"))
  : Promise.resolve()
)
  .then(() => createApp())
  .then((app) => app.listen(port, "0.0.0.0"))
  .then(() => logger.info({ port }, "api escuchando"))
  .catch((err) => {
    logger.error({ err }, "la api no pudo arrancar");
    process.exit(1);
  });
