# Cuencas de amenaza por localización

Para cada localización objetivo: qué cauces pueden dañarla, qué sensores del SAIH Júcar hay aguas arriba (con `idVariable` y umbrales oficiales de la CHJ), qué pluviómetros importan y el contexto histórico. Todo lo marcado ✅ está verificado contra `saih.chj.es` el 25‑08‑2026 (ver `docs/fuentes.md` §3 para los endpoints). Umbrales = amarillo/naranja/rojo en m³/s.

Esta tabla es la semilla de la futura tabla `watch_points` (localización → sensores a vigilar) que alimentará el semáforo (fase 3). Los sensores en sí ya están sembrados en la tabla `sensors` y los recoge el collector SAIH.

---

## 1. Albal (`virtual:albal`) — barranc del Poyo

**Cauces**: rambla/barranc del **Poyo** (cuenca ~380 km², cabecera en Siete Aguas–Chiva–Cheste), que recibe el barranc de l'**Horteta** (Torrent) y el del **Gallego** (Picanya) y desagua en l'Albufera pasando por Torrent, Picanya, Paiporta, Benetússer, Catarroja, Albal y Massanassa. Sin regulación (no hay embalses).

| Vigilar | Estación | `idVariable` | Umbrales | Nota |
|---|---|---|---|---|
| Caudal Poyo en Riba‑roja (N‑III) ✅ | 227 `0O04` | **13873** | 30 / 70 / 150 | Único aforo de toda la cuenca; caudal estimado; sensor provisional post‑DANA |
| Lluvia Chiva ✅ | 371 `0P09` | **14079** intensidad, 15311 (24 h) | — | Cabecera |
| Lluvia Siete Aguas ✅ | 232 `7P12` | **13693** intensidad, 15107 (24 h) | — | Cabecera |
| Lluvia Turís ✅ | 789 `7R04` | **16922** intensidad, 16927 (24 h) | — | Divisoria Poyo/Magro; 771 mm el 29‑10‑2024 |
| Lluvia Picassent (Parada 14) ✅ | 238 `0L02` | **14965** intensidad, 14970 (24 h) | — | Tramo bajo |
| Lluvia Tancat de la Pipa ✅ | 802 `0P11` | **16906** intensidad, 16912 (24 h) | — | Albufera, lluvia local |

**Huecos** ✅: nada en Horteta, Gallego, Torrent, Paiporta, Catarroja ni golas. La CHJ admitió tras la DANA que l'Horteta (que pudo aportar ~3.500 m³/s en Torrent) está fuera del SAIH. El tiempo de respuesta entre lluvia en Chiva y crecida en Riba‑roja fue de ~2 h el 29‑10‑2024 (de ~0 a ~2.230 m³/s entre las 16:00 y las 18:50).

**Referencias físicas**: capacidad del encauzamiento bajo Paiporta 800 m³/s (BOE‑A‑2012‑193); último dato del sensor en la DANA 2.283 m³/s (18:55); pico estimado ~2.800 m³/s ❓.

**Relación lluvia‑caudal** (fase 13, 11‑09‑2026): con todo el histórico publicado por el SAIH (2025‑01 → 2026‑09) **el aforo de Riba‑roja no ha registrado ninguna crecida**: 0,0–0,3 m³/s con 97 mm en Siete Aguas (05‑03‑2025, ≤ 11 mm/h) y 1,9 m³/s con 85 mm en un día sobre el propio aforo (28‑12‑2025). La rambla solo responde a convección intensa, y no ha habido ninguna en el periodo. Por eso `runoff_models` no tiene fila para el Poyo: el componente `flow_projected` se activará con `calibrate-runoff --apply` tras el primer episodio real.

---

## 2. Benetússer (`virtual:benetusser`) — barranc del Poyo, tramo bajo

Misma cuenca que Albal, un tramo aguas arriba (Paiporta → Benetússer → Catarroja). Aplican los mismos sensores y huecos. Diferencia: Benetússer está más cerca de la confluencia Horteta/Gallego, por lo que la señal de Riba‑roja (13873) llega con menos margen y **no** captura lo que aporta l'Horteta. Para Benetússer los pluviómetros de cabecera (Chiva 371, Siete Aguas 232) y las estaciones AVAMET de Torrent (`c16m244e03`, `c16m244e01`) y Paiporta (`c16m186e02`) son la única señal de la subcuenca del Horteta.

---

## 3. Mareny de Barraquetes (`virtual:mareny-barraquetes`) — Xúquer bajo, Albufera y marjal

**Cauces**: el **Xúquer** (desembocadura en Cullera, a ~8 km al sur), regulado por **Tous** (378 hm³) y con afluentes bajos **Magro** (Forata → Guadassuar → Algemesí), **Albaida** (Bellús → Manuel) y **Sellent**; la **Albufera** y su marjal (cota ~0, drenaje por golas y bombeo); y la **lluvia local** sobre la marjal, que ha inundado el Mareny por sí sola.

| Vigilar | Estación | `idVariable` | Umbrales | Nota |
|---|---|---|---|---|
| Salida de Tous ✅ | 485 `7E04` | **13080** (río) / 15430 (salida río, umbrales) | 50 / 150 / 250 | Laminación principal |
| Tous cota / volumen ✅ | 300 `7E04` | 2340 / 2470 | NMN 378,6 hm³ | Sin umbrales en `/propiedades` |
| Magro en Guadassuar ✅ | 326 `7C01` | **14551** | 30 / 150 / 300 | Antes de Algemesí |
| Xúquer en Huerto Mulet (Algemesí) ✅ | 310 `7A02` | **13070** | 200 / 300 / 400 | Último aforo antes de Sueca/Cullera |
| Albaida en Manuel ✅ | 313 `7O04` | 2443 | 50 / 150 / 250 | |
| Sellent en Estubeny ✅ | 312 `7O03` | 2701 | 35 / 100 / 200 | |
| Salida Forata al Magro ✅ | 303 `7E03` | 16696 | 5 / 30 / 100 | |
| Salida Bellús ✅ | 328 `7E10` | 13728 | 20 / 60 / 120 | |
| Lluvia Azud de Sueca (Riola) ✅ | 306 `7E07` | **2710** intensidad, 16439 (24 h) | — | **Lluvia local**, la señal más importante |
| Lluvia Tancat de la Pipa ✅ | 802 `0P11` | **16906** intensidad, 16912 (24 h) | — | Albufera |
| Lluvia Barranc de la Casella (Alzira) ✅ | 387 `7O07` | **13805** intensidad, 16424 (24 h) | — | |

**Huecos** ✅: sin aforo en Sumacàrcer, Alzira, Albalat, Sueca ni Cullera (los azudes de Antella 305 y Sueca 306 solo publican lluvia); sin nivel de la Albufera ni de las golas; sin pluviómetro en Cullera.

**Contexto**: pantanada de Tous (20‑10‑1982, rotura de la presa, 15.000–16.000 m³/s; Sueca se salvó al abrirse las golas). Inundaciones de la Ribera Baixa 1987 ❓. El Mareny se ha inundado con temporales de lluvia local; MITECO proyectó una impulsión de drenaje específica. Zona cartografiada por PATRICOVA.

---

## 4. Benaguasil (`virtual:benaguasil`) — Túria medio‑bajo, Camp de Túria

**Cauces**: el **Túria** (margen derecha, entre Vilamarxant y Riba‑roja), regulado por **Benagéber** (221 hm³) y **Loriguilla** (73 hm³) más **Buseo** (río Sot/Reatillo, 7,7 hm³); afluentes no regulados aguas abajo de Loriguilla: **rambla Castellarda/Castellana** (Pedralba) y **rambla Primera** (Llíria, desagua por Benaguasil/Vilamarxant), además de barrancos locales (Pedralvilla, la Cova) sin sensor. Aguas abajo, el nuevo cauce del Plan Sur (5.000 m³/s) protege València, no Benaguasil.

| Vigilar | Estación | `idVariable` | Umbrales | Nota |
|---|---|---|---|---|
| Salida de Loriguilla ✅ | 483 `6E02` | **12905** (río) / 16694 (umbrales) | 20 / 60 / 150 | Inmediatamente aguas arriba |
| Loriguilla cota / volumen ✅ | 294 `6E02` | 2461 / 2462 | NMN 73,2 hm³ | La cota 2461 devolvió `[]` en una consulta y datos en otra ❓ |
| Salida de Benagéber ✅ | 293 `6E01` | 16693 | 15 / 50 / 100 | cota 2338, vol. 2486 |
| Salida de Buseo ✅ | 295 `6E03` | 16695 | 15 / 75 / 100 | |
| Tuéjar en Calles (entrada a Loriguilla) ✅ | 399 `6A02` | 13617 | 15 / 25 / 50 | |
| Rambla Castellana (Pedralba) ✅ | 225 `0O02` | **13896** | 35 / 80 / 150 | No regulada |
| Rambla Primera (Llíria) ✅ | 539 `0O02` | **13897** | 100 / 200 / 300 | No regulada; desagua junto a Benaguasil |
| Túria en Vilamarxant ✅ | 226 `0O03` | **12808** | 40 / 80 / 150 | Aguas arriba inmediato |
| Túria en Manises (EA 25) ✅ | 438 `0R06` | 1523 | 50 / 100 / 200 | Aguas abajo (confirmación) |
| Túria en Azud del Repartiment ✅ | 222 `0E02` | 14450 | 100 / 500 / 1000 | Aguas abajo |
| Lluvia Bugarra (EA 22) ✅ | 408 `0A01` | **13335** intensidad, 16565 (24 h) | — | |
| Lluvia Casinos ✅ | 233 `0P06` | **14174** intensidad, 15063 (24 h) | — | Cabecera rambla Primera |
| Lluvia Marines (EA 221) ✅ | 409 `0A02` | **15317** intensidad, 15322 (24 h) | — | |
| Lluvia Pedralba / Vilamarxant ✅ | 225 / 226 | **13891** / **1774** intensidad; 15259 / 14858 (24 h) | — | Llíria (539) no publica lluvia ❓ |

**Huecos** ✅: sin aforo del Túria en Chulilla, Gestalgar, Pedralba ni Riba‑roja (Bugarra solo lluvia); sin pluviómetro en Benaguasil.

**Contexto**: riada del Túria de 1957 (~300 muertos) → Plan Sur. Benagéber y Loriguilla laminan el Túria; en la DANA de 2024 retuvieron ~30 y ~15 hm³ y el río no se desbordó en Benaguasil, cuyos daños fueron por lluvia local. El riesgo principal para el municipio son las ramblas Primera y Castellana y los barrancos de Llíria, no el Túria regulado.

---

## 5. Tortosa (`virtual:tortosa`) — Ebro bajo (CHE, sin cobertura SAIH)

**Cauces**: el **Ebro** a su paso por Tortosa (~12 m sobre el mar, a ~40 km de la desembocadura), regulado aguas arriba por **Mequinenza** (1.530 hm³), **Ribarroja** (210 hm³) y **Flix**; afluentes bajos (Matarraña, Algars, Canaletes) y barrancos locales. Como el Xúquer en Tous, la regulación rompe la relación lluvia-caudal: aunque hubiera aforo, no se calibraría `runoff_models` ahí (doctrina de la fase 13).

**Sensores**: ninguno en el catálogo — el SAIH del Ebro es de la CHE (`saihebro.com`), otro portal con otros endpoints, y merece su propio collector (fuera de la fase 15). El semáforo combina lluvia prevista (Open-Meteo, 6 modelos) y avisos oficiales (Meteoalarm, zona 694305 Prelitoral sur de Tarragona).

**Contexto**: riada del Ebro de 1937 y avenidas de 1961, 1982 y 2003; el tramo bajo (Tortosa–Amposta–Deltebre) es el expuesto cuando Mequinenza desembalsa o confluyen crecida y lluvia local. AEMET mantiene hoy (01-10-2026) "Aviso especial. Chubascos muy fuertes y persistentes" en el municipio.

---

## 6. Málaga (`virtual:malaga`) — Guadalmedina y Guadalhorce (Hidrosur, sin cobertura SAIH)

**Cauces**: el **Guadalmedina** (atorna la ciudad, encauzado; presa del Limonero aguas arriba) y el **Guadalhorce** al oeste (desembocadura junto al aeropuerto), ambos de respuesta rápida y cuenca pequeña; ramblas y arroyos urbanos (Jaboneros, Gálica, Las Cañas) sin sensor público conocido.

**Sensores**: ninguno en el catálogo — Málaga está en la Demarcación de las Cuencas Mediterráneas Andaluzas y su SAIH (Hidrosur, `redhidrosur`) es otro portal (fuera de la fase 15). Semáforo con lluvia prevista + avisos (Meteoalarm, zona 612903 Sol y Guadalhorce).

**Contexto**: inundaciones del Guadalmedina (1915, 1989, 2004); la DANA del 29-10-2024 también puso a Málaga en aviso rojo. El riesgo urbano viene de convección intensa sobre cuencas pequeñas, justo el caso que el SAIH Júcar no cubre aquí.

---

## 7. Rincón de la Victoria (`virtual:rincon-de-la-victoria`) — arroyos de la Axarquía (Hidrosur, sin cobertura SAIH)

**Cauces**: arroyos costeros de la **Axarquía** (Benagalbón, Totalán, Granadillas, Pizarro), cortos y de fuerte pendiente desde los Montes de Málaga al mar; sin regulación ni, que se sepa, aforo público.

**Sensores**: ninguno en el catálogo (misma demarcación y mismo hueco que Málaga). Semáforo con lluvia prevista + avisos (Meteoalarm, zona 612904 Axarquía).

---

## Resumen de sensores "clave" por localización (para `watch_points`)

| Localización | Caudal principal | Caudales secundarios | Lluvia clave |
|---|---|---|---|
| Albal | 13873 | — | 371, 232, 789, 238 |
| Benetússer | 13873 | — | 371, 232 (+ AVAMET Torrent/Paiporta) |
| Mareny de Barraquetes | 13070 | 13080, 14551, 2443, 2701 | **306**, 802, 387 |
| Benaguasil | 12808 | 12905, 13896, 13897, 16693 | 233, 408, 409, 225, 226 |
| Tortosa | — (Ebro, CHE) | — | — (prevista + avisos) |
| Málaga | — (Hidrosur) | — | — (prevista + avisos) |
| Rincón de la Victoria | — (Hidrosur) | — | — (prevista + avisos) |

Notas de implementación (collector SAIH, implementado el 25‑08‑2026): **todo** se lee con `/admin/variables/valor/{id}/{desde}/{hasta}`, incluida la lluvia — los `idVariable` de intensidad y acumulado de cada pluviómetro se descubren en `/chart-lluvia/{idEstacionRemota}` (variables JS `varLluvia` y `varLluvia24`) y están fijados arriba, así que `/lluviasIntervalo` (solo acumulados diarios) no se usa. El rango de la URL se interpreta en **hora local `Europe/Madrid`** y la respuesta llega en UTC. La intensidad está en **mm/h** en múltiplos de 2,4 (cazoleta de 0,2 mm/5 min); el collector deriva de ella `precip_mm` horario. En `/mapa-embalses` y `/mapa-aforos` las claves `fldNCoordGPSLat/Lon` son en realidad **UTM 30N ETRS89 (EPSG:25830)**; en `/lluvias` son lat/lon reales. El catálogo completo (29 estaciones, 57 sensores verificados) vive en la tabla `sensors` (`db/migrations/0006_saih.sql`).
