# Capacidad: api-riesgo

## MODIFIED Requirements

### Requirement: Avisos de inundación de todas las fuentes
El semáforo DEBE tener en cuenta los avisos de las zonas que afectan a cada localización en **ambos** sistemas de zonas: la de aviso de AEMET (`meta.aemet_zone`) y las de emergencia de la GVA (`meta.gva_zones`). Un aviso de la GVA por inundación o tormenta DEBE elevar el nivel igual que uno de AEMET.

#### Scenario: Emergencia declarada
- **Dado** que la GVA declara Situación 1 por Inundaciones en la comarca de Albal
- **Entonces** el componente de aviso del semáforo de Albal es `naranja` y su fuente es `gva`.

#### Scenario: Aviso provincial
- **Dado** una activación de la zona comodín de la provincia de Valencia
- **Entonces** afecta a las cuatro localizaciones.

#### Scenario: Comarca ajena
- **Dado** un aviso en una comarca que no es la de la localización
- **Entonces** no la afecta.
