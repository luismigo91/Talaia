import { logger } from "@talaia/shared";
import { createApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 3000);
createApp()
  .then((app) => app.listen(port, "0.0.0.0"))
  .then(() => logger.info({ port }, "api escuchando"))
  .catch((err) => {
    logger.error({ err }, "la api no pudo arrancar");
    process.exit(1);
  });
