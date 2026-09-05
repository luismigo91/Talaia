# Capacidad: api-push

> Comportamiento **vigente**. Origen: `pwa-movil` (Fase 11: PWA móvil), archivado el 05-09-2026.

## Requirements

### Requirement: Suscripción a Web Push
La API DEBE exponer la clave pública VAPID (`GET /api/v1/push/key`), aceptar suscripciones (`POST /api/v1/push/subscribe`) y darlas de baja (`POST /api/v1/push/unsubscribe`), guardándolas en `push_subscriptions`. Sin claves VAPID configuradas, `key` DEBE responder error controlado y Web Push queda desactivado sin romper el resto.

#### Scenario: Alta
- **Dado** una suscripción válida del navegador
- **Entonces** se guarda en `push_subscriptions` y una segunda alta del mismo endpoint no duplica.

#### Scenario: Sin configurar
- **Dado** que no hay `VAPID_PUBLIC_KEY`
- **Entonces** `/push/key` responde error y no se ofrece la activación.

### Requirement: Envío del cambio de nivel
El ciclo de riesgo DEBE enviar cada transición por Web Push a las suscripciones guardadas, además del canal ntfy, y DEBE borrar las suscripciones caducadas (404/410). Un fallo de un canal no DEBE impedir el otro.

#### Scenario: Suscripción muerta
- **Dado** un endpoint que devuelve 410
- **Entonces** su fila se borra de `push_subscriptions`.
