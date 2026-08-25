# Capacidad: api-comparativa

> Comportamiento **vigente**. Origen: `mvp-comparativa-precipitacion` (MVP: comparativa de precipitación prevista), archivado el 25‑08‑2026.

## Requirements

### Requirement: Endpoint de comparativa
`GET /api/v1/compare` DEBE aceptar `variable` (por defecto `precip_mm`), `station` (por defecto la estación con `meta.primary=true`, es decir `virtual:albal`; 404 si no existe) y `hours` (1–48, por defecto 24), y devolver una serie por `source` usando la **última** `forecast_ts` de cada fuente que tenga datos en la ventana `[now_trunc_hour, now_trunc_hour + hours)`, con el formato JSON de `design.md`.

#### Scenario: Comparativa de precipitación a 24 h
- **Dado** predicciones de `aemet` y de 3 modelos de Open-Meteo para las próximas 24 h
- **Cuando** se llama a `/api/v1/compare`
- **Entonces** la respuesta contiene 4 elementos en `series`, cada uno con `forecast_ts`, `total` (suma), `max_hourly` y `points` ordenados por `ts`, y `summary.sources = 4`.

#### Scenario: Solo la última emisión
- **Dado** dos corridas de `open-meteo:icon_eu` (T1 < T2) en la DB
- **Entonces** la serie de `icon_eu` usa solo T2.

#### Scenario: Fuente sin datos en la ventana
- **Dado** que `aemet` solo tiene datos de hace 3 días
- **Entonces** `aemet` no aparece en `series`.

#### Scenario: Otra localización
- **Dado** `station=virtual:mareny-barraquetes`
- **Entonces** las series contienen solo filas de esa `station_id`, y la de `aemet` corresponde al municipio `46235`.

#### Scenario: Parámetro inválido
- **Dado** `hours=100` o `station=virtual:inexistente`
- **Entonces** responde 400 (o 404 para estación inexistente) con un cuerpo de error JSON.

### Requirement: Listado de localizaciones
`GET /api/v1/stations` DEBE devolver las estaciones virtuales con `id`, `name`, `lat`, `lon`, `ine`, `aemet_zone`, `primary`.

#### Scenario: Cuatro localizaciones
- **Entonces** devuelve 4 elementos y `virtual:albal` tiene `primary=true`.

### Requirement: Estado de fuentes
`GET /api/v1/status` DEBE devolver todas las filas de `source_status` añadiendo `age_seconds` (segundos desde `last_success_at`, `null` si nunca).

#### Scenario: Frescura
- **Dado** `aemet:forecast.last_success_at` hace 600 s
- **Entonces** su `age_seconds` está entre 600 y 605.

### Requirement: Salud
`GET /api/v1/health` DEBE responder `{ok:true, db:true}` con 200 si la DB responde a `select 1`, y 503 con `db:false` en caso contrario.

### Requirement: Cálculo en servidor
`total`, `max_hourly` y `summary` DEBEN calcularse en la API, nunca delegarse al cliente.
