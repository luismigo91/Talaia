# Capacidad: almacenamiento

> Comportamiento **vigente**. Origen: `mvp-comparativa-precipitacion` (MVP: comparativa de precipitación prevista), archivado el 25‑08‑2026.

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
`raw_payloads` DEBE tener política de retención de 7 días y `forecasts` de 365 días.

#### Scenario: Políticas creadas
- **Entonces** `timescaledb_information.jobs` contiene dos `policy_retention`.

### Requirement: Convenciones de tiempo y unidades
Todas las columnas de tiempo DEBEN ser `timestamptz` en UTC; `ts` es el **inicio** del intervalo para variables acumuladas; las unidades DEBEN ser las canónicas (`mm`, `%`, `°C`, `m/s`, `m`, `m³/s`, `hm³`, `hPa`, `J/kg`).
