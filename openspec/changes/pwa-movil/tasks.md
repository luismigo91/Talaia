# Tareas: PWA, push y widget

- [x] Manifest, iconos (192/512/maskable/apple), theme-color y metadatos iOS.
- [x] Service worker (offline network-first + recepción de push) y su registro.
- [x] `GET /api/v1/risk/badge` (JSON) y `/risk/badge.svg` (imagen).
- [x] Migración `push_subscriptions`; endpoints `/push/{key,subscribe,unsubscribe}` y proxies en Next.
- [x] `WebPushNotifier` (VAPID) enchufado al ciclo de riesgo junto al ntfy; poda de suscripciones muertas.
- [x] Botón "activar avisos" en la home.
- [x] Verificado en local: manifest/SW/iconos, insignia, alta de suscripción, ciclo invocando el envío.
- [ ] Verificar en un móvil real sobre HTTPS: instalar la PWA, activar avisos y recibir un push (necesita el deploy + VAPID en el entorno).
- [ ] Script de Scriptable de ejemplo para el widget (documentación).
- [ ] Archivar y fusionar en `openspec/specs/`.
