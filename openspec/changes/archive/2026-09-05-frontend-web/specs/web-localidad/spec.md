# Capacidad: web-localidad

## ADDED Requirements

### Requirement: Detalle por localización
La página `/l/{id}` DEBE mostrar el nivel de una localización, la tabla de señales que lo explican, sus advertencias de frescura y los sensores que la vigilan con su último valor y su antigüedad. Un id desconocido DEBE responder `404`.

#### Scenario: Identificador con dos puntos
- **Dado** que los ids son del tipo `virtual:albal`
- **Entonces** la página responde tanto con el id literal como codificado (`virtual%3Aalbal`).

#### Scenario: Localización inexistente
- **Dado** `/l/virtual:nada`
- **Entonces** la respuesta es `404`.

### Requirement: Serie reciente con sus umbrales
La página DEBE dibujar la serie de las últimas 24 h de los sensores de caudal o nivel vigilados, con los umbrales oficiales marcados sobre el gráfico.

#### Scenario: Escala con referencia
- **Dado** un caudal muy por debajo de su primer umbral
- **Entonces** el eje llega hasta ese umbral, para que una curva plana no parezca alarmante.

#### Scenario: Sensor sin datos recientes
- **Dado** un sensor sin muestras en la ventana
- **Entonces** se indica que no hay datos en lugar de dibujar un gráfico vacío.
