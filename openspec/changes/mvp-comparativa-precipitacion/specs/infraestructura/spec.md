# Capacidad: infraestructura

## ADDED Requirements

### Requirement: Despliegue en Docker Swarm
`docker stack deploy -c infra/stack.yml talaia` DEBE levantar `db` (TimescaleDB + PostGIS, 1 réplica fijada por etiqueta de nodo), `migrate` (one-shot), `collectors` (1 réplica) y `api`, usando imágenes de registro y los secrets externos `aemet_api_key` y `postgres_password` (`*_FILE`). NO DEBE depender de `depends_on` ni de `build`.

#### Scenario: Despliegue en limpio
- **Dado** un Swarm con los dos secrets creados y un nodo etiquetado `talaia.db=true`
- **Cuando** se ejecuta `docker stack deploy`
- **Entonces** en < 3 min `GET http://<manager>:3000/api/v1/health` devuelve `ok:true`, `migrate` termina con exit 0 sin reinicios en bucle, `/status` muestra `open-meteo` con `last_success_at` no nulo y `/compare?station=virtual:benetusser` devuelve series.

#### Scenario: Orden de arranque
- **Dado** que `api` y `collectors` arrancan antes de que `db` acepte conexiones
- **Entonces** reintentan hasta 60 s y arrancan correctamente sin intervención.

#### Scenario: Actualización sin doble scheduler
- **Cuando** se actualiza la imagen de `collectors`
- **Entonces** en ningún momento hay dos tareas de `collectors` en ejecución.

### Requirement: Desarrollo local con Compose
`docker compose -f infra/docker-compose.yml up` DEBE levantar el mismo conjunto con `build` local, `.env` y la clave AEMET desde `AEMET_API_KEY` o un secret de fichero, para desarrollo sin Swarm.

#### Scenario: Arranque en local
- **Dado** un `.env` válido con `AEMET_API_KEY`
- **Cuando** se ejecuta `docker compose up`
- **Entonces** en < 2 min `/api/v1/health` devuelve `ok:true`.

### Requirement: Aislamiento de fallos
El scheduler DEBE ejecutar cada collector en su propio `try/catch` con timeout de 120 s; el fallo de uno NO DEBE impedir la ejecución de los demás ni detener el proceso.

#### Scenario: AEMET sin clave
- **Dado** que el secret `aemet_api_key` está vacío o no existe y tampoco `AEMET_API_KEY`
- **Entonces** `aemet:*` registran `last_error` y `open-meteo` sigue escribiendo datos.

### Requirement: Intervalos configurables
Los intervalos DEBEN ser configurables por entorno: `AEMET_FORECAST_INTERVAL_MIN` (30), `AEMET_ALERTS_INTERVAL_MIN` (10), `OPEN_METEO_INTERVAL_MIN` (30).

### Requirement: Imágenes ligeras
Las imágenes de `collectors` y `api` DEBEN basarse en `node:22-alpine` con build multi-stage y solo dependencias de producción.

### Requirement: CI y publicación de imágenes
Un workflow de GitHub Actions DEBE ejecutar lint, typecheck y tests unitarios en cada push/PR, y los tests de integración contra un servicio TimescaleDB; ninguno DEBE necesitar `AEMET_API_KEY`. En push a `main` (y tags) DEBE construir y publicar las imágenes `api`, `collectors` y `migrate` en GHCR con tags `sha-<short>` y `latest` (o la versión).

#### Scenario: Publicación
- **Cuando** se hace push a `main` con CI en verde
- **Entonces** existen las tres imágenes en GHCR con el tag del commit.
