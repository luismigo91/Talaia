import type { ForecastRuns } from "@/lib/api";
import { dateTimeMadrid, formatValue } from "@/lib/format";

/**
 * Qué decía cada modelo, corrida a corrida, para la misma ventana futura.
 *
 * La comparativa enseña la última emisión de cada modelo; esto enseña cómo ha ido cambiando.
 * Una mediana que sube emisión tras emisión es un episodio que crece, y esa señal es más
 * fiable que el valor de una sola corrida. Se presenta como tabla y no como gráfico porque
 * son pocos puntos por fila y en el móvil se lee mejor.
 */
export function ForecastRunsTable({ runs }: { runs: ForecastRuns }) {
  const conCorridas = runs.series.filter((s) => s.runs.length > 0);
  if (conCorridas.length === 0) {
    return <p className="empty">Sin corridas guardadas para esta ventana.</p>;
  }
  // La fila de la mediana va de la corrida más antigua a la más reciente.
  const medians = [...runs.medians].sort((a, b) => b.age_hours - a.age_hours);
  const last = medians.at(-1);
  const first = medians[0];
  const delta = last && first && medians.length >= 2 ? last.median - first.median : null;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Corridas (de la más antigua a la última)</th>
            <th className="num">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {conCorridas.map((s) => (
            <tr key={s.source}>
              <td>{s.name}</td>
              <td>
                <span className="runs">
                  {s.runs.map((r, i) => (
                    <span key={r.forecast_ts}>
                      {i > 0 && <span className="run-sep"> → </span>}
                      <span
                        className="run"
                        title={`Emitida ${dateTimeMadrid(r.forecast_ts)}${
                          r.hours_covered < runs.horizon_hours
                            ? ` · solo cubre ${r.hours_covered} de ${runs.horizon_hours} h`
                            : ""
                        }`}
                      >
                        {formatValue(r.total, null)}
                        {r.hours_covered < runs.horizon_hours ? "*" : ""}
                      </span>
                    </span>
                  ))}{" "}
                  mm
                </span>
              </td>
              <td className="num">
                <span className={`delta ${deltaClass(s.delta)}`}>{deltaText(s.delta)}</span>
              </td>
            </tr>
          ))}
          {medians.length > 0 && (
            <tr className="median-row">
              <td>
                <strong>Mediana</strong>
              </td>
              <td>
                <span className="runs">
                  {medians.map((m, i) => (
                    <span key={m.age_hours}>
                      {i > 0 && <span className="run-sep"> → </span>}
                      <span
                        className="run"
                        title={`Corridas de hace ${m.age_hours}–${m.age_hours + 6} h · ${m.sources} fuentes`}
                      >
                        {formatValue(m.median, null)}
                      </span>
                    </span>
                  ))}{" "}
                  mm
                </span>
              </td>
              <td className="num">
                <strong className={`delta ${deltaClass(delta)}`}>{deltaText(delta)}</strong>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="subtitle" style={{ marginTop: "0.5rem" }}>
        Lluvia prevista para las próximas {runs.horizon_hours} h según cada emisión de las últimas{" "}
        {runs.lookback_hours} h. El asterisco marca corridas que no cubren la ventana entera.
      </p>
    </div>
  );
}

function deltaText(d: number | null): string {
  if (d === null) return "—";
  if (Math.abs(d) < 0.05) return "= 0";
  return `${d > 0 ? "+" : "−"}${formatValue(Math.abs(d), "mm")}`;
}

function deltaClass(d: number | null): string {
  if (d === null || Math.abs(d) < 2) return "flat";
  return d > 0 ? "up" : "down";
}
