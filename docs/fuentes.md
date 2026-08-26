# Fuentes de datos

Fichas por fuente. Verificado el **25‑08‑2026** (marcas: ✅ verificado con llamadas reales, 📄 según documentación, ❓ no verificado).

## Localizaciones objetivo ✅

| id | Localidad | INE (AEMET) | Lat, lon | Elev. | Zona avisos | Notas |
|---|---|---|---|---|---|---|
| `virtual:albal` | Albal | `46007` | 39.397, −0.415 | 14 m | `774602` | Principal. Barranc del Poyo |
| `virtual:benetusser` | Benetússer | `46054` | 39.4227, −0.3969 | 15 m | `774602` | Contiguo a Albal; zona según PDF de AEMET (misma columna que Albal) |
| `virtual:mareny-barraquetes` | Mareny de Barraquetes | `46235` (Sueca) | 39.2458, −0.2646 | ~2 m | `774604` | Pedanía costera de Sueca; sin municipio propio en AEMET. Coordenadas de Nominatim/OSM |
| `virtual:benaguasil` | Benaguasil | `46051` | 39.6, −0.583 | 103 m | `774602` | Camp de Túria, margen derecha del Túria. Zona según PDF de AEMET (misma columna que Albal) |

Fuentes: geocoder de Open-Meteo, https://www.aemet.es/es/eltiempo/prediccion/municipios/benetusser-id46054 y `sueca-id46235` (200; un id falso da 404), PDF de zonas de AEMET.

---

## 1. AEMET OpenData

| Campo | Valor |
|---|---|
| URL base | `https://opendata.aemet.es/opendata` ✅ |
| Docs | Swagger: https://opendata.aemet.es/dist/index.html · Spec OpenAPI: https://opendata.aemet.es/AEMET_OpenData_specification.json · FAQ: https://opendata.aemet.es/centrodedescargas/docs/FAQs170621.pdf |
| Formato | JSON (predicción, observación), tar.gz de XML CAP 1.2 (avisos), GIF (radar) |
| Autenticación | Header `api_key: <JWT>` (también acepta `?api_key=`). Clave gratuita, validez indefinida: https://opendata.aemet.es/centrodedescargas/altaUsuario |
| Cuota | **40 peticiones/min por usuario** (FAQ 3.5). Cada consulta son 2 peticiones (endpoint + URL `datos`). Sin cuota diaria documentada ❓ |
| Frecuencia | Predicción horaria: 4 veces/día 📄. Observación: horaria, ~1 h de retraso ❓. Avisos: continuo. Radar regional: 10 min |
| Codificación | Primer paso UTF‑8; URLs `datos`/`metadatos` en **ISO‑8859‑15** ✅ (leer bytes y decodificar según header `charset`, fallback latin‑9). CAP XML en UTF‑8 |

### Mecanismo de dos pasos ✅

```json
{ "descripcion": "exito", "estado": 200,
  "datos": "https://opendata.aemet.es/opendata/sh/ec5cff98",
  "metadatos": "https://opendata.aemet.es/opendata/sh/b3aa9d28" }
```

Las URLs caducan en ~5 min (`{"descripcion":"datos expirados","estado":404}`). Códigos: 401 clave inválida, 404 sin datos, 429 cuota excedida. Sin clave el servidor puede devolver **200 con cuerpo vacío** → tratar cuerpo vacío como error. El `estado` del cuerpo puede diferir del status HTTP: parsear siempre el JSON.

### Endpoints

| Producto | Path | Parámetros para Talaia |
|---|---|---|
| Predicción horaria municipio (48 h) | `/api/prediccion/especifica/municipio/horaria/{municipio}` | `46007`, `46054`, `46235`, `46051` |
| Predicción diaria municipio | `/api/prediccion/especifica/municipio/diaria/{municipio}` | ídem |
| Observación estación (últimas 12 h) | `/api/observacion/convencional/datos/estacion/{idema}` | `8416`, `8414A` |
| Observación todas las estaciones | `/api/observacion/convencional/todas` | — |
| Avisos CAP vigentes | `/api/avisos_cap/ultimoelaborado/area/{area}` | `77` (C. Valenciana) |
| Avisos CAP archivo | `/api/avisos_cap/archivo/fechaini/{AAAA-MM-DDTHH:MM:SSUTC}/fechafin/{…}` | desde 2018 |
| Radar regional | `/api/red/radar/regional/{radar}` | `va` (València) |
| Inventario estaciones | `/api/valores/climatologicos/inventarioestaciones/todasestaciones` | — |

### Estaciones cercanas (idema) ✅

`8416` València ciudad · `8414A` València Aeroport (Manises) · `8337X` Turís · `8328X` Sollana · `8325X` Polinyà de Xúquer · `8300X` Carcaixent · `8293X` Xàtiva · `8409X` Llíria · `8446Y` Sagunt. **No hay estación AEMET en Picassent ni Silla.**

### Avisos Meteoalert ✅

- Área `77`. Zonas de València: `774601` Interior norte, `774602` **Litoral norte** (← **Albal, Benetússer, Benaguasil**), `774603` Interior sur, `774604` **Litoral sur** (← **Sueca / Mareny de Barraquetes**). Fuente: https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/detalle_municipios_zonas_meteorologicas.pdf
- El tar.gz contiene un XML por aviso `Z_CAP_C_LEMM_AAAAMMDDHHMMSS_AFAZ{zona}{FF}{PP}{DDHH}.xml` más mensajes "sin aviso" (`severity=Minor`, zona `77VV77`). Filtrar por `<geocode><valueName>AEMET-Meteoalerta zona</valueName><value>774602|774604</value>`.
- Campos: `eventCode` (`PR;Lluvias`), `parameter` "AEMET-Meteoalerta nivel" (verde/amarillo/naranja/rojo), "AEMET-Meteoalerta parametro" (`P2;Precipitación acumulada en 12 horas;60 mm`), `onset`, `expires`, `polygon`. Anexo CAP: https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/METEOALERTA_ANX3_CAP.pdf · Shapes de zonas: http://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/AEMET-meteoalerta-delimitacion-zonas.zip

#### Umbrales de aviso por lluvia ✅ (verificados 25‑08‑2026)

Zonas `774602` y `774604` — y de hecho **las once zonas de la Comunitat Valenciana**, que comparten cifras:

| Acumulación | Amarillo | Naranja | Rojo |
|---|---|---|---|
| 1 hora | 20 mm | 40 mm | 90 mm |
| 12 horas | 60 mm | 100 mm | 180 mm |

Fuente: Plan Meteoalerta, **Anexo 1 — Umbrales y niveles de aviso** (versión 1, 31‑05‑2022), sección 3.17: https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/METEOALERTA_ANX1_Umbrales_y_niveles_de_aviso.pdf · Plan matriz v9 (10‑01‑2025): https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/PLAN_METEOALERTA_v9_web_externa.pdf

Son los umbrales sembrados en la tabla `thresholds` para el semáforo. Dos matices que conviene no olvidar: el Anexo 1 sigue en su versión de 2022 (tras la DANA del 29‑10‑2024 se discutió públicamente el umbral rojo de 180 mm/12 h, pero **no** hay revisión oficial publicada ❓), y AEMET no emite el aviso solo por superar el umbral —pondera la probabilidad y en tormentas usa adjetivación cualitativa—, así que **el semáforo de Talaia no reproduce los avisos oficiales, los complementa**.

Zonas de las localizaciones ✅ (verificado contra el listado de municipios **y** el shapefile de delimitación, por punto en polígono): Albal, Benetússer y Benaguasil → `774602`; Sueca y el punto del Mareny → `774604`. Benaguasil es litoral‑norte pese a estar en el Camp de Túria; no confundirlo con **Benagéber** (`46050`), que sí es `774601`.
- Alternativa sin clave: RSS https://www.aemet.es/es/rss_info/avisos/val ✅

### Estructura de la predicción horaria 📄✅ (fixture real)

```json
[{"elaborado":"2021-01-09T11:47:45","nombre":"Getafe","id":"28065",
  "prediccion":{"dia":[{"fecha":"2021-01-09T00:00:00",
    "precipitacion":[{"value":"1.4","periodo":"07"},{"value":"2.1","periodo":"08"}],
    "probPrecipitacion":[{"value":"","periodo":"0107"},{"value":"100","periodo":"0713"}],
    "temperatura":[{"value":"-1","periodo":"07"}],
    "humedadRelativa":[{"value":"96","periodo":"07"}],
    "vientoAndRachaMax":[{"direccion":["NE"],"velocidad":["28"],"periodo":"07"},{"value":"41","periodo":"07"}],
    "estadoCielo":[{"value":"36n","periodo":"07","descripcion":"Cubierto con nieve"}]
  }]}}]
```

Peculiaridades que el normalizador debe tratar:
- Array con un solo objeto. `dia` tiene 3 entradas; el primer día empieza en la hora actual.
- `periodo` "07" = hora **local** (`Europe/Madrid`); `precipitacion.value` = mm en la hora anterior (06–07).
- **Todos los `value` son strings**; `""` = sin dato.
- `probPrecipitacion` en tramos de 6 h (`0107`, `0713`, `1319`, `1901`).
- Viento en km/h; `vientoAndRachaMax` mezcla objetos de viento y de racha.
- `elaborado` = hora local de emisión → `forecast_ts`.

### Observación de estaciones 📄

Array de filas horarias (12 h): `idema`, `fint` (fin del período, **UTC** sin sufijo Z), `prec` (mm en 60 min anteriores), `ta` (°C), `hr` (%), `vv` (m/s), `dv` (°), `pres` (hPa), `vmax`, `lat`, `lon`, `alt`. Valores numéricos.

### Mapeo a variables canónicas

| AEMET | canónica | conversión |
|---|---|---|
| `precipitacion.value` | `precip_mm` | string → float |
| `probPrecipitacion.value` | `precip_prob_pct` | tramo 6 h → replicar a cada hora del tramo |
| `temperatura.value` | `temp_c` | |
| `humedadRelativa.value` | `rh_pct` | |
| `vientoAndRachaMax.velocidad` | `wind_ms` | km/h ÷ 3.6 |
| `vientoAndRachaMax.value` (racha) | `gust_ms` | km/h ÷ 3.6 |
| obs `prec` | `precip_mm` | |
| obs `ta`, `hr`, `vv`, `pres` | `temp_c`, `rh_pct`, `wind_ms`, `pressure_hpa` | |

### Riesgos
- Cuota estricta (40/min) → nunca lanzar collectors en paralelo contra AEMET; cachear y espaciar.
- Charset latin‑9; strings numéricos; horas locales con DST.
- Servicio con caídas frecuentes (reputación) → tolerar fallos, mostrar frescura.

---

## 2. Open-Meteo

| Campo | Valor |
|---|---|
| URL | `https://api.open-meteo.com/v1/forecast` ✅ |
| Docs | https://open-meteo.com/en/docs · modelos: `/docs/ecmwf-api`, `/docs/dwd-api`, `/docs/meteofrance-api`, `/docs/gfs-api`, `/docs/ukmo-api` · actualizaciones: https://open-meteo.com/en/docs/model-updates |
| Formato | JSON |
| Autenticación | Ninguna (plan gratuito, **uso no comercial**, licencia CC BY 4.0 → atribuir) |
| Cuota | 600/min, 5.000/h, 10.000/día, 300.000/mes 📄. Las llamadas con muchos modelos/variables ponderan más ❓ |
| Frecuencia | Depende del modelo (ver tabla). Sin campo de corrida en la respuesta; usar `meta.json` |

### Llamada de referencia ✅

Varias localizaciones en una petición: `latitude=39.397,39.4227,39.2458,39.6&longitude=-0.415,-0.3969,-0.2646,-0.583` → la respuesta pasa a ser un **array** de objetos en el mismo orden ✅.

```
GET https://api.open-meteo.com/v1/forecast?latitude=39.397&longitude=-0.415
  &hourly=precipitation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,cape,weather_code
  &models=meteofrance_arome_france_hd,icon_eu,ecmwf_ifs,ecmwf_ifs025,gfs_seamless,arpege_europe,ukmo_global_deterministic_10km,best_match
  &timezone=UTC&forecast_days=3&past_days=1
```

### Modelos que cubren Albal ✅

| id `models` | Modelo | Resolución | Horizonte | Ciclo | id `meta.json` | Notas |
|---|---|---|---|---|---|---|
| `meteofrance_arome_france_hd` | AROME France HD | 1,5 km | ~51 h | 3 h | mismo | bbox lat 37,5–55,4, lon −12–16 ✅. Sin `precipitation_probability`, `rain`, `showers`, `weather_code` (null) |
| `meteofrance_arome_france` | AROME France | 2,5 km | 2 días | 3 h | `meteofrance_arome_france0025` | Sí devuelve `rain`/`showers`/`weather_code` |
| `icon_eu` | DWD ICON EU | 7 km | 5 días | 3 h | `dwd_icon_eu` | `icon_seamless` y `best_match` = ICON EU en Albal ✅ |
| `ecmwf_ifs` | ECMWF IFS HRES | 9 km | 15 días | 6 h | mismo | horario hasta 90 h |
| `ecmwf_ifs025` | ECMWF IFS | 25 km | 15 días | 6 h | mismo | paso 3 h; celda 39.5/−0.5 |
| `gfs_seamless` / `gfs_global` / `gfs013` | NCEP GFS | 13 km | 16 días | 6 h | `ncep_gfs013` | `gfs025` devuelve null en Albal ✅ |
| `arpege_europe` | ARPEGE Europe | 11 km | 4 días | 6 h | `meteofrance_arpege_europe` | |
| `ukmo_global_deterministic_10km` | UKMO Global | 10 km | 7 días | 6 h | mismo | |
| `gem_global` | CMC GEM | 15 km | 10 días | 12 h | `cmc_gem_gdps` | meta.json parecía estancado (mayo 2026) ❓ |

**No cubren Albal** ✅: `icon_d2`, `knmi_harmonie_arome_europe`, `dmi_harmonie_arome_europe`, `ukmo_uk_deterministic_2km`. `arome` a secas → 400.

### Estructura de la respuesta ✅

Con varios modelos, cada variable lleva sufijo `_<model_id>` (con uno solo, no). `time` es común. Fuera de horizonte o variable no soportada → `null`. Modelos que no cubren el punto se **omiten silenciosamente**; si ninguno cubre, `latitude: nan` sin `hourly`. `latitude/longitude/elevation` corresponden a la celda del **primer** modelo.

```json
{"latitude":39.5,"longitude":-0.5,"utc_offset_seconds":0,"timezone":"GMT","elevation":16.0,
 "hourly_units":{"time":"iso8601","precipitation_ecmwf_ifs025":"mm","precipitation_probability_ecmwf_ifs025":"%",
                 "precipitation_meteofrance_arome_france_hd":"mm","precipitation_probability_meteofrance_arome_france_hd":"undefined"},
 "hourly":{"time":["2026-08-25T00:00","2026-08-25T01:00"],
           "precipitation_ecmwf_ifs025":[0.0,0.0],"precipitation_probability_ecmwf_ifs025":[0,0],
           "precipitation_meteofrance_arome_france_hd":[0.0,null],"precipitation_probability_meteofrance_arome_france_hd":[null,null]}}
```

### Hora de la corrida (`forecast_ts`) ✅

`GET https://api.open-meteo.com/data/{meta_id}/static/meta.json` →

```json
{"last_run_initialisation_time":1787637600,"last_run_modification_time":1787663170,
 "last_run_availability_time":1787663303,"data_end_time":1788166800,
 "temporal_resolution_seconds":10800,"update_interval_seconds":21600,"crs_wkt":"…BBOX[…]"}
```

Usar `last_run_initialisation_time` como `forecast_ts`. Los ids `*_seamless` y `best_match` no tienen `meta.json` (virtuales). Latencias observadas init → disponible: ICON EU ~3 h, AROME HD ~4,5 h, ECMWF/GFS ~7 h.

### Otros endpoints útiles ✅

- **Previous Runs**: `https://previous-runs-api.open-meteo.com/v1/forecast` con variables `precipitation_previous_day1…7` (tendencia entre corridas, desfase por días).
- **Single Runs**: `https://single-runs-api.open-meteo.com/v1/forecast?run=2026-08-25T00:00&models=…` — corrida concreta (archivo desde abr 2026; ECMWF 9 km desde mar 2024).
- **Archivo ERA5**: `https://archive-api.open-meteo.com/v1/archive?start_date&end_date&models=era5|era5_land|ecmwf_ifs`. Es reanálisis (para la DANA, ERA5 da ~70 mm/día en Albal frente a 771 mm en Turís: no sirve para verificar convección local).
- **Flood API (GloFAS)**: `https://flood-api.open-meteo.com/v1/flood?daily=river_discharge`. Celda 5 km y valores diarios → **no útil** para el Poyo; solo como indicador contextual.

### Mapeo a variables canónicas

`precipitation`→`precip_mm`, `precipitation_probability`→`precip_prob_pct`, `temperature_2m`→`temp_c`, `relative_humidity_2m`→`rh_pct`, `wind_speed_10m`→`wind_ms` (km/h ÷ 3.6, o pedir `wind_speed_unit=ms`), `wind_gusts_10m`→`gust_ms`, `cape`→`cape_jkg`. `source` = `open-meteo:<model_id>`.

### Riesgos
- Snap a la celda de rejilla (25 km en ECMWF 0.25°): para Albal es mejor confiar en AROME HD / ICON EU / ECMWF 9 km.
- Claves ausentes o `null` según modelo: el parser debe ser tolerante.
- Condición no comercial.

---

## 3. SAIH Júcar (CHJ)

| Campo | Valor |
|---|---|
| URL | https://saih.chj.es/ (redirige a `/mapa-lluvias`) ✅. Las rutas antiguas `/chj/saih/...` dan 404 |
| Formato | HTML con JSON inline (valores actuales) + **endpoints JSON internos sin autenticación** ✅. CORS abierto (`Access-Control-Allow-Origin: *`) |
| Autenticación | Ninguna |
| Cuota | No documentada ❓. Usar con moderación (5 min) |
| Frecuencia | Registro **cincominutal**; retraso 5–10 min ✅ |
| Retención pública | Desde ~01‑01‑2025 ✅. **El 29‑10‑2024 devuelve vacío** (la DANA no está en el portal) |
| Docs | Ninguna. Contacto `sugerencias.saihweb@chj.es`. Descripción: https://saih.chj.es/saih |

### Endpoints internos ✅

| Endpoint | Devuelve |
|---|---|
| `GET /admin/variables/valor/{idVariable}/{YYYY-MM-DD HH:MM}/{YYYY-MM-DD HH:MM}` (fechas URL‑encoded, `%20`) | `[{"valor":0,"fecha":"2026-08-23T22:00:00.000Z","estado":128},…]` cada 5 min. Con formato de fecha distinto devuelve `[]` sin error. Sin límite de rango observado (55 días → 15.760 puntos) |
| `GET /api/variables/{idVariable}/propiedades` | Definición de la variable y **umbrales** (`fldFUmbralBajo/Medio/Alto`). **Devuelve `[]` para las variables de lluvia** ✅ |
| `GET /lluviasIntervalo/{YYYY-MM-DD}/{YYYY-MM-DD}` | Todas las estaciones con `lluvia_int` (mm), `idEstacionRemota`, `fldTCodigo`, `fldTNombre`, coords UTM 25830. Solo acumulados diarios: **no lo usa el collector** |
| `GET /chart-lluvia/{idEstacionRemota}` (HTML) | Variables JS `varLluvia` (intensidad, `fkNFuncion=12`) y `varLluvia24` (acumulado 24 h, `fkNFuncion=91`) con su `idVariable`: es la única forma de descubrir los sensores de lluvia ✅ |
| `/aforos`, `/lluvias`, `/mapa-aforos`, `/mapa-embalses` (HTML) | JSON inline (`let aforos = […]`, `let embalses = […]`) con `lastValue`, umbrales, coords y, en embalses, `idCotaEmbalse`, `idVolumenEmbalse`, `idCaudalSalidaRio` y `fldFVolumenNMN` ✅ |

**El rango de la URL se interpreta en hora local `Europe/Madrid`; los `fecha` de la respuesta vienen en UTC** ✅ (verificado 25‑08‑2026: pedir `00:00–02:00` del 24‑08 devuelve muestras desde `2026-08-23T22:00:00.000Z`). `estado`: 0 normal; 128 frecuente en el Poyo (dato provisional/sin validar ❓); el collector lo guarda en `observations.quality` y no descarta muestras. La exportación CSV/XLSX del portal se genera en cliente a partir de este JSON: no hay descarga directa.

**Unidades de lluvia** ✅: la intensidad cincominutal está en **mm/h**, cuantizada en múltiplos de 2,4 (cazoleta de 0,2 mm por 5 min). Σ(v·5/60) sobre 24 h dio 27,8 mm frente a los 29,2 mm del acumulado publicado en el episodio del 5‑6‑03‑2026 (−5 %, por el desfase de la ventana móvil): suficiente para derivar `precip_mm` horario, que es lo que hace el collector.

### Estaciones relevantes ✅

(Inventario completo por cuenca —Túria, Xúquer bajo, Poyo— con umbrales en `docs/cuencas.md`.)

| Estación | `idEstacionRemota` | Código | Tipo | Coordenadas | `idVariable` |
|---|---|---|---|---|---|
| **MC RAMBLA POYO N‑III** (Riba‑roja de Túria) | **227** | `0O04` | Marco de control (caudal estimado) + pluviómetro | 39.4734, −0.5841 | **13873** caudal (m³/s) |
| CHIVA | 371 | `0P09` | Pluviómetro | 39.4575, −0.7355 | 14079 intensidad; **15311** acumulado 24 h |
| MC TURÍS | 789 | `7R04` | Marco de control + pluviómetro (Magro) | 39.3459, −0.7091 | 16922 intensidad; **16927** acumulado 24 h |
| EMBALSE DE FORATA (Yátova, Magro) | 303 | `7E03` | Embalse | 39.3405, −0.8644 | 1874 cota; 2464 volumen; 14582 entrada; 13345 salida total; 16696 salida al Magro |
| SIETE AGUAS | 232 | `7P12` | Pluviómetro (cabecera) | 39.4888, −0.8991 | lluvia |
| PARADA 14 – PICASSENT | 238 | `0L02` | Pluviómetro | 39.3934, −0.4799 | lluvia |
| AZUD REPARTIMENT (Quart de Poblet, Turia) | 222 | `0E02` | Aforo + pluviómetro | 39.4841, −0.4387 | 14450 caudal Turia |

URLs: `https://saih.chj.es/aforos/13873`, `/aforos/13873/chart`, `/chart-lluvia/227`, `/embalses/303`.

**Huecos**: no hay estaciones automáticas públicas en Buñol, Cheste, Torrent, Paiporta, Catarroja ni en los barrancos de l'Horteta, Gallego o Pozalet (solo regletas manuales del Plan de Inundaciones, gestionadas por el CCE de la GVA). El único aforo de toda la cuenca del Poyo es Riba‑roja. El sensor de Riba‑roja fue arrasado en la DANA y sustituido por un radar provisional; el definitivo estaba previsto para junio 2026 ❓ (sigue apareciendo como estación 227 / variable 13873).

### Umbrales oficiales CHJ del caudal del Poyo (variable 13873) ✅

**30 m³/s (bajo/amarillo) · 70 m³/s (medio/naranja) · 150 m³/s (alto/rojo)**. Comparación: Forata salida al Magro 5/30/100; Turia en Azud del Repartiment 100/500/1000.

### Referencias físicas e históricas
- Capacidad del encauzamiento aguas abajo de Paiporta: **800 m³/s**; caudal de diseño 1.500 m³/s (BOE‑A‑2012‑193) ✅.
- DANA 29‑10‑2024: último dato del sensor **2.282,9 m³/s y 4,9 m a las 18:55** (informe CHJ); aviso CHJ con 1.686 m³/s a las 18:43; pico estimado ~2.800 m³/s ❓; subida de ~0 a ~2.230 m³/s entre las 16:00 y las 18:50.
- Lluvia AEMET 29‑10‑2024: **Turís 771,8 mm/24 h, 184,6 mm/1 h (récord nacional), 102,8 mm/30 min; Chiva 445,4 mm**. Informe: https://www.aemet.es/documentos/es/conocermas/recursos_en_linea/publicaciones_y_estudios/estudios/informe_episodio_dana_29_oct_2024_.pdf

### Mapeo a variables canónicas (implementado el 25‑08‑2026)
Caudal → `river_flow_m3s`; cota de embalse → `reservoir_level_m`; volumen → `reservoir_hm3`; intensidad de lluvia → `precip_rate_mmh`; acumulado 24 h → `precip_24h_mm`; y **`precip_mm` horario derivado** de la intensidad (Σ v·5/60, mínimo 10 de 12 muestras, solo horas completas, `ts` = inicio de la hora como en Open‑Meteo). El catálogo completo —29 estaciones y 57 sensores, todos verificados— vive en la tabla `sensors` (`db/migrations/0006_saih.sql`), no en el código.

### Riesgos
- Endpoints no documentados con prefijo `/admin/`: pueden cambiar o cerrarse sin aviso. Guardar fixtures y monitorizar errores.
- Caudal del Poyo es **estimado** por marco de control, y el sensor es provisional.
- Datos "provisionales" (estado 128).

---

## 4. Meteoalarm

| Campo | Valor |
|---|---|
| URL | **API v1 (la que usa el collector)**: https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain ✅ (JSON, ~2,2 MB, 512 avisos de toda España). Alternativa legada: https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain ✅ (Atom + CAP 1.2, ~225 KB) |
| Formato | CAP 1.2 servido como JSON. Un bloque `info` por idioma (`es-ES`, `en-GB`) |
| Autenticación | Ninguna, sin cuota ✅ |
| Frecuencia | Continuo (republica AEMET). Collector cada 10 min |
| Interés | Los avisos de AEMET **sin clave**: es la única forma de tener la señal de avisos del semáforo mientras no haya `AEMET_API_KEY` |
| Riesgo | Retraso respecto a AEMET; **no publica polígonos** (`geom` queda a NULL) |

### Diferencias con el CAP de AEMET ✅ (verificadas 25‑08‑2026)

Meteoalarm **reetiqueta** los avisos, así que no se pueden leer con el mismo parser:

| AEMET OpenData | Meteoalarm | Traducción del collector |
|---|---|---|
| `geocode` `AEMET-Meteoalerta zona` = `774602` | `geocode` `EMMA_ID` = `ES247` | Mapa de 128 zonas en `collectors/meteoalarm/src/zones.ts` |
| `eventCode` = `PR;Lluvias` | `parameter` `awareness_type` = `10; Rain` | `10`→`PR`, `3`→`TO`, `11`/`12`→`IN`, `1`→`VI`, `7`→`CO` |
| `parameter` `AEMET-Meteoalerta nivel` = `amarillo` | `parameter` `awareness_level` = `2; yellow; Moderate` | `yellow`→`amarillo`, … |
| `polygon` con la geometría | — | `geom` a NULL |

El mapa `EMMA_ID` → zona se generó del propio feed cruzando cada área con el código de seis dígitos que va dentro del `identifier`: **128 zonas, cero conflictos**. Las de la Comunitat Valenciana: `ES247`→`774602`, `ES249`→`774604`, `ES246`→`774601`, `ES248`→`774603`, y las costeras `ES864`→`774602`, `ES863`→`774604`.

**Los `identifier` de las dos fuentes no coinciden en formato** (AEMET `…ES.20261025120000.774602PRP2251912`, Meteoalarm `…ES.260820093609.774602PRP1230889928`), así que la misma alerta cae en filas distintas: se deduplica **al leer**, por `(area_code, event_code, level, onset, expires)`, prefiriendo AEMET.

---

## 5. MITECO Boletín Hidrológico / embalses.net

| Campo | Valor |
|---|---|
| MITECO | https://www.miteco.gob.es/es/agua/temas/evaluacion-de-los-recursos-hidricos/boletin-hidrologico.html · PDF semanal `https://sede.miteco.gob.es/BoleHWeb/accion/cargador_archivo.htm?file=cache/pdf/{YYYYWW}/{YYYYWW}40_es.pdf` · histórico en MDB/XLSX · datos.gob.es `e05068001-boletin-hidrologico-semanal` |
| embalses.net | `https://www.embalses.net/pantano-640-forata.html` ✅ (Forata: 17 hm³, 45,95 % el 24‑08‑2026). Cuenca: `cuenca-7-jucar.html`. Scraping HTML; semanal |
| Interés | Contexto (llenado de Forata). Para tiempo real usar SAIH `/embalses/303` |
| Prioridad | Fase 3 |

---

## 6. GVA Emergències / 112 Comunitat Valenciana

| Campo | Valor |
|---|---|
| URL | https://www.112cv.gva.es/es/ · X: https://x.com/GVA112 · app "GVA 112 Avisos" |
| Formato | HTML (Liferay). **Sin RSS ni API encontrados** ❓ |
| Alternativa | Avisos AEMET por RSS (https://www.aemet.es/es/rss_info/avisos/val) para la parte meteorológica; ES‑Alert no tiene feed |
| Prioridad | Fase 3; requiere scraping o seguimiento de X (API de pago) |

---

## 7. Copernicus EFAS

| Campo | Valor |
|---|---|
| URL | Early Warning Data Store: https://ewds.climate.copernicus.eu/ · API `https://ewds.climate.copernicus.eu/api` (cliente `cdsapi`, token en `.cdsapirc`) · Doc: https://confluence.ecmwf.int/display/CEMS/EWDS+API |
| Datasets | `efas-forecast`, `efas-historical`, `efas-reforecast`, `efas-seasonal` (GRIB/NetCDF, ~1 km en v5) |
| Autenticación | Cuenta ECMWF/Copernicus gratuita |
| Interés | Túria/Xúquer; utilidad limitada para una cuenca de ~380 km² como el Poyo. Las notificaciones operativas solo llegan a autoridades |
| Prioridad | Fase 4 |

---

## 8. AVAMET (estaciones amateur)

| Campo | Valor |
|---|---|
| URL | Red MXO: https://www.avamet.org/mxo-mxo.php · Tabla de precipitación en tiempo real: https://www.avamet.org/mxo-mxo-prec.php (~1 MB HTML) · Ficha: `https://www.avamet.org/mxo_i.php?id={codi}` |
| Posiciones (WFS ICV) ✅ | `https://terramapas.icv.gva.es/0508_AVAMET?service=WFS&version=2.0.0&request=GetFeature&typeNames=AVAMET.Estaciones&outputFormat=geojson` → 598 estaciones (solo metadatos, sin valores) |
| Formato | HTML (scraping). GeoJSON en tiempo real anunciado en datos.gob.es pero URL rota ❓ |
| Estaciones de interés | Paiporta `c16m186e02`; Catarroja `c16m094e05`; Torrent `c16m244e03`, `c16m244e01`; Chiva `c18m111e01`, `c18m111e03`, `c18m111e04`; Turís `c20m248e02` |
| Interés | Única red densa en l'Horta Sud y cabecera del Poyo; el 29‑10‑2024 registró >500 mm en Chiva/Cheste/Buñol/Godelleta |
| Prioridad | Fase 4 (scraping frágil) |

---

## AVAMET · Meteoxarxa ✅ (verificado 26‑08‑2026)

| Campo | Valor |
|---|---|
| URL | Tabla de precipitación por comarca: `https://www.avamet.org/mxo-mxo-prec.php?territori=c16` (92 KB, 25 estaciones de l'Horta Sud). Ficha de estación: `mx-fitxa.php?id=<id>` (coordenadas en `var lat` / `var lon`) |
| Formato | **HTML sin API**. No hay JSON, ni `fetch`, ni endpoint de exportación: todo es PHP renderizado en servidor |
| Autenticación | Ninguna. `robots.txt` no prohíbe estas rutas y acepta un `User-Agent` propio |
| Licencia | **CC BY‑NC‑ND 4.0**: uso no comercial con **atribución visible**, que el frontend incluye |
| Interés | Única señal del **barranc de l'Horteta** (Torrent, Paiporta, Picanya, Catarroja), que está fuera del SAIH |
| Riesgo | HTML sin contrato: un rediseño lo rompe. Servidor de una asociación pequeña y sin gzip: una petición por ciclo y separación mínima de 1 s |

- Identificadores: `c{comarca}m{municipio INE sin provincia}e{estación}` — Torrent `c16m244e03`, Paiporta `c16m186e02`, Albal `c16m007e02`. **Benetússer no tiene estación** ✅ (comprobado sobre el listado de la comarca).
- La tabla comarcal trae los acumulados **ya calculados** por AVAMET (día, 1 h, 4 h, 8 h, 12 h, 24 h, 48 h, 72 h) y la hora de última lectura de cada estación en el `title` de la última celda, en hora local.
- Datos amateur, sin control de calidad ni pluviómetros normalizados: entran como contexto y se muestran siempre marcados.
- El histórico diario (`mx-meteoxarxa.php?territori=c16&data=AAAA-MM-DD`) **sí tiene el 29‑10‑2024** (Turís Canyapar 640,8 mm), a diferencia del SAIH ❓ pendiente de explotar para calibrar.
- El export de microdatos crudos (`mx-consultes.php`) está **restringido a socios**.

---

## GVA Emergències · CCE 112 CV ✅ (verificado 26‑08‑2026)

| Campo | Valor |
|---|---|
| URL | API JSON pública en `https://wpr.112cv.gva.es`. Emergencias: `/external/api/storage/descargar/json/emergencias`. Catálogos: `…/json/static/{zonas,situacion}`, `…/json/datos/fenomenos`, `/wp/api/municipios` |
| Formato | JSON limpio (UTF‑8). `z2` = `{ "<idZonaEmergencia>": [ {sit, fen}, … ] }`. `time` en hora local, sin ISO |
| Autenticación | Ninguna, sin cuota. `robots.txt` no restringe. **No hay RSS/Atom** (las rutas antiguas dan 404) |
| Condiciones | *"Se autoriza su uso y difusión citando al CCE como autor"*. Atribución al CCE / Generalitat |
| Interés | Activación de las **fases del plan de emergencias** por inundación (Situación 0/1/2/3): lo que deciden las autoridades, distinto del aviso meteorológico de AEMET |
| Riesgo | Sin fecha de fin por aviso: la vigencia se infiere (TTL). El endpoint `avisosmeteorologicos` **es AEMET republicado, no integrar** |

- Zonas de emergencia = **comarcas** (`idZonaEmergencia`): Albal/Benetússer `28` (L'Horta Sud), Sueca `33` (La Ribera Baixa), Benaguasil `23` (El Camp de Túria). Comodín provincial `51` = toda Valencia. Mapeo municipio→zona en `/wp/api/municipios`.
- Fases (catálogo `situacion`): `14`=SIT 0, `15`=SIT 1, `16`=SIT 2, `17`=SIT 3. Fenómenos (`fenomenos`): `10`=Inundaciones, `15`=Tormentas, `11`=Vientos…
- **Pendiente** ❓: capturar una respuesta con `z2` poblado durante un episodio real. Cuando se integró no había emergencias activas; la ruta con avisos está construida sobre el esquema del parser del widget, no sobre una captura real.

## MITECO / embalses.net — descartado

Ya hay volumen y cota de 6 embalses del SAIH Júcar **cada 5 min** (fase 2). MITECO es un boletín semanal: no añade nada más fresco. Sin collector.

## Copernicus EFAS — descartado para alerta

EFAS es **ciego al barranc del Poyo por diseño**: no emite notificación por debajo de 500 km² de cuenca, y el Poyo tiene ~182 km² en el aforo y ~450 en desembocadura. En la DANA de 2024 avisó del Túria (6.123 km²) con 138 h pero **nada del Poyo**. Único uso posible, nunca para alertar: `cems-glofas-historical` para climatología y verificar a posteriori el error de los modelos.
