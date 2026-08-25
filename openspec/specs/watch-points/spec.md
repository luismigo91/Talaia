# Capacidad: watch-points

> Comportamiento **vigente**. Origen: `semaforo-riesgo` (Fase 3: semáforo de riesgo), archivado el 25‑08‑2026.

## Requirements

### Requirement: Tabla `watch_points`
El sistema DEBE almacenar la relación localización → sensores vigilados en una tabla `watch_points` con `station_id` (FK a `stations`), `sensor_id` (FK a `sensors`), `role` ∈ `flow_primary|flow_secondary|reservoir|rain_upstream|rain_local`, `lag_minutes` opcional y `note`, con clave primaria `(station_id, sensor_id)`.

#### Scenario: Cobertura de las cuatro localizaciones
- **Dado** el catálogo sembrado
- **Entonces** cada estación virtual tiene al menos un `flow_primary` y un sensor de lluvia.

#### Scenario: Poyo compartido
- **Dado** que Albal y Benetússer dependen del mismo aforo
- **Entonces** `saih:13873` es `flow_primary` de ambas.

#### Scenario: Alta sin desplegar
- **Dado** un `insert` en `watch_points` con un sensor existente
- **Entonces** la siguiente petición a `/api/v1/risk` ya lo tiene en cuenta.

### Requirement: Sensores derivados en el catálogo
La precipitación horaria derivada DEBE existir como fila en `sensors` con `meta.derived_from` = `external_id` de la intensidad de la que procede, y `loadSensors()` DEBE excluir los sensores derivados salvo que se pidan explícitamente.

#### Scenario: El collector no descarga derivados
- **Dado** el catálogo con sensores derivados
- **Cuando** el collector SAIH carga su lista
- **Entonces** no aparece ningún sensor con `meta.derived_from` y el número de peticiones al portal no cambia.

#### Scenario: La API sí los muestra
- **Dado** `GET /api/v1/sensors?variable=precip_mm`
- **Entonces** se devuelven los pluviómetros con su precipitación horaria.

### Requirement: Umbrales configurables
El sistema DEBE almacenar en `thresholds` los umbrales de lluvia prevista y observada, con `signal`, `level_yellow/orange/red`, `station_id` opcional (NULL = regla global) y `meta.source` con la procedencia de la cifra. Una fila con `station_id` DEBE tener prioridad sobre la global de la misma señal.

#### Scenario: Umbrales oficiales sembrados
- **Dado** el catálogo sembrado
- **Entonces** `observed_precip_1h` = 20/40/90 y `observed_precip_12h` = 60/100/180, con `meta.source` citando el Anexo 1 del Plan Meteoalerta.

#### Scenario: Sobrescritura por localización
- **Dado** una fila de `observed_precip_1h` con `station_id='virtual:albal'` y amarillo 15
- **Entonces** Albal usa 15 y el resto de localizaciones siguen con 20.
