# Tareas: retención de series y CI completo

- [x] `db/migrations/0009_retencion.sql`: columnstore y políticas en `observations` y `forecasts` — `add_compression_policy` 30d segmentado por `(source, station_id, variable)`, `add_retention_policy` 3 años para observations.
- [x] Test de integración que comprueba las políticas activas tras migrar — `db/test/migrate.integration.test.ts:51` (retención 7d/365d/3y y compresión 30d).
- [x] CI: `next build` y construcción de las imágenes `api`, `collectors` y `web` — `.github/workflows/ci.yml:37` + `images` matrix sin push.
- [x] Suite completa en verde — `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration` (este último requiere `TALAIA_INTEGRATION=1` + DB).
- [x] Archivar y fusionar en `openspec/specs/` (tras validación) — archivado 05-09-2026 en `almacenamiento`.
