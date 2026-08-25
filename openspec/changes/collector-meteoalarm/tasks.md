# Tareas: collector Meteoalarm (fase 5)

## 1. Collector
- [x] Paquete `collectors/meteoalarm` con `client.ts`, `zones.ts` (mapa EMMA_ID → zona, generado y verificado), `parse.ts` y `run.ts`.
- [x] Traducción de nivel y tipo al vocabulario de AEMET; descarte de verdes; preferencia de idioma.
- [x] Fixture real recortada del feed con avisos de nuestras zonas.

## 2. Deduplicación
- [x] Helper en `packages/shared` que deduplica avisos por `(area_code, event_code, level, onset, expires)` prefiriendo `aemet`.
- [x] Usarlo en el semáforo (`alertsFor`).

## 3. Integración
- [x] Job `meteoalarm` cada 10 min en el scheduler y target en el Dockerfile.
- [x] `.env.example` (intervalo).

## 4. Tests
- [x] Unitarios sobre la fixture real: filtrado por zona, traducción de zona/tipo/nivel, verdes descartados, idioma.
- [x] Unitarios de la deduplicación (misma alerta en dos fuentes, solo una fuente, alertas distintas).
- [x] Integración: escritura en `alerts` y semáforo alimentado solo por Meteoalarm.

## 5. Cierre
- [x] Ejecución real: 5 avisos de nuestras zonas de entre 512 de España; el de lluvias eleva el semáforo a amarillo y el de temperaturas máximas no.
- [x] Suite completa, lint y formato en verde; ejecución real contra el feed.
- [x] `docs/fuentes.md` (ficha verificada) y `CLAUDE.md`.
- [ ] Archivar y fusionar en `openspec/specs/` (tras validación).
