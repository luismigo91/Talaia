# Propuesta: collector Meteoalarm (fase 5) — avisos oficiales sin clave

**Estado**: propuesta (25‑08‑2026) · **Fecha**: 2026‑08‑25 · **Depende de**: `semaforo-riesgo`

## Por qué

De las cuatro señales del semáforo, la de **avisos oficiales es la única que hoy no funciona**: depende de `AEMET_API_KEY`, que aún no existe en el entorno. Las otras tres (caudal, lluvia observada, lluvia prevista) llevan días alimentándose solas.

Meteoalarm republica los avisos de AEMET **sin clave ni cuota**. Integrarlo cierra el semáforo entero sin esperar a la clave, y de paso deja una segunda vía cuando la haya: si AEMET OpenData falla o agota cuota, los avisos siguen llegando.

## Qué cambia

1. **Collector `collectors/meteoalarm`**: descarga `https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain` (JSON, un solo GET), filtra por las zonas de las localizaciones objetivo y escribe en `alerts` con `source='meteoalarm'`.
2. **Traducción al vocabulario de AEMET**, para que el semáforo no necesite cambio alguno:
   - `EMMA_ID` (`ES247`) → zona de aviso de AEMET (`774602`), con una tabla de 128 zonas extraída del propio feed y verificada cruzándola con el código de zona que va dentro del `identifier`.
   - `awareness_type` (`10; Rain`) → `event_code` de AEMET (`PR`), de modo que el filtro de inundación (`PR|TO|IN`) funciona igual.
   - `awareness_level` (`2; yellow; Moderate`) → `verde|amarillo|naranja|rojo`.
3. **Deduplicación en lectura**: cuando AEMET y Meteoalarm publiquen el mismo aviso, el semáforo y la API se quedan con **uno**, prefiriendo AEMET.
4. **Job `meteoalarm`** en el scheduler cada 10 min.

## La duplicación, y por qué se resuelve al leer

Los `identifier` de ambas fuentes **no coinciden** en formato (AEMET: `…ES.20261025120000.774602PRP2251912`; Meteoalarm: `…ES.260820093609.774602PRP1230889928`), así que no se puede confiar en que la misma alerta caiga en la misma fila. Y no puede comprobarse contra AEMET real hasta que haya clave.

Se escriben, por tanto, las dos filas —cada una con su procedencia, que es información real— y se deduplica **al leer**, por la clave lógica `(area_code, event_code, level, onset, expires)`, prefiriendo `aemet`. Hacerlo al escribir obligaría a que el resultado dependiera del orden en que corren los collectors, que es exactamente el tipo de acoplamiento que el proyecto evita entre fuentes.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Feed | **API v1 JSON** (`feeds-spain`). El Atom legado queda documentado como alternativa: mismo contenido, más difícil de parsear |
| 2 | Zonas | Mapa `EMMA_ID → zona AEMET` de 128 entradas, **generado del feed y verificado** contra el código incrustado en el `identifier` (0 conflictos). Con respaldo: si un `EMMA_ID` no está en el mapa, se intenta extraer la zona del `identifier` |
| 3 | Vocabulario | Se traduce al de AEMET (`event_code`, niveles en español) en el normalizador. El semáforo no se entera de que existe Meteoalarm |
| 4 | Duplicados | Se resuelven **en lectura**, prefiriendo AEMET (es el origen y trae polígonos) |
| 5 | Geometría | Meteoalarm **no publica polígonos**: `geom` queda a NULL. El aviso se localiza por zona, como ya hace el semáforo |
| 6 | Avisos verdes | Se descartan, igual que en AEMET: "sin aviso" no es un aviso |
| 7 | Idioma | Se toma el bloque `info` en `es-ES`; si no está, el primero |

## No-objetivos

- Sustituir al collector de AEMET: cuando haya clave, AEMET manda (trae polígonos y llega antes).
- Avisos de otros países, aunque el feed tenga uno por país.
- Notificar avisos por sí mismos: entran al semáforo como una señal más y este ya decide qué notificar.

## Impacto

- Nuevo paquete `collectors/meteoalarm` (+ fixtures reales), nuevo job, nueva entrada en el Dockerfile.
- `alerts` gana filas con `source='meteoalarm'`; sin cambios de esquema.
- Un helper de deduplicación en `packages/shared`, usado por el semáforo.
