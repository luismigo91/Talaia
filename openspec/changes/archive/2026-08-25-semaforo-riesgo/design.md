# Diseño: semáforo de riesgo por localización

## 1. Qué vigila cada localidad: `watch_points`

```sql
create table watch_points (
  station_id  text not null references stations(id),   -- virtual:albal
  sensor_id   text not null references sensors(id),    -- saih:13873
  role        text not null check (role in
                ('flow_primary','flow_secondary','reservoir','rain_upstream','rain_local')),
  lag_minutes integer,   -- propagación conocida: Chiva → Riba-roja ≈ 120 min
  note        text,
  primary key (station_id, sensor_id)
);
```

El rol no pondera: **describe**. Sirve para agrupar la respuesta ("caudal", "lluvia aguas arriba") y para que el frontend sepa qué enseñar primero. `lag_minutes` se guarda como dato documentado, pero en esta fase no desplaza ninguna serie: hacerlo bien es un modelo de tránsito de crecida, no un `interval`.

Las 30 filas salen del inventario de `docs/cuencas.md`. Casos que conviene recordar al leer la respuesta: Albal y Benetússer comparten el **único** aforo del Poyo, que no ve el aporte de l'Horteta; el Mareny no tiene aforo aguas abajo de Huerto Mulet; y en Benaguasil el Túria va regulado, así que el riesgo lo marcan las ramblas Primera y Castellana.

## 2. La lluvia derivada entra en el catálogo

El collector ya escribe `precip_mm` horario derivado de la intensidad, pero no existía como fila en `sensors`, así que no se podía vigilar ni salía en `/api/v1/sensors`. Se añaden 13 filas con `meta.derived_from` apuntando al `idVariable` de la intensidad. `loadSensors()` las excluye por defecto: el collector no debe intentar descargar del portal algo que calcula él.

Id `saih:227:precip_mm` (estación + variable) en vez de `saih:<idVariable>`: no hay un `idVariable` propio, y lo que se vigila es la estación.

## 3. Umbrales: los oficiales primero

| Señal | Amarillo | Naranja | Rojo | Procedencia |
|---|---|---|---|---|
| `observed_precip_1h` | 20 | 40 | 90 | AEMET, Plan Meteoalerta Anexo 1 (v1, 31‑05‑2022), zonas 774602/774604 |
| `observed_precip_12h` | 60 | 100 | 180 | ídem |
| `forecast_precip_12h` | 60 | 100 | 180 | ídem, aplicado a la predicción |
| `forecast_precip_24h` | 20 | — | — | **No oficial**: regla propia del diseño preliminar de Talaia (`docs/arquitectura.md` §7) |
| Caudal, nivel, embalse | — | — | — | Ya en `sensors`, umbrales oficiales de la CHJ |

Fuente: <https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/METEOALERTA_ANX1_Umbrales_y_niveles_de_aviso.pdf>. Los umbrales de lluvia son **idénticos en las once zonas de la Comunitat Valenciana**, así que no hace falta distinguir por zona; se siembran como reglas globales (`station_id is null`) y una localización puede sobrescribirlas con una fila propia.

Cada fila lleva en `meta.source` de dónde sale su cifra. Es la diferencia entre un umbral que se puede defender y un número mágico.

Dos advertencias que se documentan junto a los datos, no en el código:

- El Anexo 1 sigue en su versión de 2022 aunque el plan matriz va por la v9 (enero de 2025); es lo que AEMET sirve hoy. Tras la DANA del 29‑10‑2024 hubo debate público sobre el umbral rojo de 180 mm/12 h, pero **no** hay revisión oficial publicada.
- AEMET no emite el aviso solo por superar el umbral: pondera la probabilidad, y en tormentas usa adjetivación cualitativa. **El semáforo no reproduce los avisos oficiales**, los complementa; por eso el aviso vigente entra como señal propia y no se intenta recalcular.

## 4. Cómo se combina

```
nivel(localidad) = max(caudal, lluvia observada, lluvia prevista, aviso vigente)
```

Máximo, nunca media: un caudal en rojo no se compensa con que no haya aviso. Cada componente devuelve `{ kind, level, value, threshold, sensor, detail }`, y `detail` es una frase en español ("caudal 80 m³/s ≥ 70 (naranja) en MC RAMBLA POYO N‑III"). Un semáforo que no sabe explicarse no se usa.

**Lluvia observada**: se evalúa **cada pluviómetro por separado** y se toma el peor. Promediar Chiva con Picassent diluiría exactamente la señal que importa: en la DANA, Turís marcó 771 mm mientras a 20 km apenas llovía.

Un detalle que solo aparece al probar con datos reales: `precip_mm` es horario y solo se escribe para **horas completas**, así que una ventana móvil de una hora (`now − 1 h`) no contiene ninguna fila casi nunca y la señal jamás se activaría. La señal horaria es, por tanto, el **máximo del acumulado horario de las últimas 6 h** — la hora más lluviosa reciente, que es justo lo que mide el umbral de AEMET.

**Sensores sin umbrales** (volumen de embalse) son contexto, no señal: no generan componente ni advertencia de frescura. Publican cada media hora, así que con `RISK_STALE_MINUTES=30` avisarían de obsolescencia constantemente sin aportar nada.

**Lluvia prevista**: por cada fuente con datos se acumula `precip_mm` en las próximas 12 h y 24 h usando su última `forecast_ts`; el nivel lo marca la **mediana entre fuentes** y el máximo viaja como contexto. Un solo modelo desatado no debe encender el semáforo, pero tampoco debe desaparecer de la vista.

**Avisos**: solo elevan el nivel los eventos de inundación — `PR` (lluvias), `TO` (tormentas), `IN` (inundaciones), leídos de `alerts.event_code`. Viento (`VI`) y costeros (`CO`) se devuelven marcados como informativos: mezclar un rebase marítimo con una crecida haría el semáforo ilegible, y el Mareny tendría permanentemente el color del mar.

## 5. Frescura: el silencio no es verde

Todo dato con más de `RISK_STALE_MINUTES` (30 por defecto) **no cuenta** para el nivel y genera una advertencia en `warnings`. El margen se ajusta a la cadencia real de cada sensor: los aforos publican cada cinco minutos, pero los embalses cada media hora, así que a estos se les tolera hasta 90 min. Aplicarles el mismo listón descartaría el caudal de salida la mitad del tiempo, y un embalse soltando agua que no cuenta es precisamente el verde falso que se quiere evitar. El sensor del Poyo es provisional y el portal no tiene contrato: un semáforo que da verde porque nadie le habla es peor que no tener semáforo. Si **todos** los componentes hidrológicos están obsoletos, el nivel se devuelve igualmente (con lo que haya) pero `stale: true` marca la respuesta entera.

## 6. Dónde vive el cálculo

En `RiskService` (API), al vuelo en cada petición: son cuatro consultas indexadas sobre datos que ya están en la base. Sin tabla de estado ni histórico de niveles: eso hará falta cuando haya notificaciones (para detectar el *cambio* de nivel), y es la fase siguiente. Calcularlo en servidor es lo que garantiza que pantalla, API y futuras notificaciones digan lo mismo.
