import { Controller, Get, HttpException, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

type SourceFreshness = {
  source: string;
  last_success_at: string | null;
  age_seconds: number | null;
  stale: boolean;
  threshold_seconds: number;
};

const STALE_THRESHOLDS: Record<string, number> = {
  // fuentes tiempo-real (interval 5-10 min) → stale a 30 min
  saih: 30 * 60,
  avamet: 30 * 60,
  gva: 30 * 60,
  meteoalarm: 30 * 60,
  // predicción/modelos y observación horaria → stale a 120 min
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

@Controller("api/v1/health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async health() {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new HttpException({ ok: false, db: false }, 503);
    }

    let sources: SourceFreshness[] = [];
    let warnings: string[] = [];
    try {
      const rows = await this.db.execute<{
        source: string;
        last_success_at: string | null;
        age_seconds: number | null;
      }>(sql`
        select source, last_success_at,
               case when last_success_at is null then null
                    else floor(extract(epoch from (now() - last_success_at)))::int end as age_seconds
        from source_status order by source
      `);
      const aemetOff = isAemetDisabled();
      sources = rows.map((r) => {
        const thr = thresholdFor(r.source);
        const disabled = aemetOff && r.source.startsWith("aemet");
        const stale = disabled ? false : r.age_seconds === null ? true : r.age_seconds > thr;
        return {
          source: r.source,
          last_success_at: r.last_success_at,
          age_seconds: r.age_seconds,
          stale,
          threshold_seconds: thr,
        };
      });
      warnings = sources
        .filter((s) => s.stale)
        .map((s) =>
          s.age_seconds === null
            ? `${s.source} sin éxito registrado`
            : `${s.source} desactualizado (${Math.round(s.age_seconds! / 60)} min > ${s.threshold_seconds / 60} min)`,
        );
    } catch {
      // si source_status no existe aún (primera migración), no falla el health
    }

    const ok = warnings.length === 0;
    return { ok, db: true, sources, warnings };
  }
}
