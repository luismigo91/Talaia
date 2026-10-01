import Link from "next/link";
import type { RiskComponent, StationRisk } from "@/lib/api";
import { dateTimeMadrid, timeMadrid } from "@/lib/format";
import { LevelBadge } from "./LevelBadge";

/** El componente que determina el nivel (o, en calma, el caudal principal). */
function leading(risk: StationRisk): RiskComponent | undefined {
  const atLevel = risk.components.filter((c) => c.level === risk.level);
  return (
    atLevel.find((c) => c.kind === "flow") ??
    atLevel[0] ??
    risk.components.find((c) => c.kind === "flow") ??
    risk.components[0]
  );
}

/**
 * Vista de un vistazo: el nivel y lo que lo manda, nada más. Si el máximo es rojo,
 * se ve rojo con su motivo; el desglose completo de señales vive en la página de
 * detalle, para poder comparar las cuatro localizaciones de golpe sin ruido.
 */
export function StationCard({ risk }: { risk: StationRisk }) {
  const lead = leading(risk);

  return (
    <article className="card">
      <header>
        <h2>
          <Link href={`/l/${encodeURIComponent(risk.station.id)}`}>{risk.station.name}</Link>
        </h2>
        <LevelBadge level={risk.level} />
      </header>
      <div className="body">
        {!lead ? (
          <p className="empty">
            Sin datos evaluables ahora mismo: este verde no significa que no haya riesgo.
          </p>
        ) : (
          <p className="lead">
            <LevelBadge level={lead.level} /> {lead.detail}
          </p>
        )}

        {risk.warnings.length > 0 && (
          <p className="hint">
            ⚠ {risk.warnings.length}{" "}
            {risk.warnings.length === 1 ? "dato sin actualizar" : "datos sin actualizar"}
          </p>
        )}

        {risk.next_change && (
          <p className="hint">
            Próximo: {risk.next_change.direction} a <LevelBadge level={risk.next_change.level} /> ·{" "}
            {dateTimeMadrid(risk.next_change.at)}
          </p>
        )}

        <p className="card-foot">
          <Link href={`/l/${encodeURIComponent(risk.station.id)}`}>
            {risk.components.length} señales · ver desglose →
          </Link>
          <span className="when">{timeMadrid(risk.computed_at)}</span>
        </p>
      </div>
    </article>
  );
}
