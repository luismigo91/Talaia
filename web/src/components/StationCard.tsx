import Link from "next/link";
import type { RiskComponent, StationRisk } from "@/lib/api";
import { KIND_LABEL, label, rank, timeMadrid } from "@/lib/format";
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
 * Vista de un vistazo: el nivel, lo que manda y lo que preocupa. El desglose completo de las
 * señales vive en la página de detalle; aquí solo el titular, para poder comparar las cuatro
 * localizaciones de golpe.
 */
export function StationCard({ risk }: { risk: StationRisk }) {
  const lead = leading(risk);
  // Lo que hay que mirar: las señales por encima de verde (las que no son el titular).
  const drivers = risk.components.filter(
    (c) => c.level !== "verde" && c !== lead && rank(c.level) >= rank("amarillo"),
  );
  const avisos = risk.alerts.filter((a) => a.counts);

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

        {drivers.length > 0 && (
          <ul className="drivers">
            {drivers.map((c, i) => (
              <li key={`${c.kind}-${c.source ?? i}`}>
                <LevelBadge level={c.level} />{" "}
                <span className="kind-inline">{label(KIND_LABEL, c.kind)}</span> {c.detail}
              </li>
            ))}
          </ul>
        )}

        {risk.warnings.length > 0 && (
          <p className="hint">
            ⚠ {risk.warnings.length}{" "}
            {risk.warnings.length === 1 ? "dato sin actualizar" : "datos sin actualizar"}
          </p>
        )}

        {avisos.length > 0 && (
          <p className="hint">
            Aviso oficial: {avisos.map((a) => a.event ?? a.event_code ?? "aviso").join(" · ")}
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
