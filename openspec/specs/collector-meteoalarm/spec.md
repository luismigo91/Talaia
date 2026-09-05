# Capacidad: collector-meteoalarm

> Comportamiento **vigente**. Origen: `collector-meteoalarm` (Fase 5: avisos oficiales sin clave), archivado el 05-09-2026.

## Requirements

### Requirement: Descarga y filtrado por zona
El collector DEBE descargar `https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain` en **una sola petición**, quedarse con los avisos cuyas áreas correspondan a las zonas de aviso de las localizaciones objetivo, y escribirlos en `alerts` con `source='meteoalarm'` e `id` prefijado con la fuente.

#### Scenario: Solo lo que nos afecta
- **Dado** un feed con avisos de toda España
- **Cuando** se ejecuta el collector
- **Entonces** solo se escriben los de las zonas `774602` y `774604`.

#### Scenario: Una sola petición
- **Dado** cualquier número de localizaciones
- **Entonces** se hace exactamente una petición HTTP al feed.

### Requirement: Traducción de zonas
El collector DEBE traducir el `EMMA_ID` del área a la zona de aviso de AEMET mediante un mapa verificado. Si el `EMMA_ID` no está en el mapa, DEBE intentar extraer el código de zona del `identifier` del aviso, y si tampoco aparece, descartar el área.

#### Scenario: Zona conocida
- **Dado** un área con `EMMA_ID=ES247`
- **Entonces** su `area_code` es `774602`.

#### Scenario: Zona costera de la misma comarca
- **Dado** un área con `EMMA_ID=ES864` ("Costa - Litoral norte de Valencia")
- **Entonces** su `area_code` también es `774602`.

#### Scenario: EMMA_ID desconocido con zona en el identifier
- **Dado** un `EMMA_ID` ausente del mapa y un `identifier` que contiene `.774602PR`
- **Entonces** se usa `774602`.

### Requirement: Traducción al vocabulario de AEMET
El collector DEBE traducir `awareness_level` a `verde|amarillo|naranja|rojo` y `awareness_type` al `event_code` equivalente de AEMET (`10; Rain`→`PR`, `3; Thunderstorm`→`TO`, `11`/`12` inundación→`IN`, `1; Wind`→`VI`, `7; coastalevent`→`CO`), de modo que el semáforo funcione sin cambios.

#### Scenario: Aviso de lluvias
- **Dado** `awareness_type='10; Rain'` y `awareness_level='2; yellow; Moderate'`
- **Entonces** la fila tiene `event_code='PR'` y `level='amarillo'`.

#### Scenario: El semáforo lo entiende
- **Dado** un aviso `PR` naranja vigente en la zona de Albal
- **Entonces** el componente de aviso del semáforo de Albal es `naranja`.

#### Scenario: Tipo desconocido
- **Dado** un `awareness_type` que no está en la tabla
- **Entonces** el aviso se escribe con `event_code` nulo y no eleva el semáforo.

### Requirement: Avisos verdes descartados
Los avisos con nivel `green` NO DEBEN escribirse: "sin aviso" no es un aviso.

#### Scenario: Nivel verde
- **Dado** un aviso con `awareness_level='1; green; Minor'`
- **Entonces** no se escribe ninguna fila.

### Requirement: Idioma y campos
DEBE usarse el bloque `info` en `es-ES` cuando exista (el primero en otro caso), y rellenarse `event`, `headline`, `description`, `onset`, `expires`, `sent` y `parameter`. `geom` DEBE quedar a NULL: el feed no publica polígonos.

#### Scenario: Preferencia de idioma
- **Dado** un aviso con bloques `es-ES` y `en-GB`
- **Entonces** el `event` almacenado está en español.

### Requirement: Deduplicación al leer
Cuando existan avisos equivalentes de varias fuentes —misma `area_code`, `event_code`, `level`, `onset` y `expires`— la lectura DEBE devolver **uno solo**, prefiriendo `aemet` sobre `meteoalarm`.

#### Scenario: Ambas fuentes con el mismo aviso
- **Dado** un aviso `PR` naranja idéntico de `aemet` y de `meteoalarm`
- **Entonces** el semáforo lo cuenta una vez y muestra el de `aemet`.

#### Scenario: Solo Meteoalarm
- **Dado** que solo hay aviso de `meteoalarm` (sin clave de AEMET)
- **Entonces** el semáforo lo usa con normalidad.

#### Scenario: Avisos distintos de la misma zona
- **Dado** un aviso de lluvias y otro de tormentas vigentes en la misma zona
- **Entonces** se devuelven los dos.

### Requirement: Registro de estado
El collector DEBE registrarse en `source_status` bajo la fuente lógica `meteoalarm`, sin lanzar excepciones fuera de su ámbito, igual que el resto de collectors.
