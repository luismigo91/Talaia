# Capacidad: catalogo-sensores

> Comportamiento **vigente**. Origen: `collector-saih-jucar` (Fase 2: collector SAIH Júcar), archivado el 25‑08‑2026.

## Requirements

### Requirement: Tabla `sensors`
El sistema DEBE almacenar el catálogo de sensores externos en una tabla `sensors` con `id`, `source`, `station_id` (FK a `stations`), `external_id`, `variable` canónica, `unit`, `enabled`, `threshold_low/mid/high`, `meta` y unicidad de `(source, external_id, variable)`.

#### Scenario: Sensor deshabilitado
- **Dado** un sensor con `enabled=false`
- **Cuando** el collector carga el catálogo
- **Entonces** ese sensor no se descarga ni aparece en `GET /api/v1/sensors`.

#### Scenario: Alta de sensor sin desplegar
- **Dado** un `insert` en `sensors` con un `external_id` nuevo y `station_id` existente
- **Entonces** el siguiente ciclo del collector lo descarga sin cambios en el código ni reinicio.

### Requirement: Estaciones SAIH sembradas
La migración DEBE sembrar la fuente `saih` y las estaciones de `docs/cuencas.md` en `stations` con `source='saih'`, `kind` ∈ `gauge|reservoir|rain_gauge`, id `saih:<idEstacionRemota>` y geometría obtenida con `ST_Transform(ST_SetSRID(ST_Point(x, y), 25830), 4326)` a partir de las coordenadas UTM 30N del portal.

#### Scenario: Geometría en WGS84
- **Dado** el marco de control del Poyo (UTM 30N `x=708.482, y=4.371.960` aprox.)
- **Entonces** `ST_Y(geom)` ≈ 39,47 y `ST_X(geom)` ≈ −0,58, coherente con `docs/fuentes.md`.

#### Scenario: Convivencia con estaciones virtuales
- **Dado** que existen `virtual:albal` y `saih:227`
- **Entonces** `loadVirtualStations()` sigue devolviendo solo las cuatro localizaciones objetivo.

### Requirement: Umbrales oficiales
Los sensores de caudal y nivel DEBEN llevar los umbrales `fldFUmbralBajo/Medio/Alto` publicados por la CHJ. Los de lluvia DEBEN quedar con umbrales nulos (el portal no los define).

#### Scenario: Umbrales del Poyo
- **Dado** el sensor `saih:13873`
- **Entonces** `threshold_low=30`, `threshold_mid=70` y `threshold_high=150`.
