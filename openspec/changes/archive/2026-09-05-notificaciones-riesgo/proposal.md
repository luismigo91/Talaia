# Propuesta: histórico de riesgo y notificaciones (fase 4)

**Estado**: propuesta (25‑08‑2026) · **Fecha**: 2026‑08‑25 · **Depende de**: `semaforo-riesgo`

## Por qué

El semáforo ya existe, pero **solo responde si alguien pregunta**. El 29‑10‑2024 el Poyo pasó de ~0 a ~2.230 m³/s entre las 16:00 y las 18:50: el valor de un sistema como este está en avisar *durante* esas tres horas, no en poder consultarlo después. Para eso hacen falta dos cosas que hoy no están: **evaluar el riesgo periódicamente** (no solo al recibir una petición) y **recordar el nivel anterior**, porque lo que se notifica no es un nivel, es un **cambio** de nivel.

El histórico sirve además para lo que el proyecto necesita a medio plazo: calibrar los umbrales con episodios reales, ya que el SAIH no publica la DANA y no hay con qué calibrar hacia atrás.

## Qué cambia

1. **El cálculo del riesgo se muda a `packages/shared`**: hoy vive en el `RiskService` de la API y el scheduler no puede usarlo. Pasa a `evaluateRisk()` en el paquete compartido; el servicio de NestJS queda como envoltorio delgado. Un solo sitio donde se calcula el riesgo, que es lo que promete `docs/arquitectura.md`.
2. **`risk_state`** (nivel actual por localización, con desde cuándo) y **`risk_events`** (histórico de transiciones, con el desglose que las justificó).
3. **Job `risk` en el scheduler**, cada 5 min: evalúa, compara con el estado anterior, registra la transición y dispara la notificación.
4. **Histéresis asimétrica**: las **subidas** de nivel se notifican de inmediato; las **bajadas** necesitan `RISK_FALL_CONFIRMATIONS` evaluaciones consecutivas (3 por defecto, ~15 min). Un semáforo que parpadea entre amarillo y verde cada cinco minutos deja de leerse a los diez.
5. **Notificador desacoplado**: interfaz `Notifier` con implementación para **ntfy** (`NTFY_URL`, sin clave, natural en un homelab). Sin configurar, el sistema registra la transición y no envía nada: nunca falla por no tener canal.
6. **`GET /api/v1/risk/history`**: transiciones recientes, por localización o todas.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Qué se notifica | **Transiciones**, no niveles. Un naranja que sigue naranja no genera nada |
| 2 | Bajadas | Con histéresis (3 confirmaciones). Las subidas, inmediatas: en una crecida, cinco minutos importan |
| 3 | Canal | **ntfy** por HTTP POST, configurable por entorno. Web Push queda para cuando exista el frontend |
| 4 | Fallo del canal | Nunca tumba el ciclo: la transición se registra igualmente y el evento queda con `notified=false` |
| 5 | Dónde se evalúa | En el **scheduler**, cada 5 min. La API sigue calculando al vuelo para `/risk`; ambas usan la misma función |
| 6 | Contenido del aviso | Localidad, nivel nuevo y anterior, y el `detail` del componente que manda. Un aviso que no dice por qué obliga a abrir el móvil |
| 7 | Datos obsoletos | Una localización con todos sus datos obsoletos **no** genera transición a verde: se registra la advertencia y se mantiene el nivel |

## No-objetivos

- Frontend y Web Push.
- Notificaciones por umbral de *predicción* a horizonte largo (solo cambia el semáforo).
- Silenciado por horario, agrupación o política de reenvío periódico mientras dure el nivel.
- Calibración de umbrales con el histórico (necesita episodios que aún no han ocurrido).

## Impacto

- Nuevas tablas `risk_state` y `risk_events`; nuevo módulo `packages/shared/src/risk-eval.ts` y `notify.ts`; nuevo job en el scheduler; un endpoint más.
- El `RiskService` de la API pasa a delegar (sin cambio de contrato en `/api/v1/risk`).
- Sin dependencias nuevas.
