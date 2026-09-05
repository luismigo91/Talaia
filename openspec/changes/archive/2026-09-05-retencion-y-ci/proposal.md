# Propuesta: retención de series y CI completo (fase 7)

**Estado**: propuesta (26‑08‑2026) · **Fecha**: 2026‑08‑26

## Por qué

Dos agujeros de fondo, ninguno urgente hoy y los dos caros de arreglar tarde:

1. **`observations` crece sin límite.** El SAIH escribe unas 16.000 filas al día (57 sensores × 288 muestras). Al año son ~6 millones, y nadie ha decidido qué pasa con ellas. `forecasts` y `raw_payloads` sí tienen política; las observaciones se quedaron sin ella.
2. **El CI no ve el frontend ni las imágenes.** Ejecuta lint, typecheck y tests, pero no `next build` ni la construcción de los targets de Docker. Un fallo de build de producción no aparecería hasta el despliegue, que es exactamente donde no se quiere descubrir.

## Qué cambia

1. **Compresión columnar** (`columnstore` de TimescaleDB) en `observations` y `forecasts` a partir de los 30 días, segmentando por `(source, station_id, variable)`.
2. **Retención de `observations`: 3 años.** No menos: el objetivo del proyecto es calibrar umbrales con episodios reales, y esos episodios son justamente el histórico.
3. **CI**: `next build` del frontend y construcción de las tres imágenes (`api`, `collectors`, `web`) en cada push, sin publicar.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Retención de observaciones | **3 años**. Comprimidas ocupan poco y son la materia prima de la calibración |
| 2 | Cuándo comprimir | A los **30 días**: los upserts del collector reescriben datos recientes (solape de 15 min y muestras provisionales), y así nunca tocan un chunk comprimido |
| 3 | Segmentación | Por `(source, station_id, variable)`, que es como se consulta siempre (una serie de un sensor) |
| 4 | API de compresión | `add_compression_policy`, no `add_columnstore_policy`: la segunda es un **procedimiento** y el migrador aplica cada fichero dentro de una transacción |
| 5 | Imágenes en CI | Se **construyen** pero no se publican: no hay registro, Dokploy construye desde el repo. El valor es detectar que el Dockerfile sigue funcionando |

## No-objetivos

- Agregados continuos (`continuous aggregates`) para consultas rápidas: aún no hay volumen que lo justifique.
- Publicar imágenes en un registro; sigue vigente la decisión de no usarlo.
- Cambiar la retención de `forecasts` (365 días) ni de `raw_payloads` (7 días).

## Impacto

- Migración `0009_retencion.sql`; sin cambios de esquema ni de código de aplicación.
- CI más lento (construye tres imágenes), a cambio de detectar roturas de empaquetado en el push y no en el despliegue.
