# Propuesta: collector SAIH Hidrosur — caudal y lluvia observada en Málaga y Rincón (fase 16)

**Estado**: implementada, pendiente de archivar · **Fecha**: 2026-10-01

## Por qué

Málaga y Rincón entraron en la fase 15 con solo lluvia prevista + avisos: el
riesgo que de verdad las amenaza (Guadalmedina/Guadalhorce y arroyos de la
Axarquía) no se medía. Su SAIH (Hidrosur, Junta de Andalucía,
`redhidrosurmedioambiente.es/saih`) publica sin clave: tablas de última hora
(nivel, caudal, lluvia, embalses) e histórico horario de 48 h por estación.
Verificado el 01-10-2026 con capturas reales en `collectors/hidrosur/fixtures/`.

## Qué cambia

1. **Paquete `collectors/hidrosur`** (cliente + parse + ciclo, job `hidrosur`
   cada `HIDROSUR_INTERVAL_MIN=30`): `resumen/rios` (nivel+caudal), `resumen/
   embalses` (%+hm³) y `grafica/{codigo}` por estación (lluvia horaria y nivel
   48 h). Sin auth; horas locales `Europe/Madrid` → UTC.
2. **Migración `0016_hidrosur.sql`**: fuente, 13 estaciones, sensores
   (`hidrosur:{num}:{variable}`, espejo de `saih:{n}:{variable}`) y
   `watch_points` de Málaga y Rincón.
3. **Umbrales de caudal: sin semilla**. Hidrosur no publica umbrales por
   estación en las tablas; la lluvia usa los globales de AEMET (efecto
   inmediato) y el caudal entra como contexto hasta calibrar con histórico,
   igual que el Poyo en la fase 13.

## Estaciones (n.º Hidrosur, verificado en el visor)

| n.º | Nombre | Rol |
|---|---|---|
| 22 | Málaga - Paseo de la Farola | lluvia local Málaga |
| 120 | Centro Control Limonero | lluvia local Málaga |
| 35 | Coín | lluvia cabecera Guadalhorce |
| 101 | La Araña | lluvia local Rincón |
| 44 | Torrox | lluvia local Rincón |
| 37 | Embalse de la Viñuela | lluvia cabecera Axarquía + volumen |
| 38 | Río Guadalhorce (Cártama) | `flow_primary` Málaga |
| 46 | Aljaima, 127 Bobadilla, 106 Campanillas | secundarios Málaga |
| 43 | Río Benamargosa | `flow_primary` Rincón |
| 104 | Río Grande | secundario Rincón |
| 20 | Limonero, 30 Guadalhorce | volumen (contexto) |

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Ebro | **Fuera**: el portal público de la CHE es un cascarón Liferay sin datos raspables; su Open Data exige clave personal (`saihebro.com/datos/opendata`). Cuando haya `SAIHEBRO_API_KEY`, collector propio |
| 2 | Sufijo del código de gráfica (`R03` vs `R01`) | Se **descubre** en los enlaces de `resumen/rios|embalses` en cada ciclo, no se adivina (`{num}P01` en pluvios sí es regular, con verificación de `sensorTipo`) |
| 3 | `ts` de las tablas de última hora | El "Datos actualizados a" de la propia página (hora local → UTC) |
| 4 | Caudal solo con último dato | La gráfica de río trae nivel, no caudal: `river_flow_m3s` entra con el último valor hasta que haya backfill por "datos a la carta" |
| 5 | Licencia | Dato operativo de administración pública, uso no comercial con atribución en el pie (igual que AVAMET) |

## No-objetivos

- Backfill histórico Hidrosur (queda documentado como pendiente, como el SAIH en la fase 9).
- Umbrales de caudal Hidrosur (calibrar con episodios reales).
- Collector del Ebro.
