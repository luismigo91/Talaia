# Capacidad: infraestructura

## ADDED Requirements

### Requirement: Arranque con un comando
`docker compose -f infra/docker-compose.yml up` DEBE levantar `db` (TimescaleDB + PostGIS), aplicar migraciones, y arrancar `collectors` (scheduler) y `api`, leyendo configuración de `.env` y la clave de AEMET del Docker secret `aemet_api_key` (`AEMET_API_KEY_FILE`), con fallback a `AEMET_API_KEY` si el fichero no existe.

#### Scenario: Arranque en limpio
- **Dado** un `.env` válido y el fichero `infra/secrets/aemet_api_key`
- **Cuando** se ejecuta `docker compose up`
- **Entonces** en < 2 min `GET http://localhost:3000/api/v1/health` devuelve `ok:true`, `/status` muestra al menos `open-meteo` con `last_success_at` no nulo y `/compare?station=virtual:benetusser` devuelve series.

### Requirement: Aislamiento de fallos
El scheduler DEBE ejecutar cada collector en su propio `try/catch` con timeout de 120 s; el fallo de uno NO DEBE impedir la ejecución de los demás ni detener el proceso.

#### Scenario: AEMET sin clave
- **Dado** que no existe el secret ni `AEMET_API_KEY`
- **Entonces** `aemet:*` registran `last_error` y `open-meteo` sigue escribiendo datos.

### Requirement: Intervalos configurables
Los intervalos DEBEN ser configurables por entorno: `AEMET_FORECAST_INTERVAL_MIN` (30), `AEMET_ALERTS_INTERVAL_MIN` (10), `OPEN_METEO_INTERVAL_MIN` (30).

### Requirement: Imágenes ligeras
Las imágenes de `collectors` y `api` DEBEN basarse en `node:22-alpine` con build multi-stage y solo dependencias de producción.

### Requirement: CI
Un workflow de GitHub Actions DEBE ejecutar lint, typecheck y tests unitarios en cada push/PR, y los tests de integración contra un servicio TimescaleDB; ninguno DEBE necesitar `AEMET_API_KEY`.
