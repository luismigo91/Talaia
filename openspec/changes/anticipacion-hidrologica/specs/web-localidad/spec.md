## ADDED Requirements

### Requirement: Evolución de las previsiones
La página `/l/{id}` DEBE mostrar una tabla con las corridas de cada modelo para las próximas 24 h (de la más antigua a la más reciente), el cambio entre la primera y la última, una fila con la mediana por tramo de antigüedad y una marca en las corridas que no cubren la ventana entera. La señal de lluvia prevista DEBE llevar una flecha con el sentido de su tendencia cuando exista.

#### Scenario: Sin corridas
- **Dado** que no hay predicciones guardadas para la ventana
- **Entonces** se indica que no hay corridas en lugar de una tabla vacía.

### Requirement: Caudal anticipado etiquetado
El componente `flow_projected` DEBE mostrarse con la etiqueta "Caudal anticipado" y su detalle completo, sin confundirse con el caudal medido.

#### Scenario: Proyección en el desglose
- **Dado** un componente `flow_projected` naranja
- **Entonces** la tabla de señales lo lista como "Caudal anticipado" con su nivel.
