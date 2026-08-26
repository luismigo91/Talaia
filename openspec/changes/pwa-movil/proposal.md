# Propuesta: Talaia como webapp instalable, con push y widget (fase 11)

**Estado**: propuesta (26‑08‑2026) · **Depende de**: `frontend-web`, `notificaciones-riesgo`

## Por qué

Una atalaya sirve si la miras a tiempo. En el móvil eso significa: tenerla a un toque (instalada), que avise sola cuando algo cambia (push), y poder verla de un vistazo en la pantalla de inicio (widget). Hoy es una web que hay que abrir y recargar.

## Qué cambia

1. **PWA instalable**: manifest, iconos (el logo‑atalaya), `theme-color` y metadatos de iOS. Talaia se instala y se abre en pantalla completa como una app.
2. **Offline**: un service worker cachea la interfaz y la última respuesta, de modo que abre al instante y aguanta un corte de red mostrando el último estado conocido (con su marca de tiempo, que ya deja claro que es "lo último que se supo").
3. **Insignia para widgets**: `GET /api/v1/risk/badge` (JSON compacto) y `…/badge.svg` (imagen), más un script de **Scriptable** listo para pegar. Un widget de verdad en el escritorio sin app nativa.
4. **Web Push**: suscripción desde la propia web y envío del cambio de nivel como notificación push, además del ntfy que ya existe.

## Decisiones

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Widgets nativos | **No** se pueden desde una web (requieren app nativa). Se cubre con push + una insignia que apps como Scriptable/KWGT pintan como widget |
| 2 | Service worker | A mano, sin `next-pwa`: `network-first` para páginas (cae al caché si no hay red), `cache-first` para estáticos. El dato es en vivo, no se cachea agresivo |
| 3 | Iconos | PNG 192/512 + maskable, rasterizados del logo SVG. `apple-touch-icon` 180 para iOS |
| 4 | Web Push | Estándar VAPID con la librería `web-push`; claves por entorno (la privada nunca en el repo). Suscripciones en tabla `push_subscriptions`. El envío va en el ciclo de riesgo, junto al ntfy |
| 5 | iOS | Push solo si la PWA está instalada en la pantalla de inicio (iOS 16.4+). Se documenta; en Android es directo |
| 6 | Insignia sin datos | Devuelve el último nivel conocido con su antigüedad; nunca un verde en blanco |

## No‑objetivos

- App nativa (Kotlin/Swift) ni envoltorio (Capacitor/TWA).
- Widgets nativos de iOS/Android (imposibles desde web; se sustituyen por la insignia).
- Precache offline del histórico o de tiles del mapa.

## Impacto

- `web/`: manifest, service worker + registro, iconos, botón de "activar avisos".
- `api/`: endpoints `/push/*` y `/risk/badge(.svg)`.
- `db/`: tabla `push_subscriptions` (migración 0012).
- `packages/shared`: `WebPushNotifier` enchufado al ciclo de riesgo.
- Nueva dependencia: `web-push` (servidor). Claves VAPID por entorno.
