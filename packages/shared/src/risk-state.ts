import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { logger } from "./logger.js";
import { RISK_LEVELS, type RiskLevel } from "./risk.js";
import { evaluateRisk, type StationRisk } from "./risk-eval.js";
import { MultiNotifier, notifierFromEnv, type Notifier, type RiskNotification } from "./notify.js";
import { vapidFromEnv, WebPushNotifier } from "./webpush.js";

export function fallConfirmations(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.RISK_FALL_CONFIRMATIONS ?? 3);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 3;
}

const rank = (l: RiskLevel) => RISK_LEVELS.indexOf(l);

export interface RiskStateRow {
  level: RiskLevel;
  since: Date;
  pendingLevel: RiskLevel | null;
  pendingCount: number;
}

export type Transition =
  | { kind: "none" }
  | { kind: "hold"; reason: "sin datos" | "bajada sin confirmar" }
  | {
      kind: "change";
      level: RiskLevel;
      previous: RiskLevel | null;
      direction: "subida" | "bajada";
    };

/**
 * Decide qué hacer con una evaluación, dado el estado anterior.
 *
 * El riesgo sube rápido y baja despacio, y la notificación debe comportarse igual: las subidas
 * se aplican en el acto (en una crecida del Poyo, cinco minutos son la mitad del margen de
 * aviso) y las bajadas exigen varias confirmaciones seguidas, porque un semáforo que parpadea
 * entre verde y amarillo cada cinco minutos deja de leerse a los diez.
 */
export function decideTransition(
  evaluated: RiskLevel,
  evaluable: boolean,
  previous: RiskStateRow | null,
  confirmations: number,
): { transition: Transition; pendingLevel: RiskLevel | null; pendingCount: number } {
  if (!previous) {
    // Primera vez: se adopta el nivel sin notificar si es verde (no hay "cambio" que contar).
    return evaluated === "verde"
      ? { transition: { kind: "none" }, pendingLevel: null, pendingCount: 0 }
      : {
          transition: { kind: "change", level: evaluated, previous: null, direction: "subida" },
          pendingLevel: null,
          pendingCount: 0,
        };
  }
  // Silencio no es calma: sin componentes evaluables se conserva el nivel anterior.
  if (!evaluable) {
    return {
      transition: { kind: "hold", reason: "sin datos" },
      pendingLevel: null,
      pendingCount: 0,
    };
  }
  if (rank(evaluated) > rank(previous.level)) {
    return {
      transition: {
        kind: "change",
        level: evaluated,
        previous: previous.level,
        direction: "subida",
      },
      pendingLevel: null,
      pendingCount: 0,
    };
  }
  if (evaluated === previous.level) {
    return { transition: { kind: "none" }, pendingLevel: null, pendingCount: 0 };
  }
  // Bajada: hay que confirmarla varias veces seguidas.
  const count = previous.pendingLevel === evaluated ? previous.pendingCount + 1 : 1;
  if (count >= confirmations) {
    return {
      transition: {
        kind: "change",
        level: evaluated,
        previous: previous.level,
        direction: "bajada",
      },
      pendingLevel: null,
      pendingCount: 0,
    };
  }
  return {
    transition: { kind: "hold", reason: "bajada sin confirmar" },
    pendingLevel: evaluated,
    pendingCount: count,
  };
}

export interface RiskCycleOptions {
  now?: Date;
  notifier?: Notifier;
  confirmations?: number;
}

export interface RiskCycleResult {
  recordsWritten: number;
  warning?: string;
  transitions: { stationId: string; level: RiskLevel; direction: "subida" | "bajada" }[];
}

/**
 * Un ciclo completo: evalúa, aplica la histéresis, registra la transición y notifica.
 * Una localización que falle no impide evaluar las demás.
 */
export async function runRiskCycle(db: Db, opts: RiskCycleOptions = {}): Promise<RiskCycleResult> {
  const now = opts.now ?? new Date();
  const notifier = opts.notifier ?? defaultNotifier(db);
  const confirmations = opts.confirmations ?? fallConfirmations();
  const evaluations = await evaluateRisk(db, { now });
  if (evaluations.length === 0) throw new Error("no hay localizaciones que evaluar");

  const problems: string[] = [];
  const transitions: RiskCycleResult["transitions"] = [];

  for (const station of evaluations) {
    try {
      const t = await applyEvaluation(db, station, now, confirmations, notifier);
      if (t) transitions.push(t);
    } catch (err) {
      problems.push(`${station.station.id} (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  if (problems.length === evaluations.length) {
    throw new Error(`ninguna localización pudo evaluarse: ${problems.join("; ")}`);
  }
  return {
    recordsWritten: transitions.length,
    transitions,
    ...(problems.length > 0
      ? {
          warning: `${problems.length}/${evaluations.length} localizaciones con error: ${problems.join("; ")}`,
        }
      : {}),
  };
}

async function applyEvaluation(
  db: Db,
  station: StationRisk,
  now: Date,
  confirmations: number,
  notifier: Notifier,
): Promise<RiskCycleResult["transitions"][number] | undefined> {
  const [prev] = await db.execute<{
    level: RiskLevel;
    since: string | Date;
    pending_level: RiskLevel | null;
    pending_count: number;
  }>(sql`
    select level, since, pending_level, pending_count
    from risk_state where station_id = ${station.station.id}
  `);
  const previous: RiskStateRow | null = prev
    ? {
        level: prev.level,
        since: new Date(prev.since),
        pendingLevel: prev.pending_level,
        pendingCount: Number(prev.pending_count),
      }
    : null;

  const { transition, pendingLevel, pendingCount } = decideTransition(
    station.level,
    station.components.length > 0,
    previous,
    confirmations,
  );
  const level =
    transition.kind === "change" ? transition.level : (previous?.level ?? station.level);
  const since = transition.kind === "change" ? now : (previous?.since ?? now);
  const components = JSON.stringify(station.components);
  const warnings = JSON.stringify(station.warnings);

  await db.execute(sql`
    insert into risk_state (station_id, level, since, evaluated_at, pending_level, pending_since,
                            pending_count, warnings, components)
    values (${station.station.id}, ${level}, ${since.toISOString()}::timestamptz,
            ${now.toISOString()}::timestamptz, ${pendingLevel},
            ${pendingLevel ? now.toISOString() : null}::timestamptz, ${pendingCount},
            ${warnings}::jsonb, ${components}::jsonb)
    on conflict (station_id) do update set
      level = excluded.level, since = excluded.since, evaluated_at = excluded.evaluated_at,
      pending_level = excluded.pending_level, pending_since = excluded.pending_since,
      pending_count = excluded.pending_count, warnings = excluded.warnings,
      components = excluded.components
  `);
  if (transition.kind !== "change") return undefined;

  const [event] = await db.execute<{ id: number }>(sql`
    insert into risk_events (station_id, ts, level, previous_level, direction, components)
    values (${station.station.id}, ${now.toISOString()}::timestamptz, ${transition.level},
            ${transition.previous}, ${transition.direction}, ${components}::jsonb)
    returning id
  `);

  // La notificación va después de registrar el evento y en su propio try/catch: si el canal
  // está caído, el cambio de nivel no se pierde.
  const notification: RiskNotification = {
    stationId: station.station.id,
    stationName: station.station.name,
    level: transition.level,
    previousLevel: transition.previous,
    direction: transition.direction,
    reason: leadingReason(station),
  };
  try {
    await notifier.send(notification);
    await db.execute(sql`update risk_events set notified = true where id = ${event!.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, station: station.station.id }, "riesgo: notificación fallida");
    await db.execute(
      sql`update risk_events set notify_error = ${message.slice(0, 500)} where id = ${event!.id}`,
    );
  }
  // Avisa a quien esté escuchando (el stream SSE de la API) sin que nadie tenga que sondear.
  await db.execute(sql`
    select pg_notify('talaia_risk', ${JSON.stringify({
      stationId: station.station.id,
      station: station.station.name,
      level: transition.level,
      previous: transition.previous,
      direction: transition.direction,
      ts: now.toISOString(),
    })})
  `);
  return {
    stationId: station.station.id,
    level: transition.level,
    direction: transition.direction,
  };
}

/** Canal de Postgres por el que viajan los cambios de nivel. */
export const RISK_CHANNEL = "talaia_risk";

/** El detalle del componente que determina el nivel: el "por qué" del aviso. */
export function leadingReason(station: StationRisk): string | null {
  const leading = station.components.filter((c) => c.level === station.level);
  return leading[0]?.detail ?? station.components[0]?.detail ?? null;
}

/** Canales por defecto del ciclo: ntfy (si hay URL) y Web Push (si hay claves VAPID). */
function defaultNotifier(db: Db): Notifier {
  const vapid = vapidFromEnv();
  return new MultiNotifier([notifierFromEnv(), vapid ? new WebPushNotifier(db, vapid) : undefined]);
}
