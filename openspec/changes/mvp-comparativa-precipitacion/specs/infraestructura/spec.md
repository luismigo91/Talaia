# Capacidad: infraestructura

## ADDED Requirements

### Requirement: Despliegue en Dokploy
`infra/docker-compose.yml` DEBE ser desplegable como servicio *Compose* de Dokploy en modo Docker Compose, construyendo las imágenes desde el repo, con todos los servicios en la red externa `dokploy-network`, sin `container_name`, `api` con `expose` (no `ports`), y las variables sensibles (`AEMET_API_KEY`, `POSTGRES_PASSWORD`) leídas de `${VAR}` definidas en la UI de Dokploy.

#### Scenario: Despliegue en limpio
- **Dado** un servicio Compose en Dokploy apuntando al repo con las variables `AEMET_API_KEY`, `POSTGRES_PASSWORD` y `POSTGRES_USER/DB` definidas y un dominio asignado a `api:3000`
- **Cuando** se lanza *Deploy*
- **Entonces** en < 5 min (incluida la construcción) `GET https://<dominio>/api/v1/health` devuelve `ok:true`, `migrate` termina con exit 0, `/status` muestra `open-meteo` con `last_success_at` no nulo y `/compare?station=virtual:benetusser` devuelve series.

#### Scenario: Orden de arranque
- **Dado** que la DB tarda en aceptar conexiones
- **Entonces** `migrate` espera a `db` sana (`depends_on: service_healthy`), y `api`/`collectors` a que `migrate` complete; además, si la DB se reinicia, `api` y `collectors` reconectan sin intervención.

#### Scenario: Persistencia entre despliegues
- **Cuando** se redespliega tras un push
- **Entonces** los datos de la DB persisten (volumen `../files/db` o con nombre) y no se pierden las series.

### Requirement: Desarrollo local con Compose
`docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up` DEBE levantar el mismo conjunto en local con `.env` y puertos publicados.

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
