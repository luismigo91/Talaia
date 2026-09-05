# Capacidad: semaforo-riesgo

> Comportamiento **vigente**. Origen: `semaforo-riesgo` (Fase 3) + `calibracion-y-avamet` (Fase 9), archivado el 25‑08‑2026 y 05‑09‑2026.

## Requirements

### Requirement: Combinación por máximo
El nivel de una localización DEBE ser el **máximo** de los niveles de sus componentes (caudal/embalse, lluvia observada, lluvia prevista y aviso vigente), nunca una media. Si no hay ningún componente evaluable, el nivel DEBE ser `verde` con la advertencia correspondiente.

#### Scenario: Un componente en rojo manda
- **Dado** caudal en rojo, lluvia observada verde y sin aviso
- **Entonces** el nivel de la localización es `rojo`.

#### Scenario: Sin datos
- **Dado** que no hay observaciones ni predicciones ni avisos
- **Entonces** el nivel es `verde` y `warnings` explica que no hay datos evaluables.

### Requirement: Componentes explicables
Cada componente DEBE devolver `kind`, `level`, `value`, `threshold`, el sensor o fuente de origen y un `detail` en español que permita entender el nivel sin leer el código.

#### Scenario: Detalle de caudal
- **Dado** el Poyo a 80 m³/s con umbrales 30/70/150
- **Entonces** el componente tiene `level='naranja'`, `value=80`, `threshold=70` y un `detail` que nombra la estación.

### Requirement: Lluvia observada por pluviómetro
La lluvia observada DEBE evaluarse **por pluviómetro vigilado**, tomando el peor, sin promediar ni sumar entre estaciones. La señal horaria (`observed_precip_1h`) DEBE ser el **máximo del acumulado horario de las últimas 6 h**, no una ventana móvil de una hora: `precip_mm` solo existe para horas completas, así que una ventana móvil no contendría ninguna fila y la señal nunca se activaría. La señal de 12 h DEBE ser la suma de la ventana de 12 h.

#### Scenario: Cabecera aislada
- **Dado** 45 mm en una hora en Chiva y 0 mm en el resto de pluviómetros de Albal
- **Entonces** el componente de lluvia observada es `naranja` (45 ≥ 40) y nombra a Chiva.

#### Scenario: La hora lluviosa no se diluye
- **Dado** 45 mm en la hora de hace cuatro horas y 0 mm en las siguientes
- **Entonces** la señal horaria sigue siendo `naranja` mientras esa hora esté dentro de las últimas 6.

#### Scenario: No se suman estaciones
- **Dado** 15 mm en 1 h en cada uno de tres pluviómetros
- **Entonces** el nivel es `verde` (15 < 20), no `amarillo` por sumar 45.

### Requirement: Lluvia prevista por mediana entre fuentes
La lluvia prevista DEBE acumular `precip_mm` de las próximas 12 h y 24 h por fuente, usando la última `forecast_ts` de cada una, y evaluar el nivel con la **mediana** entre fuentes, devolviendo también el máximo y el número de fuentes.

#### Scenario: Un modelo desatado
- **Dado** cinco fuentes con 10 mm en 12 h y una con 150 mm
- **Entonces** el nivel del componente es `verde` (mediana 10) y `max` refleja los 150 mm.

#### Scenario: Acuerdo entre modelos
- **Dado** seis fuentes entre 100 y 120 mm en 12 h
- **Entonces** el componente es `naranja` (mediana ≥ 100).

### Requirement: Avisos oficiales de inundación
Solo los avisos vigentes (`expires > now`) de la zona AEMET de la localización y con `event_code` ∈ `PR|TO|IN` DEBEN elevar el nivel. Los demás avisos vigentes DEBEN devolverse marcados como informativos, sin afectar al nivel.

#### Scenario: Aviso de lluvias
- **Dado** un aviso `PR` naranja vigente en la zona de Albal
- **Entonces** el componente de aviso es `naranja`.

#### Scenario: Aviso de viento
- **Dado** solo un aviso `VI` rojo vigente
- **Entonces** el nivel de la localización no sube por él y el aviso aparece como informativo.

#### Scenario: Aviso caducado
- **Dado** un aviso naranja cuyo `expires` ya pasó
- **Entonces** no se tiene en cuenta.

### Requirement: Los datos obsoletos no cuentan
Un valor observado con más de `RISK_STALE_MINUTES` (30 por defecto) DEBE quedar excluido del cálculo del nivel y generar una entrada en `warnings`. El margen DEBE ajustarse a la cadencia del sensor: los de estaciones de embalse, que publican cada media hora, DEBEN tolerar al menos 90 minutos. La respuesta DEBE marcar `stale: true` cuando ningún componente observado esté fresco.

#### Scenario: Sensor mudo
- **Dado** que el último caudal del Poyo es de hace 3 h y estaba en rojo
- **Entonces** ese componente no eleva el nivel y `warnings` avisa de que el dato está obsoleto.

#### Scenario: Sensor sin umbrales
- **Dado** el volumen de un embalse, que no tiene umbrales oficiales y se publica cada media hora
- **Entonces** no genera componente **ni** advertencia de frescura: es contexto, no señal.

#### Scenario: Frescura normal
- **Dado** un caudal de hace 5 min
- **Entonces** cuenta con normalidad y `stale` es `false`.

#### Scenario: Cadencia de embalse
- **Dado** el caudal de salida de Benagéber, de hace 45 min y por encima de su umbral naranja
- **Entonces** cuenta con normalidad: descartarlo sería un verde falso con el embalse soltando agua.

### Requirement: Lecturas de caudal plausibles
El componente de caudal y nivel DEBE usar la última lectura **creíble** de las últimas dos horas, no la última sin más. Un salto mayor que `RISK_MAX_FLOW_JUMP` (250 por defecto) respecto a la última lectura creíble DEBE quedar en cuarentena y solo aceptarse si se sostiene doce muestras seguidas (una hora). Ver `plausibility.ts:lastPlausible`.

#### Scenario: Artefacto del sensor
- **Dado** la serie real del Poyo del 17-09-2025 (`0,1 → 855,5 → … → 0,0` en media hora)
- **Entonces** el semáforo no sube de nivel y el componente muestra el valor creíble.

#### Scenario: Crecida real
- **Dado** una subida progresiva de unos 60 m³/s cada cinco minutos hasta 1.200
- **Entonces** el semáforo llega a `rojo` con normalidad.

#### Scenario: Escalón sostenido
- **Dado** un salto grande que se mantiene más de una hora (una suelta de embalse)
- **Entonces** se acepta como valor bueno.

### Requirement: Lluvia amateur cercana
La lluvia observada DEBE tener en cuenta las estaciones de AVAMET a menos de `AVAMET_RADIUS_KM` (8 km) de la localización, comparando sus acumulados de 1 h y 12 h con los mismos umbrales, y DEBE indicar en el detalle que la lectura es amateur y a qué distancia está.

#### Scenario: El hueco del Horteta
- **Dado** que Albal y Benetússer no tienen pluviómetro oficial en el barranco
- **Entonces** las estaciones de AVAMET cercanas cuentan como lluvia observada.

#### Scenario: Procedencia visible
- **Dado** un componente alimentado por AVAMET
- **Entonces** su detalle dice "amateur" y la distancia a la localidad.

#### Scenario: Ventana correcta por fuente
- **Dado** que AVAMET publica acumulados móviles y el SAIH horas completas
- **Entonces** el detalle dice "en la última hora" para AVAMET y "en la hora más lluviosa de las últimas 6 h" para el SAIH.
