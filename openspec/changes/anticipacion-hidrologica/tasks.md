# Tareas: anticipación hidrológica

- [x] Backfill del SAIH (caudal del Poyo y ramblas del Túria + pluviómetros de cabecera, 2025‑01 → hoy) en una DB local para calibrar.
- [x] `runoff.ts` en `packages/shared`: serie horaria de lluvia de cabecera, retardo por correlación cruzada, ajuste log‑log y proyección; tests unitarios sobre series sintéticas y sobre un episodio real.
- [x] Migración `0013_runoff.sql`: tabla `runoff_models`. **Sin semilla**: el histórico no tiene ninguna crecida del Poyo (ver propuesta).
- [x] CLI `calibrate-runoff` (informe; `--apply` escribe la fila).
- [x] Componente `flow_projected` en `evaluateRisk`, con techo en naranja y tests de integración.
- [x] Tendencia entre corridas en `rain_forecast` (`trend`, detalle) con tests unitarios e integración.
- [x] `GET /api/v1/forecast-runs` con test de integración.
- [x] Frontend: tabla de corridas y flecha de tendencia en `/l/{id}`; etiqueta del nuevo componente.
- [x] Documentación: `docs/arquitectura.md` §7, `docs/cuencas.md`, README, `.env.example` (`RISK_TREND_GAP_HOURS`).
- [ ] Verificar en local con datos reales y archivar.
