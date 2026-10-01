# Tareas: collector Hidrosur (fase 16)

- [x] Cliente + parse sobre capturas reales (tablas + gráficas R/P/E) con tests unitarios.
- [x] Ciclo `collect` (última hora + históricos 48 h) + CLI `run-once`.
- [x] Migración `0016_hidrosur.sql`: fuente, 14 estaciones, 24 sensores, `watch_points` de Málaga y Rincón.
- [x] Cableado: job `hidrosur` (`HIDROSUR_INTERVAL_MIN=30`), Dockerfiles, `.env.example`, alias Vitest.
- [x] Test de integración contra TimescaleDB con las fixtures.
- [x] Ciclo real contra el portal vivo (306 filas, 0 problemas).
- [x] Docs (`fuentes.md` §9, `cuencas.md`, spec del collector) y propuesta.
- [ ] Verificar en local (typecheck + lint + tests) y archivar.
- Pendiente (otras fases): backfill por "datos a la carta", umbrales de caudal Hidrosur, collector del Ebro (necesita `SAIHEBRO_API_KEY`).
