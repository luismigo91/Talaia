# Propuesta: collector SAIH Júcar (fase 2) — observación hidrológica en tiempo real

**Estado**: propuesta (25‑08‑2026) · **Fecha**: 2026‑08‑25 · **Depende de**: `mvp-comparativa-precipitacion`

## Por qué

El MVP solo sabe lo que **va a llover**. El riesgo real de inundación en las cuatro localizaciones se mide por lo que **está bajando por el cauce**: el 29‑10‑2024 el barranc del Poyo pasó de ~0 a ~2.230 m³/s en menos de tres horas, y el único aforo de toda la cuenca (Riba‑roja, variable `13873`) lo estaba publicando cada cinco minutos. Sin esa serie no hay semáforo posible.

El SAIH Júcar es además la fuente con **más riesgo de romperse**: endpoints internos sin documentar bajo `/admin/`, sin autenticación y sin contrato. Conviene integrarla pronto, con fixtures reales y estado de frescura visible, para detectar el día que cambie.

## Qué cambia

1. **Catálogo de sensores como datos** (`db/migrations/0006_saih.sql`): nueva tabla `sensors` (sensor externo → variable canónica, unidad y umbrales oficiales de la CHJ) y siembra de las estaciones SAIH de `docs/cuencas.md` en `stations` (`source='saih'`). Añadir un sensor es una fila, no un despliegue — misma convención que las localizaciones objetivo.
2. **Collector SAIH** (`collectors/saih`): lee el catálogo, descarga la serie cincominutal de cada sensor habilitado desde `GET /admin/variables/valor/{idVariable}/{desde}/{hasta}` con ventana **incremental** (desde el último dato almacenado) y escribe en `observations`.
3. **Lluvia derivada**: la intensidad cincominutal (`precip_rate_mmh`, mm/h) se agrega a **precipitación horaria** (`precip_mm`), que es la variable con la que ya se comparan AEMET y Open‑Meteo. Esto habilita por primera vez la comparación *predicción vs. observación*.
4. **Variables canónicas nuevas**: `precip_rate_mmh` (mm/h), `precip_24h_mm` (mm, acumulado móvil de 24 h) y `reservoir_level_m` (m, cota de embalse).
5. **Éxito parcial en `source_status`**: `runWithStatus` acepta un aviso (`warning`) para que un ciclo que escribió datos pero perdió algún sensor se registre como éxito **con** el problema visible en `last_error`.
6. **API**: `GET /api/v1/sensors` (catálogo con último valor, frescura y nivel de umbral) y `GET /api/v1/observations` (serie temporal de un sensor o de una estación+variable).
7. **Scheduler**: nuevo job `saih` cada 10 min (`SAIH_INTERVAL_MIN`), aislado como los demás.

## No-objetivos (explícitos)

- **Semáforo de riesgo y `watch_points`** (localización → sensores a vigilar): fase 3, tal como fija `docs/cuencas.md`. Aquí se dejan los umbrales sembrados y expuestos, pero no se calcula ningún nivel de riesgo por localidad.
- Frontend, notificaciones, WebSocket.
- Meteoalarm, GVA, embalses.net, EFAS, AVAMET.
- Backfill histórico masivo (el portal no publica la DANA del 29‑10‑2024; la retención pública empieza en ~01‑2025).
- Descubrimiento automático del catálogo: los `idVariable` se fijan en la migración tras verificarlos a mano contra el portal.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Endpoint de series | `GET /admin/variables/valor/{id}/{desde}/{hasta}`, uniforme para caudal, nivel, embalses y lluvia. `/lluviasIntervalo` se descarta: solo da acumulados diarios |
| 2 | Zona horaria del request | El rango de la URL va en **hora local `Europe/Madrid`**; la respuesta viene en UTC (verificado 25‑08‑2026). Se añade `formatLocal()` a `packages/shared` |
| 3 | Lluvia | Intensidad cincominutal (`fkNFuncion=12`) como fuente primaria; el acumulado 24 h (`fkNFuncion=91`) se guarda como contexto. `precip_mm` horario **derivado** de la intensidad |
| 4 | Unidad de la intensidad | **mm/h**, cuantizada en múltiplos de 2,4 (cazoleta de 0,2 mm por 5 min). Verificado contra el acumulado 24 h del episodio del 5‑6‑03‑2026: Σ(v·5/60) = 27,8 mm vs 29,2 mm publicados |
| 5 | Granularidad de `source_status` | Una fila global `saih`, con los sensores caídos listados en `last_error` aunque el ciclo tenga éxito |
| 6 | Umbrales | Sembrados desde `/api/variables/{id}/propiedades` (`fldFUmbralBajo/Medio/Alto`) en la migración. Las variables de lluvia no tienen umbrales en el portal |
| 7 | Coordenadas | Las estaciones se siembran en UTM 30N ETRS89 y se convierten con `ST_Transform(…, 4326)` en SQL: la conversión no entra en el código de aplicación |
| 8 | Cuota | No documentada. Cliente serializado con separación mínima de 300 ms y un reintento; ciclo cada 10 min |
| 9 | `estado` de la muestra | Se guarda en `observations.quality` tal cual (0 normal, 128 provisional). No se descartan muestras provisionales: en el Poyo son la norma |

## Impacto

- Nuevas carpetas: `collectors/saih` (+ `fixtures/`), migración `db/migrations/0006_saih.sql`.
- Cambios en existentes: `packages/shared` (`time.ts`, `units.ts`, `status.ts`, nuevo `observations.ts` y `sensors.ts`), `collectors/scheduler`, `api` (dos controladores nuevos), `docs/fuentes.md` y `docs/cuencas.md` (`idVariable` de lluvia descubiertos).
- Sin dependencias nuevas.
- Riesgo principal: los endpoints `/admin/` pueden cerrarse sin aviso. Mitigación: fixtures reales, `source_status` visible y fallo aislado por sensor.
