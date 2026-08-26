# web (delta)

## ADDED Requirements

### Requisito: Verificación predicción vs. realidad
La web DEBE ofrecer una página `/verificacion` que contraste, por día completo y por
localización, la lluvia que cada modelo predijo la víspera con la observada por los
pluviómetros del SAIH vigilados.

#### Escenario: sin histórico suficiente
- **DADO** que los collectors llevan poco tiempo acumulando
- **CUANDO** se abre `/verificacion`
- **ENTONCES** se muestra un estado vacío explicativo, no un error

### Requisito: Método transparente
La web DEBE ofrecer una página `/como-funciona` que explique el semáforo (máximo de cuatro
señales), umbrales, histéresis y limitaciones (sensor provisional, datos amateur, picos
filtrados, sin datos de la DANA).

### Requisito: Embalses
La web DEBE mostrar en `/embalses` el volumen, la cota y —cuando la CHJ la ofrezca— la
ocupación de los embalses vigilados.

### Requisito: Histórico de avisos
La página `/avisos` DEBE permitir alternar entre avisos vigentes y todos (incluidos los
caducados, atenuados).

### Requisito: Historia por localidad
El detalle de localidad DEBE permitir elegir la ventana (24 h / 7 días) y graficar, además
del caudal, la lluvia y el embalse.

#### Escenario: ventana larga
- **DADO** un rango de 7 días
- **CUANDO** se dibuja una serie
- **ENTONCES** el eje temporal se rotula por día y las marcas no se amontonan
