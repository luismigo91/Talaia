# Tareas: collector SAIH Júcar

## 1. Catálogo (db + shared)
- [x] `db/migrations/0006_saih.sql`: fuente `saih`, tabla `sensors`, estaciones SAIH (UTM 30N → 4326) y sensores de `docs/cuencas.md` con umbrales.
- [x] `packages/shared`: `formatLocal()` en `time.ts`; variables canónicas `precip_rate_mmh`, `precip_24h_mm`, `reservoir_level_m`; tabla `sensors` en el esquema Drizzle; `loadSensors()`; `upsertObservations()` y `latestObservationTs()`.
- [x] `runWithStatus` acepta `warning` y lo escribe en `last_error` conservando el éxito.

## 2. Collector (`collectors/saih`)
- [x] Paquete con `client.ts` (serialización, 300 ms, timeout, reintento único, UA), `parse.ts` (muestras → filas, derivación horaria de lluvia), `run.ts`, `cli.ts`, `index.ts`.
- [x] Ventana incremental por sensor con solape de 15 min y backfill configurable.
- [x] Aislamiento por sensor con aviso agregado.

## 3. Tests
- [x] Fixtures reales en `collectors/saih/fixtures/` (caudal del Poyo, intensidad de lluvia de un episodio, propiedades con umbrales).
- [x] Unitarios: URL en hora local, parseo UTC, nulos, derivación horaria (hora completa / incompleta), ventana incremental, fallo por sensor.
- [x] Integración contra TimescaleDB: catálogo sembrado, upsert idempotente, éxito parcial en `source_status`.

## 4. API
- [x] `GET /api/v1/sensors` con último valor, frescura y `level` por umbrales.
- [x] `GET /api/v1/observations` por `sensor` o `station`+`variable`.
- [x] Tests de integración de ambos endpoints.

## 5. Integración y despliegue
- [x] Job `saih` en el scheduler (`SAIH_INTERVAL_MIN`, por defecto 10).
- [x] `@talaia/collector-saih` en el Dockerfile del servicio `collectors` y en `.env.example`.
- [ ] Desplegar en Dokploy (junto con el pendiente del MVP).
- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde; `run-once` real contra el portal.

## 6. Documentación
- [x] `docs/fuentes.md` y `docs/cuencas.md`: `idVariable` de lluvia descubiertos, unidad de la intensidad, hora local en el request.
- [x] `CLAUDE.md`: estado del proyecto y comando `run-once` del nuevo collector.
- [x] Archivar el cambio y fusionar en `openspec/specs/` (25‑08‑2026).
