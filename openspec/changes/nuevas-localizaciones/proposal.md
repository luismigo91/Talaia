# Propuesta: nuevas localizaciones — Tortosa, Málaga y Rincón de la Victoria (fase 15)

**Estado**: implementada, pendiente de archivar · **Fecha**: 2026-10-01

## Por qué

El episodio actual también cae sobre les Terres de l'Ebre y la costa de Málaga
(AEMET mantiene hoy "Aviso especial. Chubascos muy fuertes y persistentes" en
los tres municipios). Las tres pueden entrar con lo que ya hay: Open-Meteo
funciona por coordenadas, Meteoalarm cubre sus zonas y la predicción municipal
de AEMET es por INE. Identificadores verificados el 01-10-2026 en las páginas
de AEMET y en el feed vivo de Meteoalarm:

| Localización | INE | Coordenadas | Zona de avisos | Catálogo (EMMA) |
|---|---|---|---|---|
| Tortosa | `43155` | 40.8108, 0.525 | Prelitoral sur de Tarragona | `694305` (`ES193`, ya mapeado) |
| Málaga | `29067` | 36.7203, −4.4197 | Sol y Guadalhorce | `612903` (`ES094`, añadido) |
| Rincón de la Victoria | `29082` | 36.7161, −4.2922 | Axarquía | `612904` (`ES095`, añadido) |

## Qué cambia

1. **Migraciones `0014_tortosa.sql` y `0015_malaga_rincon.sql`**: estaciones
   `virtual:tortosa`, `virtual:malaga` y `virtual:rincon-de-la-victoria`, con
   `ine` y `aemet_zone`. Sin `gva_zones` (no es Comunitat Valenciana) y **sin
   `watch_points`**: el Ebro es de la CHE y Málaga/Rincón de las Cuencas
   Mediterráneas Andaluzas; ningún sensor del catálogo SAIH-Júcar los cubre.
2. **Semáforo honesto con dos señales**: lluvia prevista (6 modelos) + avisos
   oficiales. Sin caudal ni lluvia observada hasta que haya collectors de esos
   SAIH; el verde en calma lleva el aviso de "sin datos evaluables" que ya
   existe.
3. **Mapeo Meteoalarm**: `ES094→612903` y `ES095→612904` (verificados
   emparejando `EMMA_ID` con la zona del `identifier` en el feed de hoy; de
   propina confirman `ES193→694305` de Tortosa).
4. **Conteo 4 → 7** en tests y specs (`/stations`, `/risk`, mapa, collectors).
5. **Lema**: con tres autonomías ya no hay ámbito regional que valga —
   "l'Horta Sud i la Ribera" → **"vigilancia de inundaciones"** (layout,
   manifest, home).
6. **Docs**: `docs/cuencas.md` con las fichas del Ebro, Guadalmedina/Guadalhorce
   y arroyos de la Axarquía, con el hueco declarado; filas en `CLAUDE.md`.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Caudal fuera del Júcar | **Fuera de esta fase**. SAIH del Ebro (CHE) e Hidrosur son otros portales con otros endpoints: cada uno merece su propio collector |
| 2 | Regulación | Mequinenza/Ribarroja (Ebro) regulan como Tous en el Xúquer: aunque hubiera aforo, la lluvia no se traduce en caudal (doctrina de la fase 13) |
| 3 | `watch_points` vacíos | Admitido por el esquema; la spec de `watch-points` se matiza: cobertura de caudal donde hay catálogo SAIH |
| 4 | GVA/AVAMET | No aplican fuera de la Comunitat Valenciana |
| 5 | Lema | Genérico, sin regiones: con 7 localidades en 3 autonomías la lista no cabe en un titular |

## No-objetivos

- Collectors del SAIH del Ebro, Hidrosur ni estaciones amateur catalanas o
  andaluzas.
- Cambiar el mapa: encuadra solo con `fitBounds`, las nuevas entran solas.
