import Link from "next/link";
import { LevelBadge } from "@/components/LevelBadge";

export const metadata = { title: "Cómo funciona · Talaia" };

export default function ComoFuncionaPage() {
  return (
    <>
      <p className="eyebrow">Método · transparencia</p>
      <h1>Cómo se calcula el semáforo</h1>
      <p className="subtitle">
        Talaia no inventa un índice propio: combina señales oficiales con reglas explícitas y las
        calcula en el servidor, para que la pantalla y las notificaciones vean siempre lo mismo.
        Aquí está todo lo que hace por dentro, incluidas sus limitaciones.
      </p>

      <section className="block">
        <h1>Lo peor manda</h1>
        <p>
          Cada localización tiene cuatro señales independientes. El nivel es el{" "}
          <strong>máximo</strong> de las cuatro, nunca su media: un caudal en{" "}
          <LevelBadge level="rojo" /> no se compensa con que no haya aviso. Si una señal falta o
          está vieja, no baja el nivel de las demás; se avisa de la falta de frescura aparte.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Señal</th>
                <th>De dónde sale</th>
                <th>Umbrales</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Caudal y embalses</td>
                <td>Aforos y embalses del SAIH Júcar (CHJ), cada 5–30 min</td>
                <td>Los oficiales de la CHJ (p. ej. el Poyo: 30 / 70 / 150 m³/s)</td>
              </tr>
              <tr>
                <td>Lluvia observada</td>
                <td>Pluviómetros del SAIH; l&apos;Horteta, por estaciones AVAMET cercanas</td>
                <td>Acumulados del Plan Meteoalerta de AEMET; se toma el peor pluviómetro</td>
              </tr>
              <tr>
                <td>Lluvia prevista</td>
                <td>Hasta 6 modelos vía Open-Meteo (AROME, ICON, ECMWF, GFS…)</td>
                <td>
                  Meteoalerta, sobre la <strong>mediana</strong> de los modelos, no el más alarmista
                </td>
              </tr>
              <tr>
                <td>Avisos oficiales</td>
                <td>AEMET OpenData y Meteoalarm, por zona</td>
                <td>Solo lluvia, tormentas e inundación (PR/TO/IN) elevan el nivel</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="block">
        <h1>Sube al momento, baja con calma</h1>
        <p>
          Las subidas de nivel se aplican en cuanto se detectan: ante la duda, antes. Las bajadas
          esperan a que varias evaluaciones seguidas confirmen la mejora, para no dar un{" "}
          <LevelBadge level="verde" /> en falso entre dos picos. Solo el cambio de color se registra
          y se notifica; el resto del tiempo el semáforo se limita a vigilar.
        </p>
      </section>

      <section className="block">
        <h1>Lo que Talaia no es (límites honestos)</h1>
        <ul className="prose-list">
          <li>
            <strong>No sustituye al 112.</strong> Es un proyecto personal. En una emergencia, la
            referencia son Protección Civil y AEMET.
          </li>
          <li>
            <strong>El sensor del Poyo es provisional.</strong> Su histórico trae picos físicamente
            imposibles (de 0 a 800 m³/s en cinco minutos) que la propia CHJ da por buenos; Talaia
            los pone en cuarentena con un filtro de plausibilidad, pero conviene saberlo.
          </li>
          <li>
            <strong>AVAMET es red amateur.</strong> Es la única señal del barranc de l&apos;Horteta,
            valiosa pero sin el control de calidad de un aforo oficial.
          </li>
          <li>
            <strong>El SAIH no guarda la DANA.</strong> Su histórico público no cubre el 29‑10‑2024,
            así que los umbrales se calibran con la crecida conocida, no con ese episodio.
          </li>
          <li>
            <strong>AEMET tiene cuota.</strong> Sin clave configurada, la predicción y la
            observación de AEMET se marcan como error y el resto sigue funcionando.
          </li>
        </ul>
        <p className="subtitle" style={{ marginTop: "1rem" }}>
          ¿Quieres ver si los modelos aciertan? En <Link href="/verificacion">Verificación</Link> se
          contrasta, día a día, lo que predijeron con lo que de verdad cayó.
        </p>
      </section>

      <p className="foot">
        Fuentes: SAIH Júcar (CHJ), AEMET OpenData, Meteoalarm, Open-Meteo y AVAMET. Umbrales de
        caudal de la CHJ; umbrales de lluvia del Plan Meteoalerta de AEMET.
      </p>
    </>
  );
}
