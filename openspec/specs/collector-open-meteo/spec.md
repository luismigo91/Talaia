# Capacidad: collector-open-meteo

> Comportamiento **vigente**. Origen: `mvp-comparativa-precipitacion` (MVP: comparativa de precipitación prevista), archivado el 25‑08‑2026.

## Requirements

### Requirement: Descarga multi-modelo y multi-localización
El collector DEBE pedir a `https://api.open-meteo.com/v1/forecast` todas las estaciones virtuales en una sola petición (`latitude` y `longitude` con valores separados por comas, en el orden de `stations.id`), tratando la respuesta como array en ese mismo orden, con `models=meteofrance_arome_france_hd,icon_eu,ecmwf_ifs,gfs_seamless,arpege_europe,ukmo_global_deterministic_10km`, `hourly=precipitation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,cape`, `wind_speed_unit=ms`, `timezone=UTC`, `forecast_days=3`, en **una sola petición**.

#### Scenario: Petición única
- **Dado** 4 estaciones virtuales
- **Cuando** se ejecuta `run()`
- **Entonces** se hace exactamente 1 petición al endpoint de forecast (más las de `meta.json`) y se escriben filas para las 4 `station_id`.

#### Scenario: Orden de la respuesta
- **Dado** que el array devuelto tiene 4 elementos
- **Entonces** el elemento i se asigna a la estación i; si la longitud no coincide, `run()` falla con `last_error` sin escribir nada.

### Requirement: Hora de emisión por modelo
Para cada modelo, `forecast_ts` DEBE ser `last_run_initialisation_time` de `https://api.open-meteo.com/data/{meta_id}/static/meta.json`, usando la tabla de mapeo `models id → meta id` (`gfs_seamless→ncep_gfs013`, `icon_eu→dwd_icon_eu`, `arpege_europe→meteofrance_arpege_europe`, resto idéntico). Si `meta.json` falla, `forecast_ts` = hora de descarga truncada a la hora, y se registra una advertencia.

#### Scenario: meta.json disponible
- **Dado** `last_run_initialisation_time=1787637600` para `icon_eu`
- **Entonces** las filas de `open-meteo:icon_eu` tienen `forecast_ts='2026-08-25T06:00:00Z'`.

#### Scenario: meta.json no disponible
- **Dado** que `meta.json` de `ecmwf_ifs` devuelve 500
- **Entonces** las filas de `ecmwf_ifs` se escriben igualmente con `forecast_ts` = hora de descarga truncada.

### Requirement: Parser tolerante
El parser DEBE generar una fila por `(modelo, variable, hora)` a partir de las claves `<variable>_<modelo>`, omitiendo claves ausentes y valores `null`, y DEBE fijar `ts` = `time[i] − 1 h` para variables acumuladas (`precipitation`) y `ts` = `time[i]` para instantáneas.

#### Scenario: Modelo sin probabilidad
- **Dado** `precipitation_probability_meteofrance_arome_france_hd: [null, null]`
- **Entonces** no se generan filas de `precip_prob_pct` para ese modelo y sí de `precip_mm`.

#### Scenario: Modelo ausente en la respuesta
- **Dado** que la respuesta no contiene ninguna clave `_ukmo_global_deterministic_10km`
- **Entonces** el parser no falla y `records_written` cuenta solo los modelos presentes.

#### Scenario: Convención de intervalo
- **Dado** `time[3]="2026-08-25T03:00"` y `precipitation_icon_eu[3]=2.5`
- **Entonces** la fila es `{source:'open-meteo:icon_eu', variable:'precip_mm', ts:'2026-08-25T02:00:00Z', value:2.5}`.

### Requirement: Idempotencia por corrida
Si `forecast_ts` de un modelo coincide con la última `forecast_ts` almacenada para ese `source`, el collector NO DEBE reescribir sus filas.

#### Scenario: Corrida repetida
- **Dado** que la DB ya tiene `open-meteo:icon_eu` con `forecast_ts=T`
- **Cuando** `meta.json` devuelve T de nuevo
- **Entonces** no se ejecuta ningún insert para ese modelo.

### Requirement: Registro de estado
Igual que en collector-aemet, con fuente lógica `open-meteo`.
