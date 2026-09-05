# Tareas: calibración y estaciones amateur

- [x] `backfill` del SAIH por ventanas de 30 días y CLI.
- [x] `sensorStats`/`verdict` en `packages/shared` y CLI `calibrate`.
- [x] Histórico real descargado (2025-01 → 2026-08) de los cuatro caudales principales.
- [x] `lastPlausible` con tests sobre el artefacto real del Poyo y sobre una crecida.
- [x] El semáforo usa la última lectura creíble para caudal y nivel.
- [x] `collectors/avamet` con fixtures reales, alta automática de estaciones y job cada 10 min.
- [x] La lluvia amateur cercana entra en el semáforo, marcada como tal.
- [x] Atribución de AVAMET visible en el frontend — `web/src/app/layout.tsx:92` footer global + `web/src/app/page.tsx:99` (implementado 05-09-2026).
- [x] Archivar y fusionar en `openspec/specs/` (tras validación).
