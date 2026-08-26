# Despliegue

Cada servicio tiene su propia imagen (target del `infra/Dockerfile`, podada con `pnpm deploy`) y se puede construir por separado:

| Servicio | Target | Comando | Dominio |
|---|---|---|---|
| `db` | — (`timescale/timescaledb-ha:pg16`) | TimescaleDB + PostGIS | no |
| `api` | `api` | `node dist/main.js` — sirve `/api/v1/*` en `:3000` | **no** (interna) |
| `collectors` | `collectors` | `node dist/main.js` — scheduler de todas las fuentes | no |
| `web` | `web` | `node web/server.js` — frontend Next.js en `:3001` | **sí** |

Las migraciones son idempotentes y usan un advisory lock, así que da igual qué servicio arranque primero o si arrancan a la vez. `RUN_MIGRATIONS=false` las desactiva en un servicio.

**El dominio va al servicio `web`, no a `api`.** El navegador nunca habla con la API: las páginas son Server Components que la consultan por dentro (`API_URL=http://api:3000`). Así solo `web` necesita dominio, no hay CORS y la API no queda expuesta.

## Variables de entorno

| Variable | Servicio | Obligatoria | Nota |
|---|---|---|---|
| `POSTGRES_PASSWORD` | db, api, collectors | **sí** | La misma en los tres |
| `API_URL` | web | sí (ya en compose) | `http://api:3000` |
| `AEMET_API_KEY` | collectors | no | Sin ella: predicción y observación de AEMET se registran como error; el resto funciona |
| `NTFY_URL`, `NTFY_TOKEN` | collectors | no | Notificaciones del semáforo; sin `NTFY_URL` solo se registran |
| `LOG_LEVEL` | todos | no | `info` por defecto |

Intervalos opcionales (minutos), todos en `collectors`: `OPEN_METEO_INTERVAL_MIN`, `AEMET_FORECAST_INTERVAL_MIN`, `AEMET_ALERTS_INTERVAL_MIN`, `AEMET_OBSERVATION_INTERVAL_MIN`, `SAIH_INTERVAL_MIN`, `SAIH_BACKFILL_HOURS`, `METEOALARM_INTERVAL_MIN`, `AVAMET_INTERVAL_MIN`, `AVAMET_RADIUS_KM`, `GVA_INTERVAL_MIN`, `GVA_TTL_MINUTES`, `RISK_INTERVAL_MIN`, `RISK_FALL_CONFIRMATIONS`, `RISK_STALE_MINUTES`, `RISK_MAX_FLOW_JUMP`. Valores por defecto sensatos en `.env.example`.

## Producción: Dokploy, todo en un Compose (lo desplegado)

*Create Service → Compose*, *Compose Path* `infra/docker-compose.yml`, modo Docker Compose. Dokploy construye los tres targets desde el repo y redespliega en cada push a `main`.

1. En **Environment** del servicio, define al menos `POSTGRES_PASSWORD` (y `AEMET_API_KEY`, `NTFY_URL` si las tienes). Con la opción *"Create .env file"* activada, Dokploy las escribe en `infra/.env`, junto al compose, que el compose carga con `env_file` (tiene precedencia sobre el `../.env` de la raíz).
2. En **Domains**, asigna el dominio al servicio **`web`**, puerto **`3001`**, HTTPS. (Si venías del despliegue anterior con el dominio en `api`, **muévelo a `web`**.)
3. Auto Deploy activado.

Al añadir el servicio `web` respecto al despliegue anterior, basta con redeploy del Compose: el nuevo target se construye solo.

## Producción: Dokploy, una Application por servicio (alternativa)

*Create Service → Application* por cada uno (`api`, `collectors`, `web`), proveedor Git (este repo, rama `main`), *Build Type* **Dockerfile**, *Docker File* `infra/Dockerfile`, *Docker Context Path* `.`, y *Docker Build Stage* = `api` / `collectors` / `web`. La DB, como *Compose* con solo `db` o como servicio PostgreSQL con imagen `timescale/timescaledb-ha:pg16`. Dominio solo en `web` (puerto 3001). *Watch Paths* para limitar reconstrucciones: `api/**,packages/**,db/**` (api), `collectors/**,packages/**,db/**` (collectors), `web/**,packages/**` (web).

## Desarrollo local

```bash
cp .env.example .env            # rellenar POSTGRES_PASSWORD (AEMET_API_KEY opcional)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build
curl localhost:3000/api/v1/risk # la API (el override publica 3000)
```

El override de desarrollo publica los puertos `5432` (db) y `3000` (api). Para ver el frontend en local, lo más cómodo es `API_URL=http://127.0.0.1:3000 pnpm --filter @talaia/web dev` (puerto 3001).

Construir una imagen suelta:

```bash
docker build -f infra/Dockerfile --target api        -t talaia-api .
docker build -f infra/Dockerfile --target collectors -t talaia-collectors .
docker build -f infra/Dockerfile --target web        -t talaia-web .
```
