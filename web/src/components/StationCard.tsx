import Link from "next/link";
import type { StationRisk } from "@/lib/api";
import { KIND_LABEL, label, timeMadrid } from "@/lib/format";
import { LevelBadge } from "./LevelBadge";

/** Una localización: su nivel, por qué, y lo que no se sabe. */
export function StationCard({ risk }: { risk: StationRisk }) {
  const sinDatos = risk.components.length === 0;
  return (
    <article className="card">
      <header>
        <h2>
          <Link href={`/l/${encodeURIComponent(risk.station.id)}`}>{risk.station.name}</Link>
        </h2>
        <LevelBadge level={risk.level} />
      </header>
      <div className="body">
        {sinDatos ? (
          <p className="empty">
            Sin datos evaluables ahora mismo: este verde no significa que no haya riesgo.
          </p>
        ) : (
          <ul className="components">
            {risk.components.map((c, i) => (
              <li key={`${c.kind}-${c.source ?? i}`}>
                <span className="kind">{label(KIND_LABEL, c.kind)}</span>
                <span>
                  <LevelBadge level={c.level} /> {c.detail}
                </span>
              </li>
            ))}
          </ul>
        )}

        {risk.warnings.length > 0 && (
          <div className="warnings">
            <strong>Atención a la frescura de los datos</strong>
            <ul>
              {risk.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {risk.alerts.length > 0 && (
          <p className="empty">
            Avisos vigentes en la zona:{" "}
            {risk.alerts
              .map((a) => `${a.event ?? a.event_code ?? "aviso"} (${a.level})`)
              .join(" · ")}
          </p>
        )}

        <p className="empty">Calculado a las {timeMadrid(risk.computed_at)}</p>
      </div>
    </article>
  );
}
