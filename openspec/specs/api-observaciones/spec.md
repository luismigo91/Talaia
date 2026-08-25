# Capacidad: api-observaciones

> Comportamiento **vigente**. Origen: `collector-saih-jucar` (Fase 2: collector SAIH Júcar), archivado el 25‑08‑2026.

## Requirements

### Requirement: Catálogo de sensores con estado
`GET /api/v1/sensors` DEBE devolver los sensores habilitados con `id`, `station` (id, nombre, lat, lon), `variable`, `unit`, umbrales, `last_value`, `last_ts`, `age_seconds` y `level`, donde `level` se calcula **en servidor**: `rojo` si `value ≥ threshold_high`, `naranja` si `≥ threshold_mid`, `amarillo` si `≥ threshold_low`, `verde` en otro caso, y `null` si el sensor no tiene umbrales o no tiene dato.

#### Scenario: Poyo en nivel naranja
- **Dado** `saih:13873` con umbrales 30/70/150 y último valor 80
- **Entonces** `level='naranja'`.

#### Scenario: Sensor de lluvia sin umbrales
- **Dado** un sensor `precip_rate_mmh` con umbrales nulos
- **Entonces** `level` es `null` y el sensor aparece igualmente con su último valor.

#### Scenario: Filtro por variable
- **Dado** `?variable=river_flow_m3s`
- **Entonces** solo se devuelven sensores de caudal.

### Requirement: Serie temporal de observaciones
`GET /api/v1/observations` DEBE aceptar `sensor` (id) o la pareja `station` + `variable`, más `hours` (1–168, por defecto 24), y devolver los puntos ordenados por `ts` ascendente con su `unit` y el rango consultado.

#### Scenario: Serie del Poyo
- **Dado** `?sensor=saih:13873&hours=6`
- **Entonces** se devuelven las muestras de las últimas 6 h con `unit='m³/s'`.

#### Scenario: Parámetros insuficientes
- **Dado** una petición sin `sensor` y sin `station`
- **Entonces** la respuesta es `400`.

#### Scenario: Sensor desconocido
- **Dado** `?sensor=saih:99999`
- **Entonces** la respuesta es `404`.
