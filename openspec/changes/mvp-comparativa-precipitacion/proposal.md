# Propuesta: MVP — comparativa de precipitación prevista a 24 h para Albal, Benetússer, Mareny de Barraquetes y Benaguasil

**Estado**: **validada** (25‑08‑2026), lista para implementar · **Fecha**: 2026‑08‑25

## Por qué

Antes de construir mapa, semáforo o integrar el SAIH, necesitamos el "esqueleto vertical" completo: dos collectors reales escribiendo en TimescaleDB con el esquema común y un endpoint que demuestre la comparativa entre fuentes. Esto valida el esquema (`forecast_ts` vs `ts`), la tolerancia a fallos por fuente, la caché de AEMET y el despliegue en Docker. Todo lo posterior (SAIH, alertas, frontend) se apoya en esto.

## Qué cambia

1. **Collector AEMET** (`collectors/aemet`):
   - Predicción horaria de los municipios `46007` (Albal), `46054` (Benetússer), `46235` (Sueca, para el Mareny de Barraquetes) y `46051` (Benaguasil) → `forecasts` con `source='aemet'` y `station_id` de la estación virtual correspondiente. Cuatro consultas secuenciales (8 peticiones) por ejecución.
   - Avisos CAP vigentes de la Comunitat Valenciana (`/api/avisos_cap/ultimoelaborado/area/77`), filtrados por las zonas `774602` y `774604` → tabla `alerts`.
   - Cliente HTTP con el mecanismo de dos pasos, decodificación ISO‑8859‑15, control de cuota (40/min) y caché por hash de payload.
2. **Collector Open-Meteo** (`collectors/open-meteo`):
   - Las cuatro localizaciones en **una** petición (coordenadas separadas por comas → respuesta en array), modelos `meteofrance_arome_france_hd`, `icon_eu`, `ecmwf_ifs`, `gfs_seamless`, `arpege_europe`, `ukmo_global_deterministic_10km` → `forecasts` con `source='open-meteo:<model>'`.
   - `forecast_ts` a partir de `meta.json` del modelo.
3. **Esquema de base de datos** (`db/migrations`): Postgres 16 + TimescaleDB + PostGIS; tablas `sources`, `stations`, `source_status`, `forecasts`, `observations`, `alerts`, `raw_payloads`; seeds de fuentes y estaciones.
4. **API** (`api/`): `GET /api/v1/compare` (comparativa 24 h de `precip_mm`, parámetro `station`), `GET /api/v1/stations` (localizaciones objetivo), `GET /api/v1/status` (frescura), `GET /api/v1/health`.
5. **Localizaciones objetivo** definidas como datos (semilla de `stations`, con `meta.ine` y `meta.aemet_zone`), no como variables de entorno: añadir una localidad es una fila, no un despliegue.
6. **Infra**: `docker-compose.yml` (db, collectors, api), Dockerfiles, CI con tests.

## No-objetivos (explícitos)

- Frontend.
- Collector SAIH, Meteoalarm, GVA, EFAS, AVAMET.
- Observación de estaciones AEMET (se deja preparada la tabla `observations`, sin collector).
- Semáforo de riesgo, umbrales, notificaciones, WebSocket.
- Autenticación de la API (uso en LAN del homelab).

## Decisiones tomadas (25‑08‑2026)

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Lenguaje | **TypeScript (Node 22)** en collectors y API; pnpm workspaces |
| 2 | Framework API | **NestJS** (sobre adaptador Fastify) |
| 3 | Acceso a DB | **Drizzle ORM** para tablas y queries; hypertables, políticas y PostGIS en SQL crudo dentro de las migraciones |
| 4 | Ejecución de collectors | **`node-cron` interno** (o `@nestjs/schedule`) en el contenedor `collectors`, con aislamiento por job |
| 5 | Clave AEMET | **Docker secret** montado en `/run/secrets/aemet_api_key`; variable `AEMET_API_KEY_FILE`. Fallback a `AEMET_API_KEY` en desarrollo local. Tests sin clave |
| 6 | Ventana de comparativa | **24 h móviles** desde la hora actual truncada; parámetro `hours` (1–48) |
| 7 | Modelos Open-Meteo | **Los 6 verificados**, sin `best_match` |
| 8 | Nombre | **Talaia** |
| 9 | Mareny de Barraquetes y AEMET | **Sí**, predicción municipal de Sueca (`46235`) etiquetada como `virtual:mareny-barraquetes` |

## Impacto

- Nuevas carpetas: `collectors/aemet`, `collectors/open-meteo`, `packages/shared`, `api`, `db/migrations`, `infra`.
- Nuevas dependencias: Node 22, pnpm workspaces, Vitest, NestJS (+ `@nestjs/platform-fastify`), Drizzle ORM + `drizzle-kit`, `postgres` (driver), fast-xml-parser, `tar-stream`, iconv-lite, node-cron.
- Imagen de DB: `timescale/timescaledb-ha:pg16` (incluye PostGIS).
