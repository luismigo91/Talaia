# Capacidad: web

> Comportamiento **vigente**. Origen: `web-profundidad` (Fase 12: profundidad web), archivado el 05-09-2026. Complementa `infraestructura` y páginas base.

## Requirements

### Requirement: Verificación predicción vs. realidad
La web DEBE ofrecer una página `/verificacion` que contraste, por día completo y por localización, la lluvia que cada modelo predijo la víspera con la observada por los pluviómetros del SAIH vigilados.

#### Scenario: sin histórico suficiente
- **Dado** que los collectors llevan poco tiempo acumulando
- **Cuando** se abre `/verificacion`
- **Entonces** se muestra un estado vacío explicativo, no un error

### Requirement: Método transparente
La web DEBE ofrecer una página `/como-funciona` que explique el semáforo (máximo de cuatro señales), umbrales, histéresis y limitaciones (sensor provisional, datos amateur, picos filtrados, sin datos de la DANA).

### Requirement: Embalses
La web DEBE mostrar en `/embalses` el volumen, la cota y —cuando la CHJ la ofrezca— la ocupación de los embalses vigilados.

### Requirement: Histórico de avisos
La página `/avisos` DEBE permitir alternar entre avisos vigentes y todos (incluidos los caducados, atenuados).

### Requirement: Historia por localidad
El detalle de localidad DEBE permitir elegir la ventana (24 h / 7 días) y graficar, además del caudal, la lluvia y el embalse.

#### Scenario: ventana larga
- **Dado** un rango de 7 días
- **Cuando** se dibuja una serie
- **Entonces** el eje temporal se rotula por día y las marcas no se amontonan

### Requirement: Atribución visible
Toda página DEBE mostrar en pie global la atribución de AVAMET (CC BY-NC-ND 4.0) y fuentes oficiales, además de la mención a 112/Protección Civil.

### Requirement: Observabilidad en la web
La home DEBE mostrar frescura ("actualizado a las …" / "dato desactualizado") derivada de `stale` del semáforo.
