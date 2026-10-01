# Propuesta: preaviso de escalada del semáforo (fase 14)

**Estado**: implementada, pendiente de archivar · **Fecha**: 2026-10-01

## Por qué

El semáforo describe la situación **actual**: solo entran los avisos con
`onset <= now < expires` (`risk-eval.ts`, `alertsFor`). Un rojo que empieza a
las 18:00 no existe para el semáforo hasta las 18:00: la subida de hoy
(amarillo → naranja a las 14:00, → rojo a las 18:00) se notificó en el
momento, sin preaviso. Los datos para anticiparlo ya están en la tabla
`alerts` (los collectors guardan `onset` futuro tal cual lo publica
Meteoalarm/AEMET).

## Qué cambia

1. **`upcoming_alerts` en `GET /api/v1/risk`**: avisos de la zona con
   `onset > now` (y `expires > now`), ordenados por inicio, con `onset`.
   Solo lectura: el nivel actual no se toca.
2. **`next_change` en `GET /api/v1/risk`**: el primer instante futuro (≤ 72 h)
   en que el máximo de avisos deja el nivel actual distinto: `{ at, level,
   direction: sube|baja, reason: "aviso oficial" }`, o `null` si no hay
   ninguno. Vale en las dos direcciones: un rojo futuro (sube) y un rojo que
   vence dejando un naranja vigente (baja).
3. **Web**: la tarjeta de la home y la página `/l/{id}` muestran
   "Próximo: sube a rojo a las 01/10 18:00" (hora de Madrid). Sin preaviso no
   se muestra nada.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | ¿El preaviso mueve el nivel? | **No**. Informa, no decide (misma doctrina que la tendencia entre corridas y el techo naranja del `flow_projected`) |
| 2 | ¿Notifica por push/ntfy? | **No**. Solo pantalla. Un push por cada aviso futuro sería justo el ruido que se quiere evitar; el cambio real ya notifica |
| 3 | ¿Qué avisos cuentan? | Solo los de inundación (`PR`/`TO`/`IN`), como el nivel actual. Un viento futuro no preavisa nada |
| 4 | Horizonte | 72 h. Meteoalarm rara vez publica más allá de 48 h; más lejos es ruido |
| 5 | Suelo no-avisos | El `next_change` supone que caudal/lluvia se quedan como están (su máximo actual como suelo). Es una estimación sobre avisos, y el `reason` lo dice |
| 6 | Deduplicación | La misma que al leer vigentes (`dedupeAlerts` por área, evento, nivel, inicio y fin, prefiriendo AEMET) |

## No-objetivos

- Predecir la escalada por lluvia/caudal medidos (eso ya lo hacen la
  tendencia y el `flow_projected`, cada uno por su lado).
- Notificar el preaviso ni registrarlo en `risk_events`: no es un cambio de
  nivel.
- Mostrar avisos futuros en el mapa/badge: solo tarjeta de home y detalle.
