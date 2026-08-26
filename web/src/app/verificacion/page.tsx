import Link from "next/link";
import { getStations, getVerify, safe } from "@/lib/api";
import { formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Predicción vs. realidad · Talaia" };

const RANGES = [7, 14] as const;

export default async function VerificacionPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string; days?: string }>;
}) {
  const params = await searchParams;
  const stations = await safe(getStations);
  if ("error" in stations) {
    return (
      <>
        <h1>Predicción vs. realidad</h1>
        <p className="error">No se han podido cargar las localizaciones: {stations.error}</p>
      </>
    );
  }
  const station =
    stations.data.find((s) => s.id === params.station) ??
    stations.data.find((s) => s.primary) ??
    stations.data[0]!;
  const days = RANGES.includes(Number(params.days) as (typeof RANGES)[number])
    ? Number(params.days)
    : 7;

  const verify = await safe(() => getVerify(station.id, days));

  return (
    <>
      <p className="eyebrow">Verificación · quién acertó</p>
      <h1>Predicción vs. realidad</h1>
      <p className="subtitle">
        Para cada día, lo que cada modelo predijo <em>la víspera</em> frente a la lluvia que de
        verdad cayó, medida por los pluviómetros del SAIH que vigilan {station.name}. Es la única
        forma de saber de quién fiarse cuando los modelos discrepan.{" "}
        <Link href="/como-funciona">Cómo se calcula →</Link>
      </p>

      <div className="controls">
        {stations.data.map((s) => (
          <Link
            key={s.id}
            href={`/verificacion?station=${encodeURIComponent(s.id)}&days=${days}`}
            aria-current={s.id === station.id}
          >
            {s.name}
          </Link>
        ))}
      </div>
      <div className="controls">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/verificacion?station=${encodeURIComponent(station.id)}&days=${r}`}
            aria-current={r === days}
          >
            {r} días
          </Link>
        ))}
      </div>

      {"error" in verify ? (
        <p className="error">No se ha podido cargar la verificación: {verify.error}</p>
      ) : verify.data.days.length === 0 || verify.data.models.length === 0 ? (
        <p className="empty">
          Todavía no hay suficiente histórico para {station.name}: la verificación necesita días
          completos de predicción y de observación. Los collectors llevan poco tiempo acumulando;
          dales unos días.
        </p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th className="num">Observado</th>
                  {verify.data.models.map((m) => (
                    <th key={m.source} className="num">
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...verify.data.days].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{dayLabel(d.day)}</td>
                    <td className="num col-observed">
                      {d.observed_mm === null ? "—" : `${fmt(d.observed_mm)} mm`}
                    </td>
                    {d.predictions.map((p) => (
                      <td key={p.source} className="num">
                        {p.mm === null ? (
                          "—"
                        ) : (
                          <>
                            {fmt(p.mm)}
                            <Delta predicted={p.mm} observed={d.observed_mm} />
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="legend-inline">
            <span>
              <span className="delta ok">≈</span> acierto (±25 %)
            </span>
            <span>
              <span className="delta under">−</span> se quedó corto (llovió más)
            </span>
            <span>
              <span className="delta over">+</span> se pasó (llovió menos)
            </span>
          </div>
          <p className="foot">
            Predicción "de la víspera": la última corrida de cada modelo emitida antes de empezar el
            día. Observación de referencia: el pluviómetro con más lluvia de{" "}
            {verify.data.gauges.map((g) => titleCase(g.name)).join(", ") || "la red del SAIH"}. Es
            una aproximación con la red oficial de aforos, no una malla de precipitación.
          </p>
        </>
      )}
    </>
  );
}

function Delta({ predicted, observed }: { predicted: number; observed: number | null }) {
  if (observed === null) return null;
  const diff = predicted - observed;
  const tol = Math.max(1, observed * 0.25);
  if (Math.abs(diff) <= tol) return <span className="delta ok">≈</span>;
  const cls = diff < 0 ? "under" : "over";
  const sign = diff < 0 ? "−" : "+";
  return (
    <span className={`delta ${cls}`}>
      {sign}
      {fmt(Math.abs(diff))}
    </span>
  );
}

const fmt = (n: number) => formatValue(n, null);

/** "2026-08-25" → "lun 25/08". */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const wd = new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: "UTC" }).format(date);
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function titleCase(name: string): string {
  const minor = new Set(["de", "del", "la", "el", "los", "las", "y", "en"]);
  return name
    .toLocaleLowerCase("es")
    .split(" ")
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toLocaleUpperCase("es") + w.slice(1)))
    .join(" ");
}
