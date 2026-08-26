import Link from "next/link";
import { notFound } from "next/navigation";
import { getObservations, getRisk, getSensors, safe, type ObservationSeries } from "@/lib/api";
import { ago, formatValue, KIND_LABEL, label, timeMadrid, VARIABLE_LABEL } from "@/lib/format";
import { LevelBadge } from "@/components/LevelBadge";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const risk = await safe(getRisk);
  const name =
    "error" in risk ? id : (risk.data.find((r) => r.station.id === id)?.station.name ?? id);
  return { title: `${name} · Talaia` };
}

/** Sensores que se dibujan con serie, en orden de importancia para seguir una crecida. */
const SERIES_ORDER = [
  "river_flow_m3s",
  "river_level_m",
  "precip_mm",
  "reservoir_hm3",
  "reservoir_level_m",
];
const WITH_SERIES = new Set(SERIES_ORDER);
const RANGES = [24, 168] as const;

export default async function LocalidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rango?: string }>;
}) {
  // Los ids llevan ":" (`virtual:albal`), y Next entrega el parámetro tal como viaja en la URL.
  const { id } = await params;
  const { rango } = await searchParams;
  const stationId = decodeURIComponent(id);
  const hours = rango === "7d" ? 168 : 24;
  const [risk, sensors] = await Promise.all([safe(getRisk), safe(getSensors)]);
  if ("error" in risk) {
    return (
      <>
        <h1>Localidad</h1>
        <p className="error">No se ha podido cargar el semáforo: {risk.error}</p>
      </>
    );
  }
  const station = risk.data.find((r) => r.station.id === stationId);
  if (!station) notFound();

  // Sensores que vigilan esta localidad: los que el semáforo ha usado como componentes.
  const usados = new Set(station.components.map((c) => c.source).filter(Boolean) as string[]);
  const propios = "error" in sensors ? [] : sensors.data.filter((s) => usados.has(s.id));
  const conSerie = propios
    .filter((s) => WITH_SERIES.has(s.variable))
    .sort((a, b) => SERIES_ORDER.indexOf(a.variable) - SERIES_ORDER.indexOf(b.variable))
    .slice(0, 5);
  const series = await Promise.all(
    conSerie.map(async (s) => [s.id, await safe(() => getObservations(s.id, hours))] as const),
  );

  const rangeLabel = hours === 168 ? "7 días" : "24 horas";

  return (
    <>
      <p className="subtitle" style={{ marginBottom: "0.5rem" }}>
        <Link href="/">← Volver al semáforo</Link>
      </p>
      <h1>
        {station.station.name} <LevelBadge level={station.level} />
      </h1>
      <p className="subtitle">
        Calculado a las {timeMadrid(station.computed_at)}. {station.components.length} señales
        evaluadas, {station.alerts.length} avisos vigentes en su zona.{" "}
        <Link href={`/verificacion?station=${encodeURIComponent(stationId)}`}>
          ¿Aciertan los modelos aquí? →
        </Link>
      </p>

      <section className="block">
        <h1>Por qué está en este nivel</h1>
        {station.components.length === 0 ? (
          <p className="empty">Sin datos evaluables: el verde no significa que no haya riesgo.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Señal</th>
                  <th>Nivel</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {station.components.map((c, i) => (
                  <tr key={`${c.kind}-${c.source ?? i}`}>
                    <td>{label(KIND_LABEL, c.kind)}</td>
                    <td>
                      <LevelBadge level={c.level} />
                    </td>
                    <td>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {station.warnings.length > 0 && (
          <div className="warnings">
            <strong>Frescura de los datos</strong>
            <ul>
              {station.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {conSerie.length > 0 && (
        <section className="block">
          <h1>Últimas {rangeLabel}</h1>
          <div className="controls">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/l/${encodeURIComponent(stationId)}${r === 168 ? "?rango=7d" : ""}`}
                aria-current={r === hours}
              >
                {r === 168 ? "7 días" : "24 horas"}
              </Link>
            ))}
          </div>
          <p className="subtitle">
            Las líneas discontinuas son los umbrales oficiales: amarillo, naranja y rojo.
          </p>
          {series.map(([sensorId, res]) => {
            const sensor = conSerie.find((s) => s.id === sensorId)!;
            return (
              <div key={sensorId} style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "1rem", margin: "0 0 0.4rem" }}>
                  {sensor.station.name} · {label(VARIABLE_LABEL, sensor.variable)}{" "}
                  <small style={{ fontWeight: 400, opacity: 0.7 }}>
                    {formatValue(sensor.last_value, sensor.unit)} · {ago(sensor.age_seconds)}
                  </small>
                </h2>
                {"error" in res ? (
                  <p className="empty">No se ha podido cargar la serie: {res.error}</p>
                ) : (
                  <Sparkline series={res.data as ObservationSeries} />
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="block">
        <h1>Sensores vigilados</h1>
        {propios.length === 0 ? (
          <p className="empty">No hay sensores con datos para esta localización ahora mismo.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Estación</th>
                  <th>Variable</th>
                  <th className="num">Último valor</th>
                  <th>Nivel</th>
                  <th>Frescura</th>
                </tr>
              </thead>
              <tbody>
                {propios.map((s) => (
                  <tr key={s.id}>
                    <td>{s.station.name}</td>
                    <td>{label(VARIABLE_LABEL, s.variable)}</td>
                    <td className="num">{formatValue(s.last_value, s.unit)}</td>
                    <td>{s.level ? <LevelBadge level={s.level} /> : "—"}</td>
                    <td>{ago(s.age_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
