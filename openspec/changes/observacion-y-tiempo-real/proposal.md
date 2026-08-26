# Propuesta: observación de AEMET y semáforo en vivo (fase 8)

**Estado**: propuesta (26‑08‑2026) · **Fecha**: 2026‑08‑26

## Por qué

Dos huecos que quedaron señalados y sin cubrir:

1. **La tabla `observations` no tenía ninguna fuente oficial de lluvia.** El SAIH da lluvia amateurizada por sus propios pluviómetros, pero la medida de referencia —la de las estaciones automáticas de AEMET— no entraba, así que no había con qué contrastar la precipitación que el collector del SAIH deriva de la intensidad.
2. **El semáforo solo se enteraba de los cambios cuando alguien recargaba.** La página se revalida cada 60 s; un cambio de nivel puede tardar ese minuto en verse aunque la notificación ya haya salido por ntfy.

## Qué cambia

1. **Observación de AEMET** (`collectors/aemet`): estaciones automáticas cercanas (València, Manises, Turís, Llíria, Sollana) → `observations` con `source='aemet:observation'`. La estación se da de alta con las **coordenadas que trae la propia respuesta**, en lugar de con constantes escritas a mano.
2. **Semáforo en vivo**: el ciclo de riesgo publica cada transición con `pg_notify`; la API la reparte por **SSE** (`GET /api/v1/risk/stream`) y el frontend refresca la página al recibirla.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Catálogo de estaciones AEMET | **Autopoblado** desde la respuesta (`lat`, `lon`, `alt`, `ubi`). Escribir a mano las coordenadas de una estación es la forma clásica de colocar un dato a 3 km de donde está |
| 2 | Aviso de cambios | `LISTEN`/`NOTIFY` de Postgres, no sondeo. El semáforo cambia unas pocas veces al año: preguntar cada pocos segundos sería absurdo |
| 3 | Transporte al navegador | **SSE**, no WebSocket: el flujo es de ida y son cuatro eventos al año. Un WebSocket sería infraestructura sin uso |
| 4 | Ruta al navegador | Un route handler en Next hace de tubería, para no romper la regla de que el navegador solo habla con el frontend |
| 5 | Si la API no está | El proxy devuelve un stream vacío y el navegador reintenta con su propio `retry`: la página no se rompe por no tener directo |

## No-objetivos

- Empujar por SSE los datos completos: solo se anuncia el cambio y la página se vuelve a renderizar en el servidor.
- WebSocket bidireccional ni notificaciones del navegador.

## Impacto

- `collectors/aemet` gana `observation.ts` y un job propio; `packages/shared` gana `risk-listen.ts`.
- La API gana `RiskStream` y `/api/v1/risk/stream`; el frontend, un route handler y un componente cliente.
- La observación de AEMET **requiere la clave**: hasta que exista, ese job registrará su error como el resto de fuentes de AEMET.
