# Capacidad: web-comparativa

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
