import { getHistory, getRisk, safe } from "@/lib/api";
import { byRisk, dateTimeMadrid } from "@/lib/format";
import { LevelBadge } from "@/components/LevelBadge";
import { StationCard } from "@/components/StationCard";
import { LiveRefresh } from "@/components/LiveRefresh";

// Renderizado en cada petición, pero con los datos cacheados 60 s en `fetch`: así el build
// no depende de que la API esté levantada y aun así no se la machaca.
export const dynamic = "force-dynamic";
export const metadata = { title: "Semáforo de riesgo · Talaia" };

export default async function Page() {
  const [risk, history] = await Promise.all([safe(getRisk), safe(() => getHistory(12))]);

  return (
    <>
      <p className="eyebrow">Atalaya · l&apos;Horta Sud i la Ribera</p>
      <h1>Semáforo de riesgo</h1>
      <p className="subtitle">
        Nivel por localización, calculado en servidor a partir del caudal de los barrancos, la
        lluvia observada y prevista, y los avisos oficiales vigentes. Lo peor manda: el nivel es el
        máximo de las cuatro señales, nunca su media.
      </p>

      <LiveRefresh />

      {"error" in risk ? (
        <p className="error">No se ha podido leer el semáforo: {risk.error}</p>
      ) : (
        <div className="cards">
          {[...risk.data].sort(byRisk).map((r) => (
            <StationCard key={r.station.id} risk={r} />
          ))}
        </div>
      )}

      <section className="block">
        <h1>Últimos cambios de nivel</h1>
        <p className="subtitle">
          Solo se registra —y se notifica— el cambio de color. Las subidas se aplican al momento;
          las bajadas, tras confirmarse varias evaluaciones seguidas.
        </p>
        {"error" in history ? (
          <p className="error">No se ha podido leer el histórico: {history.error}</p>
        ) : history.data.length === 0 ? (
          <p className="empty">Todavía no se ha registrado ningún cambio de nivel.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Localidad</th>
                  <th>Cambio</th>
                  <th>Aviso</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((e) => (
                  <tr key={e.id}>
                    <td>{dateTimeMadrid(e.ts)}</td>
                    <td>{e.station.name}</td>
                    <td>
                      {e.previous_level ? (
                        <>
                          <LevelBadge level={e.previous_level} /> →{" "}
                        </>
                      ) : null}
                      <LevelBadge level={e.level} />
                    </td>
                    <td>{e.notified ? "enviado" : "no enviado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="foot">
        Fuentes: SAIH Júcar (CHJ), AEMET OpenData, Meteoalarm, Open-Meteo y{" "}
        <a href="https://www.avamet.org" rel="noreferrer noopener">
          AVAMET
        </a>{" "}
        (estaciones amateur,{" "}
        <a
          href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.ca"
          rel="license noreferrer"
        >
          CC BY-NC-ND 4.0
        </a>
        ). Los umbrales de caudal son los oficiales de la CHJ y los de lluvia, los del Plan
        Meteoalerta de AEMET. Esto es un proyecto personal: en una emergencia, la referencia es el
        112 y Protección Civil.
      </p>
    </>
  );
}
