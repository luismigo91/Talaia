# Despliegue

Cada servicio tiene su propio Dockerfile (podado con `pnpm deploy`) y se construye por separado:

| Servicio | Dockerfile | Comando | Dominio |
|---|---|---|---|
| `db` | — (`timescale/timescaledb-ha:pg16`) | TimescaleDB + PostGIS | no |
| `api` | `infra/Dockerfile.api` | `node dist/main.js` — sirve `/api/v1/*` en `:3000` | **no** (interna) |
| `collectors` | `infra/Dockerfile.collectors` | `node dist/main.js` — scheduler de todas las fuentes | no |
| `web` | `infra/Dockerfile.web` | `node web/server.js` — frontend Next.js en `:3001` | **sí** |

Las migraciones son idempotentes y usan un advisory lock, así que da igual qué servicio arranque primero o si arrancan a la vez. `RUN_MIGRATIONS=false` las desactiva en un servicio.

**El dominio va al servicio `web`, no a `api`.** El navegador nunca habla con la API: las páginas son Server Components que la consultan por dentro (`API_URL=http://api:3000`). Así solo `web` necesita dominio, no hay CORS y la API no queda expuesta.

## Variables de entorno

| Variable | Servicio | Obligatoria | Nota |
|---|---|---|---|
| `POSTGRES_PASSWORD` | db, api, collectors | **sí** | La misma en los tres |
| `API_URL` | web | sí (ya en compose) | `http://api:3000` |
| `AEMET_API_KEY` | collectors | no | Sin ella: predicción y observación de AEMET se registran como error; el resto funciona |
| `NTFY_URL`, `NTFY_TOKEN` | collectors | no | Notificaciones del semáforo; sin `NTFY_URL` solo se registran |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | **api y collectors** | no | Web Push. Las mismas en los dos servicios. Sin ellas, push desactivado |
| `LOG_LEVEL` | todos | no | `info` por defecto |

Intervalos opcionales (minutos), todos en `collectors`: `OPEN_METEO_INTERVAL_MIN`, `AEMET_FORECAST_INTERVAL_MIN`, `AEMET_ALERTS_INTERVAL_MIN`, `AEMET_OBSERVATION_INTERVAL_MIN`, `SAIH_INTERVAL_MIN`, `SAIH_BACKFILL_HOURS`, `METEOALARM_INTERVAL_MIN`, `AVAMET_INTERVAL_MIN`, `AVAMET_RADIUS_KM`, `GVA_INTERVAL_MIN`, `GVA_TTL_MINUTES`, `RISK_INTERVAL_MIN`, `RISK_FALL_CONFIRMATIONS`, `RISK_STALE_MINUTES`, `RISK_MAX_FLOW_JUMP`. Valores por defecto sensatos en `.env.example`.

## Producción: Dokploy, todo en un Compose (lo desplegado)

*Create Service → Compose*, *Compose Path* `infra/docker-compose.yml`, modo Docker Compose. Dokploy construye los tres servicios (cada uno con su Dockerfile) desde el repo y redespliega en cada push a `main`. **Nota**: si tu Dokploy corre Traefik en Swarm, un servicio de Compose no puede unirse a `dokploy-network` (error *"not manually attachable"*); en ese caso despliega cada servicio como **Application** (siguiente sección), que sí funciona.

1. En **Environment** del servicio, define al menos `POSTGRES_PASSWORD` (y `AEMET_API_KEY`, `NTFY_URL` si las tienes). Con la opción *"Create .env file"* activada, Dokploy las escribe en `infra/.env`, junto al compose, que el compose carga con `env_file` (tiene precedencia sobre el `../.env` de la raíz).
2. En **Domains**, asigna el dominio al servicio **`web`**, puerto **`3001`**, HTTPS. (Si venías del despliegue anterior con el dominio en `api`, **muévelo a `web`**.)
3. Auto Deploy activado.

Al añadir el servicio `web` respecto al despliegue anterior, basta con redeploy del Compose: el nuevo target se construye solo.

## Producción: Dokploy, una Application por servicio (alternativa)

*Create Service → Application* por cada uno (`api`, `collectors`, `web`), proveedor Git (este repo, rama `main`), *Build Type* **Dockerfile**, *Docker Context Path* `.`, y *Docker File* = `infra/Dockerfile.api` / `infra/Dockerfile.collectors` / `infra/Dockerfile.web` (cada servicio tiene el suyo; **no hay que indicar Build Stage**). La DB, como *Compose* con solo `db` o como servicio PostgreSQL con imagen `timescale/timescaledb-ha:pg16`. Dominio solo en `web` (puerto 3001). *Watch Paths* para limitar reconstrucciones: `api/**,packages/**,db/**` (api), `collectors/**,packages/**,db/**` (collectors), `web/**,packages/**` (web).

## Observabilidad

- `GET /api/v1/health` — devuelve `{ ok, db, sources, warnings }`. `ok=false` si alguna fuente está `stale` (30 min para SAIH/AVAMET/GVA/Meteoalarm, 120 min para Open-Meteo/AEMET). Útil para uptime checks en Dokploy.
- `GET /api/v1/status` — frescura por fuente (`age_seconds`, `stale`, `threshold_seconds`, `last_error`). El frontend lo usa para avisos de falta de datos; el semáforo no baja el nivel por silencio, solo avisa.

## Desarrollo local

```bash
cp .env.example .env            # rellenar POSTGRES_PASSWORD (AEMET_API_KEY opcional)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build
curl localhost:3000/api/v1/health  # health con fuentes
curl localhost:3000/api/v1/risk    # semáforo
```

El override de desarrollo publica los puertos `5432` (db) y `3000` (api). Para ver el frontend en local, lo más cómodo es `API_URL=http://127.0.0.1:3000 pnpm --filter @talaia/web dev` (puerto 3001).

Construir una imagen suelta:

```bash
docker build -f infra/Dockerfile.api        -t talaia-api .
docker build -f infra/Dockerfile.collectors -t talaia-collectors .
docker build -f infra/Dockerfile.web        -t talaia-web .
```
