# Propuesta: anticipación hidrológica con los datos propios (fase 13)

**Estado**: implementada, pendiente de archivar (11‑09‑2026) · **Fecha**: 2026‑09‑11

## Por qué

El semáforo describe lo que **está pasando**: el caudal en Riba‑roja, la lluvia que ya ha caído, la corrida vigente de cada modelo. En una crecida del Poyo eso llega tarde: el aforo de Riba‑roja avisa cuando el agua ya está a media hora de Albal. Sin embargo, la base ya guarda dos cosas que permiten mirar hacia delante sin añadir ninguna fuente:

1. **Lluvia cincominutal en la cabecera** (Chiva, Siete Aguas, Turís) y caudal en el único aforo de la cuenca. La relación entre una y otro, medida sobre el histórico descargado, dice qué caudal cabe esperar y **cuándo**.
2. **Cada emisión de cada modelo con su `forecast_ts`**. Sabemos qué preveían los mismos modelos hace 6, 12 y 24 horas para estas mismas horas. Una mediana que sube corrida a corrida es un episodio que crece; una sola corrida no lo dice.

## Qué cambia

1. **Caudal anticipado** (`flow_projected`): nueva señal del semáforo. Para cada localización con un modelo lluvia‑caudal calibrado, la lluvia observada en cabecera en las últimas horas se traduce en el caudal esperado en el aforo y en cuánto tarda en llegar. Se evalúa contra los umbrales oficiales de la CHJ del propio aforo.
2. **Modelos lluvia‑caudal en tabla** (`runoff_models`): aforo, pluviómetros de cabecera, ventana de acumulación, retardo, coeficientes y su procedencia (episodios usados, ajuste). Cambiar un modelo es una fila, no un despliegue; sin fila, la señal no existe y no se inventa nada.
3. **Calibración lluvia‑caudal** (`pnpm --filter @talaia/scheduler calibrate-runoff`): a partir del histórico, estima el retardo por correlación cruzada, ajusta la relación sobre los episodios reales y **propone**; con `--apply` escribe la fila. Como el informe de umbrales, decide una persona.
4. **Tendencia entre corridas** en la lluvia prevista: el componente `rain_forecast` compara su mediana con la de las corridas anteriores (misma ventana, mismos modelos) y lo dice en el detalle. No cambia el nivel.
5. **`GET /api/v1/forecast-runs`**: qué preveía cada modelo, corrida a corrida, para las próximas 12 o 24 h, con la mediana por tramo de antigüedad.
6. **Detalle por localidad**: tabla de corridas con el cambio por modelo y de la mediana, y flecha de tendencia en la señal de lluvia prevista.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Forma del modelo | **Ley de potencia** `Q = a·P^b` sobre la lluvia media de cabecera acumulada en `window_hours`, ajustada en log‑log sobre los episodios con lluvia apreciable. Es la relación más simple que respeta que el caudal crece más que proporcionalmente con la lluvia (suelo saturado) y se explica en una frase |
| 2 | Retardo | Estimado por **correlación cruzada** entre la lluvia horaria de cabecera y el caudal horario máximo, entre 0 y 6 h; se contrasta con los `lag_minutes` que ya sembraba `watch_points` (120–150 min para el Poyo) |
| 3 | Techo del nivel | La proyección **no puede dar rojo por sí sola**: como máximo `naranja`. Un rojo exige agua medida. Es una estimación con pocos episodios y el proyecto ya ha pagado el precio de las falsas alarmas |
| 4 | Cuándo se emite | Solo si ha llovido algo apreciable en la ventana (≥ 1 mm de media en cabecera). Sin lluvia no hay nada que proyectar y el desglose no se llena de ceros |
| 5 | Sin modelo calibrado | **No hay componente**. Ni Mareny (Xúquer regulado por Tous: la lluvia local no se traduce en caudal) ni cuencas donde el ajuste no alcance un mínimo de episodios |
| 6 | Qué se guarda | La proyección viaja en `components` (y por tanto en `risk_state`/`risk_events`) con `horizon_minutes`; no se crea una serie nueva de "caudal previsto" |
| 7 | Tendencia y nivel | La tendencia **informa, no decide**. Elevar el nivel porque "sube" penalizaría a los modelos por corregirse; la mediana vigente ya recoge el valor |
| 8 | Separación entre corridas | La "anterior" es la última emisión al menos `RISK_TREND_GAP_HOURS` (5) antes que la vigente: emisiones seguidas apenas difieren y la tendencia se lee frente a hace media jornada |
| 9 | Apreciable | `|Δ| ≥ max(2 mm, 20 %)`. Bailar entre 0,4 y 0,6 mm no es tendencia |
| 10 | Fuentes comparables | Solo se comparan modelos que tienen ambas corridas, para que la diferencia no venga de que un modelo haya entrado o salido |

## Lo que dice el histórico (Poyo en Riba‑roja, 2025‑01 → 2026‑09)

Backfill completo de esta sesión: 2.007.181 filas en 252 ventanas sin fallos (caudal del Poyo, la Castellana y la Primera; pluviómetros de Chiva, Siete Aguas, Turís, Riba‑roja, Picassent, Casinos, Bugarra, Marines y Pedralba). `calibrate-runoff virtual:albal`:

```
histórico: 171.819 muestras de caudal (2025-01-01 → 2026-09-11)
muestras de caudal descartadas por implausibles: 86
ventana 3 h: 153 horas con ≥ 5 mm de media en cabecera · 28 con respuesta (≥ 0,5 m³/s)
ventana 6 h: 321 horas · 41 con respuesta · retardo 120 min (r 0,40)
ajuste Q = a·P^b: a 0,2372 · b 0,437 · r² 0,608 · n 41 · caudal máximo con respuesta 1,9 m³/s
episodios mayores:  28-12-2025 33,1 mm → pico 1,9 m³/s · 05-03-2026 24,4 mm → 0,1 · 28-09-2025 23,9 mm → 0,3
                    04-03-2025 22,9 mm → 0,5 · 17-05-2026 21,9 mm → 0,0
veredicto: el aforo solo ha respondido con caudales de hasta 1,9 m³/s, lejos del primer umbral (30)
```

**El Poyo no ha corrido en todo el periodo que publica el SAIH.** Con 97 mm en Siete Aguas el 05‑03‑2025 (a menos de 11 mm/h) el aforo marcó 0,0–0,3 m³/s; con 85 mm en un día sobre el propio aforo, 1,9. Todos los "episodios" de caudal del histórico (mesetas de 780–900 m³/s durante 1–5 h con cero antes y después) son los artefactos de la fase 9. La rambla solo responde a convección intensa y no ha habido ninguna desde enero de 2025.

Eso obligó a una regla más en el criterio de "ajuste utilizable", además de r² y número de horas: **el aforo tiene que haber alcanzado su primer umbral** en las horas con respuesta. Sin ella, la primera versión de la herramienta dio por "razonable" (r² 0,61) una ley de potencia ajustada sobre el goteo de 0,5–1,9 m³/s, que proyectaba 1,7 m³/s para 90 mm: un buen r² sobre el rango equivocado.

La rambla Castellana (Benaguasil) sí tiene tres crecidas pequeñas (47, 21 y 11 m³/s) y su ajuste con Pedralba y Bugarra da r² 0,31 sobre 14 horas: el veredicto es "débil" y tampoco se aplica.

**Consecuencia**: `runoff_models` va **sin semilla**. La señal `flow_projected` no se emite en producción hasta que haya un episodio real y alguien ejecute `backfill` + `calibrate-runoff --apply`. Es exactamente la decisión 5: sin modelo no se inventa nada.

## No-objetivos

- Un modelo hidrológico distribuido o físico: aquí caben episodios reales y una relación empírica honesta, no HEC‑HMS.
- Proyectar caudal en el Xúquer (regulado) ni en el Túria regulado (Vilamarxant): solo cuencas de respuesta rápida sin regulación aguas arriba del aforo.
- Cambiar el nivel por la tendencia de las corridas.
- Notificar una proyección como si fuera una medida: la notificación lleva el detalle, que empieza por "la lluvia en cabecera anticipa".

## Impacto

- `packages/shared`: `runoff.ts` (ajuste, proyección, carga de modelos), `risk-eval.ts` (componente `flow_projected` y tendencia en `rain_forecast`).
- `db/migrations/0013_runoff.sql`: tabla `runoff_models` con la semilla del Poyo que salga de la calibración.
- `collectors/scheduler`: CLI `calibrate-runoff`.
- `api`: `GET /api/v1/forecast-runs`.
- `web`: tabla de corridas y flecha de tendencia en `/l/{id}`; etiqueta "Caudal anticipado".
- `docs/arquitectura.md` §7 y `docs/cuencas.md`.
