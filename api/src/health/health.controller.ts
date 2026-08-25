import { Controller, Get, HttpException, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

@Controller("api/v1/health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async health() {
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, db: true };
    } catch {
      throw new HttpException({ ok: false, db: false }, 503);
    }
  }
}
