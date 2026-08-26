# Capacidad: collector-aemet

## ADDED Requirements

### Requirement: Observación de estaciones automáticas
El collector DEBE leer `/api/observacion/convencional/datos/estacion/{idema}` de las estaciones configuradas (`AEMET_OBSERVATION_STATIONS`, por defecto `8416`, `8414A`, `8337X`, `8409X`, `8328X`) y escribir sus filas horarias en `observations` con `source='aemet:observation'`.

#### Scenario: Precipitación de la hora anterior
- **Dado** una fila con `fint='2026-08-25T17:00:00'` y `prec=1.4`
- **Entonces** se escribe `precip_mm=1.4` con `ts='2026-08-25T16:00:00Z'`, el inicio del intervalo.

#### Scenario: `fint` sin sufijo es UTC
- **Dado** `fint='2026-08-25T18:00:00'`
- **Entonces** el instante es `2026-08-25T18:00:00Z`, no hora local.

#### Scenario: Variables ausentes
- **Dado** una fila sin `pres`
- **Entonces** se escriben las demás variables y no se inventa la presión.

### Requirement: Alta automática de la estación
La estación DEBE darse de alta (o actualizarse) con las coordenadas, la altitud y el nombre que vienen en la propia respuesta, y sus variables DEBEN registrarse en `sensors` sin umbrales.

#### Scenario: Posición de la fuente
- **Dado** una respuesta de `8337X` con `lat`, `lon` y `ubi='TURIS'`
- **Entonces** existe `stations` con id `aemet:8337X`, ese nombre y esa posición.

#### Scenario: Sin coordenadas
- **Dado** una respuesta sin `lat`/`lon`
- **Entonces** la estación no se da de alta y el ciclo lo registra como aviso.

### Requirement: Aislamiento por estación
Una estación que falle NO DEBE impedir la lectura de las demás; si fallan todas, el ciclo DEBE registrarse como fallo.
