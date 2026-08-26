# Propuesta: calibración con histórico y estaciones amateur (fase 9)

**Estado**: propuesta (26‑08‑2026) · **Fecha**: 2026‑08‑26

## Por qué

Dos preguntas que el sistema no sabía responder:

1. **¿Sirven los umbrales?** Son los oficiales de la CHJ, pero nadie había mirado si separan lo normal de lo excepcional *en estos puntos*. Un umbral que se supera trescientas horas al año no avisa de nada; uno que no se supera nunca, tampoco.
2. **¿Y el barranc de l'Horteta?** Está fuera del SAIH —la CHJ lo reconoció tras la DANA— y pudo aportar unos 3.500 m³/s en Torrent el 29‑10‑2024. No hay ningún sensor oficial: la única señal posible son las estaciones amateur de AVAMET.

## Qué cambia

1. **Backfill del SAIH** (`pnpm --filter @talaia/collector-saih backfill`): descarga histórico por ventanas de 30 días desde una fecha dada.
2. **Informe de calibración** (`pnpm --filter @talaia/scheduler calibrate`): por sensor vigilado, percentiles, horas por encima de cada umbral, mayores episodios y un veredicto legible.
3. **Collector AVAMET** (`collectors/avamet`): la tabla de precipitación de l'Horta Sud en una petición; las estaciones se dan de alta solas con las coordenadas de su ficha.
4. **La lluvia amateur entra en el semáforo** por cercanía geográfica (`AVAMET_RADIUS_KM`, 8 km), no por una lista escrita a mano.
5. **Filtro de plausibilidad** para caudal y nivel: lo que encontró la calibración obliga a ello (ver abajo).

## Lo que encontró la calibración

Con año y medio de histórico del Poyo, el informe destapó **cinco "episodios" de más de 780 m³/s** que nunca ocurrieron. Los datos crudos del 17‑09‑2025 lo enseñan sin lugar a dudas:

```
05:30 → 0,1 m³/s      05:35 → 855,5     05:55 → 839,5     06:00 → 0,0
```

De 0,1 a 855 m³/s en cinco minutos, sostenido media hora, y de vuelta a cero. Es físicamente imposible —implicaría 1,3 hm³ apareciendo y desapareciendo— y la CHJ marca esas muestras con `estado` normal, así que el semáforo se las creía: **habría dado rojo cinco veces en año y medio sin una gota de lluvia**, con sus cinco notificaciones urgentes. Es la forma más rápida de que nadie vuelva a mirar un aviso.

La defensa distingue el artefacto de la crecida por **cómo llega el valor**, no por cuánto vale: una crecida sube por rampa (en la DANA, unos 65 m³/s cada cinco minutos), un artefacto salta. Un escalón mayor de 250 m³/s queda en cuarentena; si se sostiene una hora se acepta —puede ser una suelta de embalse—, y si vuelve antes, no ha contado nunca.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Dónde filtrar | **Al leer**, no al escribir. `observations` conserva exactamente lo que publicó la CHJ: es lo que permite calibrar y, llegado el caso, reportárselo a ellos |
| 2 | Listón del salto | 250 m³/s por muestra: casi cuatro veces la subida de la peor crecida conocida |
| 3 | Estaciones AVAMET | **Alta automática** por ficha técnica, cinco por ciclo. La red cambia y una lista a mano envejece |
| 4 | Qué guardar de AVAMET | Los acumulados que dicen algo distinto: día, 1 h, 12 h y 24 h. AVAMET ya los calcula |
| 5 | Cómo entra en el semáforo | Por **cercanía** (8 km). Compite con los pluviómetros oficiales por el mismo umbral y el detalle dice siempre que es amateur |
| 6 | Cortesía con AVAMET | Una petición por ciclo para toda la comarca, separación mínima de 1 s, `User-Agent` identificable. Es el servidor de una asociación pequeña |
| 7 | Licencia | AVAMET publica bajo **CC BY‑NC‑ND 4.0**: uso no comercial y **atribución visible**, que se añade al pie del frontend |

## No-objetivos

- Ajustar automáticamente los umbrales: el informe es para que decida una persona.
- Backfill del episodio del 29‑10‑2024 desde el SAIH: el portal **no lo publica**.
- Control de calidad de las estaciones amateur más allá del filtro de plausibilidad.
- MITECO/embalses.net y Copernicus EFAS (ver `docs/fuentes.md`).

## Impacto

- Nuevo paquete `collectors/avamet`, migración `0010_avamet.sql`, dos CLI nuevos.
- `packages/shared` gana `calibration.ts` y `plausibility.ts`; el semáforo cambia cómo elige la lectura de caudal.
- Variables canónicas nuevas: `precip_1h_mm`, `precip_12h_mm`, `precip_day_mm`.
