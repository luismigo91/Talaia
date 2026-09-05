# Capacidad: api-riesgo

## ADDED Requirements

### Requirement: Anuncio de cambios de nivel
Al registrar una transición, el ciclo de riesgo DEBE publicarla en el canal `talaia_risk` de Postgres con la localización, el nivel nuevo, el anterior y el sentido del cambio.

#### Scenario: Transición anunciada
- **Dado** una subida a `rojo` en Albal
- **Entonces** quien esté escuchando el canal recibe un JSON con `stationId`, `level='rojo'` y `direction='subida'`.

### Requirement: Stream de cambios
`GET /api/v1/risk/stream` DEBE mantener una conexión SSE que emita un evento `risk` por cada cambio, con latidos periódicos para que ningún intermediario la dé por muerta, y DEBE seguir funcionando aunque la escucha de Postgres no se haya podido establecer.

#### Scenario: Varios clientes
- **Dado** dos navegadores conectados
- **Entonces** ambos reciben el mismo evento, con una sola escucha en la base de datos.

#### Scenario: Cliente que se va
- **Dado** un cliente que cierra la conexión
- **Entonces** deja de recibir y no afecta a los demás.
