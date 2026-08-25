# Capacidad: infraestructura

## ADDED Requirements

### Requirement: Imagen independiente por servicio
`infra/Dockerfile` DEBE exponer un target por servicio (`api`, `collectors`) que produzca una imagen con solo ese paquete y sus dependencias de producción, construible y desplegable por separado (Application de Dokploy con *Docker Build Stage*), y `api` y `collectors` DEBEN aplicar las migraciones al arrancar de forma idempotente y concurrente-segura.

#### Scenario: Builds independientes
- **Cuando** se ejecuta `docker build --target api` y `docker build --target collectors`
- **Entonces** se obtienen dos imágenes distintas, ninguna contiene el código del otro servicio, y cada una arranca con `node dist/main.js`.

#### Scenario: Arranque simultáneo contra una DB vacía
- **Dado** `api` y `collectors` arrancando a la vez contra una DB recién creada
- **Entonces** ambos terminan con las migraciones aplicadas una sola vez, sin error, y `/api/v1/health` devuelve `ok:true`.

#### Scenario: Despliegue en Dokploy
- **Dado** una Application por servicio con `DATABASE_URL` (y `AEMET_API_KEY` en `collectors`) y un dominio en `api:3000`
- **Cuando** se lanza *Deploy* de cada una
- **Entonces** `GET https://<dominio>/api/v1/health` devuelve `ok:true`, `/status` muestra `open-meteo` con `last_success_at` no nulo y `/compare?station=virtual:benetusser` devuelve series.

### Requirement: Desarrollo local con Compose
`docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up` DEBE levantar `db`, `api` y `collectors` en local construyendo los mismos targets, con `.env` y puertos publicados.

#### Scenario: Arranque en local
- **Dado** un `.env` válido con `AEMET_API_KEY`
- **Cuando** se ejecuta `docker compose up`
- **Entonces** en < 2 min `http://localhost:3000/api/v1/health` devuelve `ok:true`.

### Requirement: Aislamiento de fallos
El scheduler DEBE ejecutar cada collector en su propio `try/catch` con timeout de 120 s; el fallo de uno NO DEBE impedir la ejecución de los demás ni detener el proceso.

#### Scenario: AEMET sin clave
- **Dado** `AEMET_API_KEY` vacía
- **Entonces** `aemet:*` registran `last_error` y `open-meteo` sigue escribiendo datos.

### Requirement: Intervalos configurables
Los intervalos DEBEN ser configurables por entorno: `AEMET_FORECAST_INTERVAL_MIN` (30), `AEMET_ALERTS_INTERVAL_MIN` (10), `OPEN_METEO_INTERVAL_MIN` (30).

### Requirement: Imágenes ligeras
Las imágenes de `collectors` y `api` DEBEN basarse en `node:22-alpine` con build multi-stage y solo dependencias de producción.

### Requirement: CI
Un workflow de GitHub Actions DEBE ejecutar lint, typecheck y tests unitarios en cada push/PR, y los tests de integración contra un servicio TimescaleDB; ninguno DEBE necesitar `AEMET_API_KEY`. El despliegue lo hace Dokploy (auto-deploy en push a `main`); no se publican imágenes en un registro.
