# Capacidad: web-mapa

## ADDED Requirements

### Requirement: Mapa con localizaciones y sensores
La página `/mapa` DEBE mostrar un mapa con las cuatro localizaciones objetivo y los sensores del catálogo, cada sensor coloreado según su nivel de umbral y con su último valor accesible al pulsarlo.

#### Scenario: Sensor con umbral superado
- **Dado** un sensor de caudal en `naranja`
- **Entonces** su marcador se distingue de los que están en `verde` y su ficha muestra el valor con su unidad.

#### Scenario: Sensor sin datos
- **Dado** un sensor sin último valor
- **Entonces** aparece marcado como sin datos, no como si estuviera en calma.

### Requirement: El mapa no depende de servicios con clave
El estilo del mapa DEBE definirse en el propio código con teselas públicas, y poder sobrescribirse con `NEXT_PUBLIC_MAP_STYLE`.

#### Scenario: Sin configuración
- **Dado** que no hay `NEXT_PUBLIC_MAP_STYLE`
- **Entonces** el mapa se dibuja igualmente.

### Requirement: Encuadre inicial útil
El mapa DEBE abrirse encuadrando las cuatro localizaciones y sus sensores, no en un punto arbitrario.
