# Tareas: histórico de riesgo y notificaciones (fase 4)

## 1. Cálculo compartido
- [x] Mover el cálculo a `packages/shared/src/risk-eval.ts` (`evaluateRisk`); `RiskService` pasa a delegar sin cambiar el contrato de `/api/v1/risk`.

## 2. Estado e histórico
- [x] `db/migrations/0008_risk_history.sql`: `risk_state` y `risk_events`.
- [x] `applyRiskEvaluation()` en shared: histéresis asimétrica, conservación del nivel con datos obsoletos y registro de transiciones.

## 3. Notificación
- [x] `packages/shared/src/notify.ts`: interfaz `Notifier`, implementación ntfy y notificador nulo.
- [x] Envío tras registrar el evento, con `notified` / `notify_error`.

## 4. Integración
- [x] Job `risk` en el scheduler (`RISK_INTERVAL_MIN`), aislado y registrado en `source_status`.
- [x] `GET /api/v1/risk/history`.
- [x] `.env.example` con `NTFY_URL`, `NTFY_TOKEN`, `RISK_INTERVAL_MIN`, `RISK_FALL_CONFIRMATIONS`.

## 5. Tests
- [x] Unitarios de la histéresis (subida inmediata, bajada confirmada, bajada interrumpida, subida durante bajada pendiente).
- [x] Unitarios del notificador (sin canal, canal caído, envío correcto, contenido y prioridad).
- [x] Integración: transiciones en DB, nivel conservado con datos obsoletos, endpoint de histórico.

## 6. Cierre
- [x] Verificación end-to-end: crecida simulada del Poyo → dos avisos urgentes en ntfy; bajada confirmada en tres ciclos; sin datos frescos el nivel se conserva.
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration` en verde.
- [x] `docs/arquitectura.md` y `CLAUDE.md`.
- [x] Archivar y fusionar en `openspec/specs/` (tras validación).
