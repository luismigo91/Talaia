import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  Res,
  ValidationPipe,
} from "@nestjs/common";
import type { ServerResponse } from "node:http";
import {
  evaluateRisk,
  formatLocal,
  type Db,
  type RiskLevel,
  type StationRisk,
} from "@talaia/shared";
import { DB } from "../db/db.module.js";
import { RiskQueryDto } from "./risk.dto.js";

const COLOR: Record<RiskLevel, string> = {
  verde: "#2f8f5a",
  amarillo: "#ad8210",
  naranja: "#c9691c",
  rojo: "#c0392b",
};

interface RawReply {
  raw: ServerResponse;
}

/** El componente que determina el nivel (o el caudal principal en calma). */
function leading(r: StationRisk) {
  const at = r.components.filter((c) => c.level === r.level);
  return (
    at.find((c) => c.kind === "flow") ??
    at[0] ??
    r.components.find((c) => c.kind === "flow") ??
    r.components[0]
  );
}

function reading(r: StationRisk): string {
  const l = leading(r);
  if (!l) return "sin datos";
  if (l.value !== null && l.unit) {
    const v = Math.round(l.value * 100) / 100;
    return `${v.toString().replace(".", ",")} ${l.unit}`;
  }
  return l.detail.slice(0, 40);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

@Controller("api/v1/risk")
export class RiskBadgeController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async one(station?: string): Promise<StationRisk> {
    const all = await evaluateRisk(this.db, station ? { station } : {});
    const r = station
      ? all.find((s) => s.station.id === station)
      : all.find((s) => s.station.primary);
    if (!r) throw new NotFoundException(`estación desconocida: ${station ?? "(ninguna)"}`);
    return r;
  }

  /** Insignia en JSON: para Scriptable (iOS), KWGT (Android) o cualquier widget. */
  @Get("badge")
  async badge(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: RiskQueryDto }))
    q: RiskQueryDto,
  ) {
    const r = await this.one(q.station);
    return {
      station: { id: r.station.id, name: r.station.name },
      level: r.level,
      color: COLOR[r.level],
      reading: reading(r),
      updated: formatLocal(new Date(r.computed_at)).slice(11),
      stale: r.stale,
    };
  }

  /** Insignia como imagen SVG, para incrustar directamente en un widget. */
  @Get("badge.svg")
  async badgeSvg(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: RiskQueryDto }))
    q: RiskQueryDto,
    @Res() reply: RawReply,
  ) {
    const r = await this.one(q.station);
    const color = COLOR[r.level];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="130" viewBox="0 0 320 130" role="img" aria-label="Talaia ${esc(r.station.name)}: ${r.level}">
  <rect x="1" y="1" width="318" height="128" rx="16" fill="#ffffff" stroke="${color}" stroke-width="2"/>
  <text x="20" y="34" font-family="system-ui,-apple-system,sans-serif" font-size="15" fill="#56696a">${esc(r.station.name)}</text>
  <circle cx="27" cy="66" r="9" fill="${color}"/>
  <text x="44" y="73" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="30" letter-spacing="1" fill="${color}">${r.level.toUpperCase()}</text>
  <text x="20" y="104" font-family="ui-monospace,monospace" font-size="15" fill="#10201f">${esc(reading(r))}</text>
  <text x="300" y="104" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="#879898">${esc(formatLocal(new Date(r.computed_at)).slice(11))}</text>
</svg>`;
    reply.raw.writeHead(200, {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=120",
    });
    reply.raw.end(svg);
  }
}
