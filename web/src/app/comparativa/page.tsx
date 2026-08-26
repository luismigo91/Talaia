import Link from "next/link";
import { getCompare, getStations, safe } from "@/lib/api";
import { dateTimeMadrid, formatValue, label, VARIABLE_LABEL } from "@/lib/format";
import { CompareChart } from "@/components/CompareChart";

// Renderizado en cada petición, pero con los datos cacheados 60 s en `fetch`: así el build
// no depende de que la API esté levantada y aun así no se la machaca.
export const dynamic = "force-dynamic";
export const metadata = { title: "Comparativa entre modelos · Talaia" };

const VARIABLES = ["precip_mm", "precip_prob_pct", "temp_c", "wind_ms", "gust_ms"] as const;

export default async function ComparativaPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string; variable?: string }>;
}) {
  const params = await searchParams;
  const stations = await safe(getStations);
  if ("error" in stations) {
    return (
      <>
        <h1>Comparativa entre modelos</h1>
        <p className="error">No se han podido cargar las localizaciones: {stations.error}</p>
      </>
    );
  }
  const station =
    stations.data.find((s) => s.id === params.station) ??
    stations.data.find((s) => s.primary) ??
    stations.data[0]!;
  const variable = (VARIABLES as readonly string[]).includes(params.variable ?? "")
    ? params.variable!
    : "precip_mm";

  const compare = await safe(() => getCompare(station.id, variable));
  const acumulada = variable === "precip_mm";

  return (
    <>
      <p className="eyebrow">Predicción · 6 modelos</p>
      <h1>Comparativa entre modelos</h1>
      <p className="subtitle">
        Qué dice cada fuente para las próximas 24 horas en {station.name}. Cada una con su última
        emisión: cuando discrepan, esa discrepancia <em>es</em> la información.
      </p>

      <div className="controls">
        {stations.data.map((s) => (
          <Link
            key={s.id}
            href={`/comparativa?station=${encodeURIComponent(s.id)}&variable=${variable}`}
            aria-current={s.id === station.id}
          >
            {s.name}
          </Link>
        ))}
      </div>
      <div className="controls">
        {VARIABLES.map((v) => (
          <Link
            key={v}
            href={`/comparativa?station=${encodeURIComponent(station.id)}&variable=${v}`}
            aria-current={v === variable}
          >
            {label(VARIABLE_LABEL, v)}
          </Link>
        ))}
      </div>

      {"error" in compare ? (
        <p className="error">No se ha podido cargar la comparativa: {compare.error}</p>
      ) : compare.data.series.length === 0 ? (
        <p className="empty">
          Ninguna fuente tiene datos de {label(VARIABLE_LABEL, variable).toLowerCase()} para{" "}
          {station.name} en esta ventana. Si los collectors acaban de arrancar, dales unos minutos.
        </p>
      ) : (
        <>
          <CompareChart data={compare.data} />
          <div className="table-scroll">
            <table style={{ marginTop: "1.25rem" }}>
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th className="num">{acumulada ? "Total 24 h" : "Máximo"}</th>
                  <th className="num">Máximo horario</th>
                  <th>Emitido</th>
                </tr>
              </thead>
              <tbody>
                {compare.data.series.map((s) => (
                  <tr key={s.source}>
                    <td>{s.name}</td>
                    <td className="num">
                      {formatValue(s.total ?? s.max_hourly, compare.data.unit)}
                    </td>
                    <td className="num">{formatValue(s.max_hourly, compare.data.unit)}</td>
                    <td>{dateTimeMadrid(s.forecast_ts)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <strong>{compare.data.summary.sources} fuentes</strong>
                  </td>
                  <td className="num" colSpan={3}>
                    mínimo {formatValue(compare.data.summary.min_total, compare.data.unit)} ·
                    mediana {formatValue(compare.data.summary.median_total, compare.data.unit)} ·
                    máximo {formatValue(compare.data.summary.max_total, compare.data.unit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}
