# Capacidad: collector-gva

> Comportamiento **vigente**. Origen: `collector-gva` (Fase 10: GVA Emergències), archivado el 05-09-2026.

## Requirements

### Requirement: Lectura de emergencias por zona
El collector DEBE leer `/external/api/storage/descargar/json/emergencias` de `wpr.112cv.gva.es` en una sola petición y quedarse con los avisos de las zonas de emergencia de las localizaciones objetivo (`meta.gva_zones`), escribiéndolos en `alerts` con `source='gva'`.

#### Scenario: Sin emergencias
- **Dado** una respuesta con `z2` vacío
- **Entonces** no se escribe ninguna fila.

#### Scenario: Zona vigilada
- **Dado** `z2` con la zona `28` (L'Horta Sud) en Situación 1 por Inundaciones
- **Entonces** se escribe un aviso `source='gva'`, `area_code='28'`, `level='naranja'`, `event_code='IN'`.

#### Scenario: Zona ajena
- **Dado** un aviso en una comarca que no vigilamos
- **Entonces** no se escribe.

### Requirement: Traducción de fase y fenómeno
La fase (`sit`) DEBE traducirse a `verde|amarillo|naranja|rojo` (SIT 0→amarillo, 1→naranja, 2 y 3→rojo) y el fenómeno (`fen`) al `event_code` de AEMET (`10`→`IN`, `15`→`TO`, …). Los avisos verdes NO DEBEN escribirse.

#### Scenario: Situación grave
- **Dado** una zona en Situación 2
- **Entonces** el nivel es `rojo`.

#### Scenario: Fenómeno desconocido
- **Dado** un `fen` que no está en la tabla
- **Entonces** el aviso se escribe con `event_code` nulo y no eleva el semáforo.

### Requirement: Vigencia inferida
Como la GVA no publica fecha de fin, `expires` DEBE fijarse a `now + GVA_TTL_MINUTES` (30 por defecto) y `onset` al `time` del feed. Un aviso que reaparece en ciclos sucesivos DEBE refrescar la misma fila (id determinista); uno que desaparece de `z2` DEBE caducar solo.

#### Scenario: Refresco
- **Dado** el mismo aviso en dos ciclos seguidos
- **Entonces** hay una sola fila y su `expires` se ha renovado.

#### Scenario: Caducidad
- **Dado** que un aviso deja de aparecer en `z2`
- **Entonces** pasado el TTL ya no cuenta como vigente.

### Requirement: Registro de estado
El collector DEBE registrarse en `source_status` bajo `gva`, sin lanzar fuera de su ámbito.
