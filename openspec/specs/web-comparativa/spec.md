# Capacidad: web-comparativa

> Comportamiento **vigente**. Origen: `frontend-web` (Fase 6), archivado el 05-09-2026.

## ADDED Requirements

### Requirement: Comparativa entre fuentes
La página `/comparativa` DEBE dibujar una serie por fuente para la variable y localización elegidas, con leyenda, ejes rotulados y el resumen (mínimo, mediana y máximo entre fuentes) que calcula el servidor.

#### Scenario: Varias fuentes
- **Dado** seis fuentes con datos
- **Entonces** se dibujan seis series distinguibles y la leyenda nombra cada una.

#### Scenario: Sin datos
- **Dado** una localización sin predicciones en la ventana
- **Entonces** se muestra un mensaje explicándolo, no un gráfico vacío.

### Requirement: Selección de localización y variable
DEBE poder cambiarse la localización y la variable, y la selección DEBE reflejarse en la URL para poder compartirla.

#### Scenario: Cambio de localización
- **Dado** que se elige Benaguasil
- **Entonces** la URL contiene esa estación y el gráfico muestra sus series.

### Requirement: Totales legibles
La tabla de la comparativa DEBE mostrar, por fuente, el total previsto (o el máximo horario según la variable) y la hora de emisión de la corrida.

#### Scenario: Emisiones distintas
- **Dado** fuentes con distinta hora de emisión
- **Entonces** cada fila muestra la suya.

### Requirement: Precipitación acumulada en el gráfico
Para `precip_mm`, el gráfico DEBE dibujar por defecto la lluvia acumulada por
fuente (suma corriente ordenada por instante), no los valores horarios sueltos:
la curva DEBE terminar en el total de 24 h que muestra la tabla. El resto de
variables (temperatura, viento, probabilidad) se dibujan con sus valores
instantáneos. La página DEBE ofrecer el modo alternativo `modo=horaria`
(¿cuánto cae en cada hora?) con la selección reflejada en la URL.

#### Scenario: Un modelo desatado
- **Dado** AROME con 137 mm en 24 h y pico horario de 53,8 mm
- **Entonces** su curva acumulada termina en 137, no en 54.

#### Scenario: Reparto por horas
- **Dado** `modo=horaria` en la URL
- **Entonces** la curva dibuja los valores horarios y el subtítulo lo dice.
