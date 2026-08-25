import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

type StatusRow = {
  source: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  records_written: number | null;
  age_seconds: number | null;
};

@Controller("api/v1/status")
export class StatusController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Frescura por fuente lógica: `age_seconds` desde el último éxito (null si nunca). */
  @Get()
  async status() {
    const rows = await this.db.execute<StatusRow>(sql`
      select source, last_run_at, last_success_at, last_error, records_written,
             case when last_success_at is null then null
                  else floor(extract(epoch from (now() - last_success_at)))::int end as age_seconds
      from source_status order by source
    `);
    return { sources: rows };
  }
}
