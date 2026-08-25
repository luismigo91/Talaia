# Capacidad: collector-saih

## ADDED Requirements

### Requirement: Descarga de series cincominutales
El collector DEBE pedir, por cada sensor habilitado del catálogo, `GET https://saih.chj.es/admin/variables/valor/{external_id}/{desde}/{hasta}` con las fechas en formato `YYYY-MM-DD HH:MM` **en hora local `Europe/Madrid`** y URL‑encoded, e interpretar los `fecha` de la respuesta como **UTC**.

#### Scenario: Rango en hora local
- **Dado** `desde=2026-08-24T00:00:00Z` y zona `Europe/Madrid` (UTC+2)
- **Entonces** la URL contiene `2026-08-24%2002:00`, no `2026-08-24%2000:00`.

#### Scenario: Muestra normalizada
- **Dado** `{"valor":2.5,"fecha":"2026-08-23T22:05:00.000Z","estado":128}` para el sensor `saih:13873`
- **Entonces** se escribe `{source:'saih', station_id:'saih:227', variable:'river_flow_m3s', ts:'2026-08-23T22:05:00Z', value:2.5, unit:'m³/s', quality:128}`.

#### Scenario: Valores nulos
- **Dado** una muestra con `valor: null`
- **Entonces** se omite la fila y el resto de la serie se escribe igualmente.

### Requirement: Ventana incremental
La ventana de descarga de cada sensor DEBE empezar en el último `ts` almacenado menos 15 minutos de solape y terminar en el instante actual. Sin dato previo, DEBE empezar `SAIH_BACKFILL_HOURS` horas antes (por defecto 24, máximo 168). Si la ventana resultante es menor de 5 minutos, el sensor se omite en ese ciclo.

#### Scenario: Segunda ejecución
- **Dado** que la última observación de `saih:13873` es de hace 20 min
- **Entonces** la ventana pedida empieza hace 35 min, no hace 24 h.

#### Scenario: Primera ejecución
- **Dado** que no hay observaciones de un sensor
- **Entonces** se piden las últimas 24 h.

#### Scenario: Reescritura de provisionales
- **Dado** que una muestra ya almacenada con `estado=128` se vuelve a descargar con otro valor
- **Entonces** el upsert actualiza `value` y `quality` sin duplicar la fila.

### Requirement: Precipitación horaria derivada
Para los sensores de `precip_rate_mmh`, el collector DEBE derivar `precip_mm` horario como `Σ(valor · 5/60)` sobre las muestras de cada hora UTC completa, exigiendo al menos 10 de las 12 muestras esperadas, con `ts` = inicio de la hora y unidad `mm`.

#### Scenario: Hora completa
- **Dado** 12 muestras de 2,4 mm/h entre las 10:00 y las 10:55 UTC
- **Entonces** se escribe `precip_mm = 2.4` con `ts='…T10:00:00Z'`.

#### Scenario: Hora incompleta
- **Dado** que solo hay 6 muestras de la hora en curso
- **Entonces** no se escribe ninguna fila de `precip_mm` para esa hora.

#### Scenario: La intensidad se conserva
- **Dado** cualquier sensor de lluvia
- **Entonces** además del derivado se escriben las muestras crudas como `precip_rate_mmh` en mm/h.

### Requirement: Aislamiento por sensor y éxito parcial
Un fallo al descargar un sensor NO DEBE impedir la descarga del resto. El collector DEBE devolver los sensores fallidos como aviso, que se registra en `source_status.last_error` **aunque** el ciclo se marque como exitoso. Si fallan todos los sensores habilitados, el ciclo DEBE registrarse como fallo.

#### Scenario: Un sensor caído
- **Dado** que `/admin/variables/valor/13873/…` devuelve 500 y los demás responden
- **Entonces** `last_success_at` se actualiza, `records_written` cuenta las filas escritas y `last_error` menciona `13873`.

#### Scenario: Portal caído
- **Dado** que todas las peticiones fallan
- **Entonces** `last_success_at` no se actualiza y `last_error` describe el fallo.

#### Scenario: Respuesta vacía sospechosa
- **Dado** una ventana de más de 1 h que devuelve `[]`
- **Entonces** el sensor cuenta como aviso (posible cambio de contrato del portal), no como éxito silencioso.

### Requirement: Cortesía con el portal
El cliente DEBE serializar las peticiones del proceso con una separación mínima de 300 ms, timeout de 30 s, un único reintento ante error de red o 5xx, y enviar un `User-Agent` identificable.

#### Scenario: Reintento único
- **Dado** que la primera petición devuelve 503 y la segunda 200
- **Entonces** el sensor se procesa con normalidad y no hay un tercer intento.

### Requirement: Registro de estado
El collector DEBE registrarse en `source_status` con la fuente lógica `saih`, siguiendo el mismo contrato que el resto de collectors (`last_run_at`, `last_success_at`, `records_written`, `last_error`), y no DEBE lanzar excepciones fuera de su ámbito.
