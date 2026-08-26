import { createDb, logger } from "@talaia/shared";
import { run } from "./run.js";

const { db, close } = createDb();
run(db)
  .then((r) => logger.info({ r }, "gva: fin"))
  .finally(close);
