# Despliegue

Cada servicio tiene su propia imagen (target del `infra/Dockerfile`, podada con `pnpm deploy`) y se puede construir y desplegar por separado:

| Servicio | Target | Imagen | Comando |
|---|---|---|---|
| `api` | `api` | ~315 MB | `node dist/main.js` (aplica migraciones al arrancar y sirve `/api/v1/*` en :3000) |
| `collectors` | `collectors` | ~265 MB | `node dist/main.js` (aplica migraciones, scheduler de Open-Meteo y AEMET) |
| `db` | — | `timescale/timescaledb-ha:pg16` | TimescaleDB + PostGIS |

Las migraciones son idempotentes y usan un advisory lock, así que da igual qué servicio arranque primero o si arrancan a la vez. `RUN_MIGRATIONS=false` las desactiva en un servicio.

## Producción: Dokploy, un servicio por componente (recomendado)

1. **Base de datos**: *Create Service → Compose* con solo `db` (o *Database → PostgreSQL* con imagen personalizada `timescale/timescaledb-ha:pg16`, si tu versión de Dokploy lo permite). Anota el nombre de host interno del contenedor en `dokploy-network`.
2. **api**: *Create Service → Application*, proveedor Git (este repo, rama `main`), *Build Type* **Dockerfile**, *Docker File* `infra/Dockerfile`, *Docker Build Stage* `api`, *Docker Context Path* `.`.
   - Environment: `DATABASE_URL=postgres://talaia:<pass>@<host-db>:5432/talaia`, `LOG_LEVEL=info`.
   - Domains: puerto `3000`, HTTPS.
   - Auto Deploy activado.
3. **collectors**: igual que `api` con *Docker Build Stage* `collectors`; Environment: `DATABASE_URL`, `AEMET_API_KEY`, intervalos opcionales (`OPEN_METEO_INTERVAL_MIN`, `AEMET_FORECAST_INTERVAL_MIN`, `AEMET_ALERTS_INTERVAL_MIN`). Sin dominio. **Una sola réplica** (cuota de AEMET).

Cada Application se reconstruye y redespliega de forma independiente en cada push (Dokploy detecta cambios en todo el repo; si quieres limitar, usa *Watch Paths*: `api/**,packages/**,db/**` para `api` y `collectors/**,packages/**,db/**` para `collectors`).

## Producción: Dokploy, todo en un Compose

*Create Service → Compose*, *Compose Path* `infra/docker-compose.yml`, modo Docker Compose; variables `POSTGRES_PASSWORD` y `AEMET_API_KEY` en Environment; dominio al servicio `api`, puerto 3000. Construye ambos targets desde el repo.

## Desarrollo local

```bash
cp .env.example .env            # rellenar POSTGRES_PASSWORD y AEMET_API_KEY
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build
curl localhost:3000/api/v1/compare
```

Construir una imagen suelta:

```bash
docker build -f infra/Dockerfile --target api -t talaia-api .
docker build -f infra/Dockerfile --target collectors -t talaia-collectors .
```

Solo la base de datos (para tests de integración):

```bash
docker compose -f infra/docker-compose.test.yml up -d --wait
pnpm test:integration
```

Comprobación tras desplegar: `/api/v1/health` → `{"ok":true,"db":true}`; `/api/v1/status` muestra `open-meteo` con `last_success_at`; `/api/v1/compare?station=virtual:benetusser` devuelve series.
