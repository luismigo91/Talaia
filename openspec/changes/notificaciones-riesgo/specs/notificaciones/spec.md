# Capacidad: notificaciones

## ADDED Requirements

### Requirement: Se notifican cambios, no niveles
Solo las transiciones registradas en `risk_events` DEBEN generar notificación. Un nivel que se mantiene NO DEBE volver a notificarse.

#### Scenario: Nivel sostenido
- **Dado** una localización en `naranja` durante seis ciclos
- **Entonces** se envía una sola notificación, la de la transición.

### Requirement: Contenido útil
La notificación DEBE incluir la localidad, el nivel nuevo, el anterior y el `detail` del componente que determina el nivel, con prioridad `urgent` para `rojo`, `high` para `naranja`, `default` para `amarillo` y `low` para la vuelta a `verde`.

#### Scenario: Aviso de subida
- **Dado** Albal pasando de `verde` a `naranja` por caudal
- **Entonces** el mensaje nombra Albal, ambos niveles y el caudal con su umbral, con prioridad `high`.

### Requirement: El canal es opcional y nunca tumba el ciclo
Sin `NTFY_URL` configurada, el sistema DEBE registrar la transición y no enviar nada. Si el envío falla, el evento DEBE quedar con `notified=false` y el error en `notify_error`, sin propagar la excepción.

#### Scenario: Sin canal configurado
- **Dado** que `NTFY_URL` no está definida
- **Entonces** la transición se registra con `notified=false` y no se hace ninguna petición HTTP.

#### Scenario: Canal caído
- **Dado** que ntfy devuelve 500
- **Entonces** la transición queda registrada, `notify_error` describe el fallo y el ciclo termina con éxito.

#### Scenario: Envío correcto
- **Dado** `NTFY_URL` válida
- **Entonces** se hace un POST con el cuerpo del aviso y el evento queda con `notified=true`.
