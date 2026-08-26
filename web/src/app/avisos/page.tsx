import Link from "next/link";
import { getAlerts, safe } from "@/lib/api";
import { dateTimeMadrid } from "@/lib/format";
import { LevelBadge } from "@/components/LevelBadge";
import type { Level } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avisos oficiales · Talaia" };

const FLOOD = new Set(["PR", "TO", "IN"]);

export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const todos = ver === "todos";
  const alerts = await safe(() => getAlerts(!todos));

  return (
    <>
      <p className="eyebrow">Protección Civil · AEMET</p>
      <h1>Avisos oficiales</h1>
      <p className="subtitle">
        Avisos de AEMET en las zonas de las cuatro localizaciones, lleguen por AEMET OpenData o
        republicados por Meteoalarm. Solo los de lluvias, tormentas e inundación elevan el semáforo;
        el resto se muestran como contexto.
      </p>

      <div className="controls">
        <Link href="/avisos" aria-current={!todos}>
          Vigentes
        </Link>
        <Link href="/avisos?ver=todos" aria-current={todos}>
          Todos (con histórico)
        </Link>
      </div>

      {"error" in alerts ? (
        <p className="error">No se han podido cargar los avisos: {alerts.error}</p>
      ) : alerts.data.length === 0 ? (
        <p className="empty">
          {todos
            ? "No hay ningún aviso registrado en las zonas 774602 ni 774604."
            : "No hay ningún aviso vigente en las zonas 774602 ni 774604. Que no haya aviso no significa que no pueda llover: el semáforo mira además el caudal y la lluvia real."}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Aviso</th>
                <th>Zona</th>
                <th>Vigencia</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((a) => (
                <tr key={a.id} style={a.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    <LevelBadge level={a.level as Level} />
                  </td>
                  <td>
                    {a.event ?? a.event_code ?? "aviso"}
                    {!a.active && <> </>}
                    {!a.active && <small style={{ opacity: 0.8 }}>(caducado)</small>}
                    {!FLOOD.has((a.event_code ?? "").toUpperCase()) && (
                      <>
                        {" "}
                        <small style={{ opacity: 0.7 }}>(no eleva el semáforo)</small>
                      </>
                    )}
                    {a.parameter && (
                      <>
                        <br />
                        <small style={{ opacity: 0.7 }}>{a.parameter}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {a.zone_name ?? a.zone}
                    {a.stations.length > 0 && (
                      <>
                        <br />
                        <small style={{ opacity: 0.7 }}>{a.stations.join(", ")}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {dateTimeMadrid(a.onset)} → {dateTimeMadrid(a.expires)}
                  </td>
                  <td>{a.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
