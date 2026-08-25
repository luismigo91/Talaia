import { getRisk, getSensors, safe } from "@/lib/api";
import { RiskMap } from "@/components/RiskMap";

// Renderizado en cada petición, pero con los datos cacheados 60 s en `fetch`: así el build
// no depende de que la API esté levantada y aun así no se la machaca.
export const dynamic = "force-dynamic";
export const metadata = { title: "Mapa de sensores · Talaia" };

export default async function MapaPage() {
  const [risk, sensors] = await Promise.all([safe(getRisk), safe(getSensors)]);
  if ("error" in risk || "error" in sensors) {
    const error = "error" in risk ? risk.error : (sensors as { error: string }).error;
    return (
      <>
        <h1>Mapa</h1>
        <p className="error">No se han podido cargar los datos del mapa: {error}</p>
      </>
    );
  }

  const conDatos = sensors.data.filter((s) => s.last_value !== null).length;
  return (
    <>
      <h1>Mapa</h1>
      <p className="subtitle">
        Las cuatro localizaciones objetivo (círculos grandes) y los {sensors.data.length} sensores
        del catálogo, {conDatos} de ellos con dato reciente. Pulsa cualquiera para ver su último
        valor.
      </p>
      <RiskMap risks={risk.data} sensors={sensors.data} />
      <p className="legend">
        <span>
          <span className="dot" style={{ color: "#2f8f4e" }} /> verde
        </span>
        <span>
          <span className="dot" style={{ color: "#c9a227" }} /> amarillo
        </span>
        <span>
          <span className="dot" style={{ color: "#d1741f" }} /> naranja
        </span>
        <span>
          <span className="dot" style={{ color: "#c0392b" }} /> rojo
        </span>
        <span>
          <span className="dot" style={{ color: "#8b98a5" }} /> sin datos o sin umbrales
        </span>
      </p>
    </>
  );
}
