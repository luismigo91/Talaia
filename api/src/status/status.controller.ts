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
  stale: boolean;
  threshold_seconds: number;
};

const STALE_THRESHOLDS: Record<string, number> = {
  saih: 30 * 60,
  avamet: 30 * 60,
  gva: 30 * 60,
  meteoalarm: 30 * 60,
  "open-meteo": 120 * 60,
  aemet: 120 * 60,
};

function isAemetDisabled(): boolean {
  const raw = process.env.AEMET_ENABLED?.trim().toLowerCase();
  return raw === "false" || raw === "0" || raw === "no" || raw === "off";
}

function thresholdFor(source: string): number {
  for (const [prefix, secs] of Object.entries(STALE_THRESHOLDS)) {
    if (source.startsWith(prefix)) return secs;
  }
  return 30 * 60;
}

@Controller("api/v1/status")
export class StatusController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Frescura por fuente lógica: `age_seconds` desde el último éxito (null si nunca). */
  @Get()
  async status() {
    const rows = await this.db.execute<Omit<StatusRow, "stale" | "threshold_seconds">>(sql`
      select source, last_run_at, last_success_at, last_error, records_written,
             case when last_success_at is null then null
                  else floor(extract(epoch from (now() - last_success_at)))::int end as age_seconds
       from source_status order by source
     `);
    const aemetOff = isAemetDisabled();
    const sources: StatusRow[] = rows.map((r) => {
      const thr = thresholdFor(r.source);
      const disabled = aemetOff && r.source.startsWith("aemet");
      return {
        ...r,
        stale: disabled ? false : r.age_seconds === null ? r.last_success_at === null : r.age_seconds > thr,
        threshold_seconds: thr,
      };
    });
    const warnings = sources
      .filter((s) => s.stale)
      .map((s) =>
        s.age_seconds === null && s.last_success_at === null
          ? `${s.source} sin éxito registrado`
          : `${s.source} desactualizado`,
      );
    return { sources, warnings, aemet_disabled: aemetOff };
  }
}
