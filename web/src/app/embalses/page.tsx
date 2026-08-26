import { getSensors, safe, type Sensor } from "@/lib/api";
import { ago, formatValue } from "@/lib/format";
import { LevelBadge } from "@/components/LevelBadge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Embalses · Talaia" };

const RESERVOIR_VARS = new Set(["reservoir_hm3", "reservoir_level_m", "reservoir_pct"]);

type Embalse = {
  id: string;
  name: string;
  volume: Sensor | null;
  cota: Sensor | null;
  pct: Sensor | null;
  age: number | null;
};

export default async function EmbalsesPage() {
  const sensors = await safe(getSensors);

  if ("error" in sensors) {
    return (
      <>
        <h1>Embalses</h1>
        <p className="error">No se han podido cargar los embalses: {sensors.error}</p>
      </>
    );
  }

  const byStation = new Map<string, Embalse>();
  for (const s of sensors.data.filter((x) => RESERVOIR_VARS.has(x.variable))) {
    const e =
      byStation.get(s.station.id) ??
      ({
        id: s.station.id,
        name: s.station.name,
        volume: null,
        cota: null,
        pct: null,
        age: null,
      } as Embalse);
    if (s.variable === "reservoir_hm3") e.volume = s;
    if (s.variable === "reservoir_level_m") e.cota = s;
    if (s.variable === "reservoir_pct") e.pct = s;
    if (s.age_seconds !== null)
      e.age = e.age === null ? s.age_seconds : Math.min(e.age, s.age_seconds);
    byStation.set(s.station.id, e);
  }
  const embalses = [...byStation.values()].sort(
    (a, b) => (b.volume?.last_value ?? 0) - (a.volume?.last_value ?? 0),
  );

  return (
    <>
      <p className="eyebrow">SAIH Júcar · CHJ</p>
      <h1>Embalses vigilados</h1>
      <p className="subtitle">
        Cuánta agua guarda cada embalse aguas arriba de las localizaciones. Un embalse lleno tiene
        poco margen para laminar una crecida: Tous protege el Xúquer y el Mareny; Loriguilla y
        Benagéber, el Túria y Benaguasil; Forata y Buseo, la cuenca del Poyo y el Magro.
      </p>

      {embalses.length === 0 ? (
        <p className="empty">No hay datos de embalses ahora mismo.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Embalse</th>
                <th className="num">Volumen</th>
                <th className="num">Cota</th>
                <th>Ocupación</th>
                <th>Frescura</th>
              </tr>
            </thead>
            <tbody>
              {embalses.map((e) => {
                const pct = e.pct?.last_value ?? null;
                return (
                  <tr key={e.id}>
                    <td>
                      {titleCase(e.name)}{" "}
                      {e.volume?.level ? <LevelBadge level={e.volume.level} /> : null}
                    </td>
                    <td className="num">{formatValue(e.volume?.last_value ?? null, "hm³")}</td>
                    <td className="num">{formatValue(e.cota?.last_value ?? null, "m")}</td>
                    <td>
                      {pct === null ? (
                        "—"
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="meter" aria-hidden>
                            <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                          </span>
                          <span className="reading">{formatValue(pct, "%")}</span>
                        </span>
                      )}
                    </td>
                    <td>{ago(e.age)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="foot">
        Fuente: SAIH Júcar (CHJ). Los embalses publican cada 30 min aproximadamente; la ocupación
        solo se muestra cuando la CHJ la ofrece directamente.
      </p>
    </>
  );
}

/** "EMBALSE DE TOUS" → "Embalse de Tous". Los nombres del SAIH vienen en mayúsculas. */
function titleCase(name: string): string {
  const minor = new Set(["de", "del", "la", "el", "los", "las", "y"]);
  return name
    .toLocaleLowerCase("es")
    .split(" ")
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toLocaleUpperCase("es") + w.slice(1)))
    .join(" ");
}
