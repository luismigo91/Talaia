# Despliegue

## Producción: Dokploy

1. **Crear el servicio**: *Create Service → Compose*, proveedor Git apuntando a este repo, rama `main`, *Compose Path* `infra/docker-compose.yml`, modo **Docker Compose** (no Stack: necesitamos `build`).
2. **Variables** (pestaña *Environment*):
   ```
   POSTGRES_PASSWORD=<contraseña fuerte>
   AEMET_API_KEY=<clave de https://opendata.aemet.es/centrodedescargas/altaUsuario>
   # opcionales
   OPEN_METEO_INTERVAL_MIN=30
   AEMET_FORECAST_INTERVAL_MIN=30
   AEMET_ALERTS_INTERVAL_MIN=10
   LOG_LEVEL=info
   ```
   Dokploy las escribe en un `.env` junto al compose; el compose las referencia con `${VAR}`.
3. **Dominio** (pestaña *Domains*): servicio `api`, puerto `3000`, HTTPS. Dokploy añade las labels de Traefik; el compose solo hace `expose`.
4. **Deploy**. La primera vez construye la imagen (~2–3 min). Activar *Auto Deploy* para redesplegar en cada push a `main`.
5. **Datos**: la DB persiste en `../files/db` (relativo al directorio del compose en el servidor Dokploy), convención de Dokploy para bind mounts. Backups: opcionalmente desde la sección *Backups* de Dokploy (requiere volumen con nombre; cambiar el volumen de `db` si se quiere).

Comprobación: `https://<dominio>/api/v1/health` → `{"ok":true,"db":true}`; `/api/v1/status` muestra `open-meteo` con `last_success_at`; `/api/v1/compare?station=virtual:benetusser` devuelve series.

## Desarrollo local

```bash
cp .env.example .env            # rellenar POSTGRES_PASSWORD y AEMET_API_KEY
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build
curl localhost:3000/api/v1/compare
```

Solo la base de datos (para tests de integración):

```bash
docker compose -f infra/docker-compose.test.yml up -d --wait
pnpm test:integration
```

## Servicios

| Servicio | Comando | Notas |
|---|---|---|
| `db` | TimescaleDB HA pg16 (incluye PostGIS) | healthcheck `pg_isready` |
| `migrate` | `node db/dist/migrate.js` | one-shot; `api` y `collectors` esperan a que termine |
| `collectors` | `node collectors/scheduler/dist/main.js` | un solo contenedor (cuota AEMET); healthcheck por heartbeat |
| `api` | `node api/dist/main.js` | `expose 3000`; healthcheck `/api/v1/health` |

Los tres servicios Node usan la misma imagen (`infra/Dockerfile`), construida una vez.
