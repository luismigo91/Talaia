# Capacidad: semaforo-riesgo

## MODIFIED Requirements

### Requirement: Lecturas de caudal plausibles
El componente de caudal y nivel DEBE usar la última lectura **creíble** de las últimas dos horas, no la última sin más. Un salto mayor que `RISK_MAX_FLOW_JUMP` (250 por defecto) respecto a la última lectura creíble DEBE quedar en cuarentena y solo aceptarse si se sostiene doce muestras seguidas (una hora).

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
