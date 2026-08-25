import { createDb, logger } from "@talaia/shared";
import { run } from "./run.js";

const { db, close } = createDb();
run(db)
  .then(() => logger.info("aemet: fin"))
  .finally(close);
