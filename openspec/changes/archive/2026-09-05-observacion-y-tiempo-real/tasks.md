# Tareas: observación de AEMET y semáforo en vivo

- [x] `collectors/aemet/src/observation.ts`, job `aemet-observation` y fixture del formato documentado.
- [x] `pg_notify` en el ciclo de riesgo y `listenRiskChanges` en `packages/shared`.
- [x] `RiskStream` y `GET /api/v1/risk/stream` en la API.
- [x] Route handler `/api/risk-stream` y componente `LiveRefresh` en el frontend.
- [x] Tests unitarios y de integración; verificación real de extremo a extremo del SSE.
- [ ] Capturar fixtures reales de observación cuando haya `AEMET_API_KEY`.
- [x] Archivar y fusionar en `openspec/specs/` (tras validación).
