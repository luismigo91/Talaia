# Capacidad: collector-avamet

## ADDED Requirements

### Requirement: Lectura de la comarca en una petición
El collector DEBE leer `mxo-mxo-prec.php?territori=…` (por defecto `c16`, l'Horta Sud) en **una sola petición por ciclo** y extraer, por estación, sus acumulados de día, 1 h, 12 h y 24 h junto con la hora de su última lectura.

#### Scenario: Hora local
- **Dado** una lectura marcada `26-08-2026 07:51`
- **Entonces** su `ts` es `2026-08-26T05:51:00Z`.

#### Scenario: Coma decimal
- **Dado** el valor `1.013,5`
- **Entonces** se interpreta como 1013,5.

#### Scenario: Celda vacía
- **Dado** una celda sin valor
- **Entonces** no se escribe un cero.

#### Scenario: El HTML cambia
- **Dado** una respuesta sin la tabla esperada
- **Entonces** el ciclo falla con un mensaje que menciona el posible cambio de formato, en lugar de escribir cero lecturas en silencio.

### Requirement: Alta automática de estaciones
Las estaciones desconocidas DEBEN darse de alta con las coordenadas de su ficha técnica, como máximo cinco por ciclo, y solo DEBEN guardarse lecturas de estaciones con posición conocida.

#### Scenario: Red creciente
- **Dado** 25 estaciones nuevas
- **Entonces** se dan de alta en ciclos sucesivos y las pendientes se reportan como aviso.

#### Scenario: Dato sin sitio
- **Dado** una estación cuya ficha no trae coordenadas
- **Entonces** su lectura no se guarda: un dato sin posición no dice si llueve *aquí*.

### Requirement: Procedencia y licencia
Las estaciones DEBEN registrarse con `kind='rain_gauge'`, fuente `avamet` y una nota en `meta` que indique que son amateur y bajo qué licencia se publican.
