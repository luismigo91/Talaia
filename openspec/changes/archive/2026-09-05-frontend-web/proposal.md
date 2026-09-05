# Propuesta: frontend web (fase 6)

**Estado**: propuesta (25‑08‑2026) · **Fecha**: 2026‑08‑25 · **Depende de**: `semaforo-riesgo`, `notificaciones-riesgo`, `collector-meteoalarm`

## Por qué

Todo el sistema funciona y no se puede mirar. Hoy la única forma de saber cómo está el barranc del Poyo es hacer `curl` a `/api/v1/risk` y leer JSON. El proyecto se llama *Talaia* —atalaya— y le falta precisamente eso: un sitio desde el que mirar.

Además hay dos cosas que solo se ven bien dibujadas: la **comparativa entre modelos** (seis fuentes diciendo cosas distintas sobre la misma lluvia) y la **posición de los sensores** respecto a las localidades, que es lo que explica por qué el aforo de Riba‑roja avisa a Albal con dos horas y a Benetússer con menos.

## Qué cambia

Nuevo paquete `web/` (Next.js 16, App Router, React 19, TypeScript) con tres pantallas:

1. **Inicio — el semáforo**: las cuatro localizaciones con su color, el desglose que lo justifica (los `components` que ya devuelve la API, en español), los avisos vigentes y las advertencias de frescura. Debajo, las últimas transiciones de `/risk/history`.
2. **Mapa**: MapLibre con las cuatro localidades y los sensores del SAIH, coloreados por su nivel de umbral, con el último valor en el `popup`. Es donde se ve qué vigila a quién.
3. **Comparativa**: una serie por fuente de la precipitación prevista, con el resumen (mínimo, mediana y máximo entre fuentes) que ya calcula el servidor.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Framework | **Next.js 16 (App Router) + React 19**, como estaba previsto en `docs/arquitectura.md` |
| 2 | Acceso a la API | **Server Components**: el navegador nunca habla con la API. El frontend hace `fetch` a `API_URL` (interna, `http://api:3000`) con `revalidate`. Así solo el frontend necesita dominio en Dokploy, no hay CORS y la API no queda expuesta |
| 3 | Actualización | Revalidación cada 60 s y recarga manual. Sin WebSocket todavía: el dato de fondo se mueve cada 5–10 min |
| 4 | Mapa | **MapLibre GL** con estilo raster de OpenStreetMap definido en el propio código (`NEXT_PUBLIC_MAP_STYLE` lo sobrescribe). Sin clave ni servicio de estilos de terceros que pueda caerse o empezar a cobrar |
| 5 | Gráficos | **SVG propio**, sin librería de gráficos. Una comparativa de líneas no justifica arrastrar Recharts y su árbol de dependencias |
| 6 | Estilos | **CSS con variables**, sin framework. Tema claro y oscuro por `prefers-color-scheme` |
| 7 | Colores del semáforo | Los cuatro niveles con **texto además de color**: un semáforo que solo distingue por color es inservible para quien no distingue rojo y verde |
| 8 | Docker | Nuevo target `web` con `output: "standalone"`; una Application más en Dokploy |

## No-objetivos

- Autenticación (uso en LAN del homelab, como el resto).
- Edición de umbrales o de puntos de vigilancia desde la web: hoy son filas en la base de datos.
- Web Push desde el navegador: las notificaciones ya salen por ntfy.
- Radar de AEMET y capas meteorológicas sobre el mapa (necesitan la clave).
- PWA e instalación en el móvil.

## Impacto

- Nuevo paquete `web/`, nuevo target en `infra/Dockerfile`, nuevo servicio en el compose.
- Nuevas dependencias, todas en `web/`: `next`, `react`, `react-dom`, `maplibre-gl`; en desarrollo `@testing-library/react`, `@vitejs/plugin-react` y `jsdom` para los tests de componentes.
- `pnpm-workspace.yaml` incluye `web`.
- Sin cambios en API, collectors ni base de datos.
