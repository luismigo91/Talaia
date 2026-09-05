# Capacidad: almacenamiento

> Comportamiento **vigente**. Origen: `mvp-comparativa-precipitacion` (MVP) + `retencion-y-ci` (Fase 7: retención y CI), archivado el 25‑08‑2026 y 05‑09‑2026.

## Requirements

### Requirement: Esquema común en TimescaleDB
La base de datos DEBE ser Postgres 16 con extensiones `timescaledb` y `postgis`, con las tablas `sources`, `stations`, `source_status`, `forecasts`, `observations`, `alerts`, `raw_payloads` definidas en `design.md`. `forecasts`, `observations` y `raw_payloads` DEBEN ser hypertables.

#### Scenario: Migración limpia
- **Dado** una DB vacía
- **Cuando** se ejecuta `db/migrate`
- **Entonces** existen todas las tablas, `timescaledb_information.hypertables` lista las tres, y las semillas contienen `virtual:albal` y las 7 fuentes.

#### Scenario: Migración idempotente
- **Cuando** se ejecuta `db/migrate` dos veces
- **Entonces** la segunda no aplica nada y termina con éxito.

### Requirement: Unicidad de predicciones
`forecasts` DEBE tener clave primaria `(source, station_id, variable, forecast_ts, ts)` y los collectors DEBEN escribir con `on conflict do update`.

#### Scenario: Reinserción
- **Dado** una fila existente
- **Cuando** se inserta la misma clave con otro `value`
- **Entonces** queda una sola fila con el nuevo `value`.

### Requirement: Retención
`raw_payloads` DEBE tener política de retención de 7 días, `forecasts` de 365 días y `observations` de **3 años**.

#### Scenario: Políticas creadas
- **Entonces** `timescaledb_information.jobs` contiene tres `policy_retention` (raw 7d, forecasts 365d, observations 3y).

### Requirement: Políticas de retención y compresión (Fase 7)
Las hypertables DEBEN tener: `raw_payloads` 7 días, `forecasts` 365 días y `observations` **3 años**. `observations` y `forecasts` DEBEN comprimirse en formato columnar a partir de los **30 días**, segmentadas por `(source, station_id, variable)` y ordenadas por `ts` descendente.

#### Scenario: Políticas activas tras migrar
- **Dado** una base recién migrada
- **Entonces** `timescaledb_information.jobs` tiene retención para las tres hypertables y compresión para `observations` y `forecasts`.

#### Scenario: Los upserts recientes no chocan con la compresión
- **Dado** que el collector reescribe muestras provisionales de las últimas horas
- **Entonces** esas filas están en chunks sin comprimir, porque solo se comprime lo anterior a 30 días.

#### Scenario: El histórico sobrevive para calibrar
- **Dado** que el objetivo es ajustar umbrales con episodios pasados
- **Entonces** las observaciones se conservan 3 años, no los 365 días de las predicciones.

### Requirement: CI debe construir frontend e imágenes
El workflow `ci.yml` DEBE ejecutar `pnpm --filter @talaia/web build` y construir las tres imágenes Docker (`api`, `collectors`, `web`) sin publicar, para detectar roturas de empaquetado en el push.

#### Scenario: Build roto
- **Dado** un Dockerfile que no compila
- **Entonces** el job `images` del CI falla.

### Requirement: Convenciones de tiempo y unidades
Todas las columnas de tiempo DEBEN ser `timestamptz` en UTC; `ts` es el **inicio** del intervalo para variables acumuladas; las unidades DEBEN ser las canónicas (`mm`, `%`, `°C`, `m/s`, `m`, `m³/s`, `hm³`, `hPa`, `J/kg`).
