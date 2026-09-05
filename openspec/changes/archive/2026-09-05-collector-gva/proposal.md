# Propuesta: collector GVA Emergències (fase 10)

**Estado**: propuesta (26‑08‑2026) · **Fecha**: 2026‑08‑26 · **Depende de**: `semaforo-riesgo`, `collector-meteoalarm`

## Por qué

Faltaba la señal de **Protección Civil autonómica**: la activación de las fases del plan de emergencias por inundación (Situación 0/1/2/3). Es distinta de los avisos meteorológicos de AEMET —que dicen qué tiempo se espera— porque dice qué han decidido **las autoridades**: cuando la GVA declara Situación 2 en L'Horta Sud, eso es la señal más fuerte que puede haber, y hasta ahora el semáforo no la veía.

## Qué cambia

1. **Collector `collectors/gva`**: lee la API pública del CCE 112 CV (`wpr.112cv.gva.es`, sin clave), se queda con las zonas de emergencia de las localizaciones objetivo y escribe en `alerts` con `source='gva'`.
2. **Zonas de emergencia como dato de la estación**: cada localización guarda en `meta.gva_zones` su comarca y el comodín provincial (Albal/Benetússer `28`, Sueca `33`, Benaguasil `23`, todas + `51` = Valencia).
3. **El semáforo y `/alerts` miran ambos sistemas de zonas**: la de aviso de AEMET y las de emergencia de la GVA. Los códigos no colisionan (`774602` vs `28`), así que es una única consulta por la unión.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Endpoint | `…/json/emergencias` (planes activados). **No** `avisosmeteorologicos`: es AEMET republicado, ya lo tenemos |
| 2 | Catálogos | Los códigos de fase y fenómeno se **embeben como constantes** (son del plan de emergencias, muy estables) en vez de pedir cuatro endpoints por ciclo |
| 3 | Fase → nivel | SIT 0 → amarillo (preemergencia), SIT 1 → naranja, SIT 2 y 3 → rojo. La GVA no da color a las fases; el escalón es decisión de Talaia, ajustable |
| 4 | Vigencia | La GVA **no publica fecha de fin**: `expires = now + GVA_TTL_MINUTES` (30). Cada ciclo lo refresca mientras el aviso siga en `z2`; al desaparecer, caduca solo |
| 5 | Comodín provincial | La zona `51` (toda Valencia) afecta a las cuatro localidades; verificado contra el catálogo de zonas |
| 6 | Cortesía | Una petición por ciclo, respuestas diminutas (228 B). `robots.txt` no restringe. Atribución al CCE, como piden sus condiciones |

## Cabo suelto (honesto)

Cuando se implementó esto **no había ninguna emergencia activa**, así que `z2` venía vacío. La ruta "sin avisos" está probada contra la respuesta real; la ruta **con avisos** está construida según el esquema del parser del widget de la GVA y probada contra una fixture **reconstruida y marcada como tal**. Hay que **capturar una respuesta real con `z2` poblado en el próximo episodio de lluvias** y confirmar la fixture de test.

## No-objetivos

- El endpoint `avisosmeteorologicos` (duplica AEMET) ni los incidentes 112 geolocalizados (otra cosa: sucesos en curso, no avisos).
- Deduplicar GVA contra AEMET: son señales distintas (activación de plan vs. aviso meteorológico), no el mismo aviso.

## Impacto

- Nuevo paquete `collectors/gva`, migración `0011_gva.sql`, job cada 5 min.
- `VirtualStation` gana `gvaZones`; el semáforo y `/alerts` consultan la unión de zonas.
- Sin dependencias nuevas.
