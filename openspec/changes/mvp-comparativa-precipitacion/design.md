# Diseño técnico del MVP

(Refleja las decisiones de `proposal.md`.)

## Estructura de paquetes (pnpm workspaces)

```
packages/shared/          esquema Drizzle (db/schema.ts), cliente DB (drizzle + driver `postgres`), tipos del esquema común, utilidades de tiempo/unidades, logger
collectors/aemet/         cliente OpenData + parsers (horaria, CAP) + normalizador + run()
collectors/open-meteo/    cliente + parser multi-modelo + normalizador + run()
collectors/scheduler/     proceso largo: node-cron → ejecuta run() de cada collector con aislamiento
api/                      NestJS (adaptador Fastify): módulos health, status, stations, compare
db/migrations/            migraciones SQL generadas por drizzle-kit + SQL manual (extensiones, hypertables, políticas, seeds)
db/migrate.ts             aplica migraciones pendientes (drizzle-orm/migrator)
infra/stack.yml           stack para Docker Swarm (docker stack deploy): db, migrate, collectors, api
infra/docker-compose.yml  desarrollo local (build, .env, sin Swarm)
infra/Dockerfile.node     multi-stage, node:22-alpine, un target por servicio
```

## Esquema de base de datos (SQL definitivo del MVP)

Las tablas se declaran en Drizzle (`packages/shared/src/db/schema.ts`) y `drizzle-kit generate` produce el SQL de tablas/índices; las sentencias de extensiones, `create_hypertable`, políticas de retención y semillas se añaden a mano como migraciones SQL (Drizzle no las modela). El SQL resultante equivale a:

```sql
-- 0001
create extension if not exists timescaledb;
create extension if not exists postgis;

-- 0002
create table sources (
  id    text primary key,
  name  text not null,
  kind  text not null check (kind in ('official','model','amateur')),
  url   text
);
create table stations (
  id          text primary key,
  source      text not null references sources(id),
  name        text not null,
  kind        text not null check (kind in ('station','municipality','locality','gauge','reservoir','rain_gauge')),
  geom        geometry(Point,4326) not null,
  elevation_m real,
  meta        jsonb not null default '{}'
);
create table source_status (
  source          text primary key references sources(id),
  last_run_at     timestamptz,
  last_success_at timestamptz,
  last_error      text,
  records_written integer,
  payload_hash    text
);

-- 0003
create table forecasts (
  source      text not null,
  station_id  text not null references stations(id),
  variable    text not null,
  forecast_ts timestamptz not null,
  ts          timestamptz not null,
  value       double precision,
  unit        text not null,
  primary key (source, station_id, variable, forecast_ts, ts)
);
select create_hypertable('forecasts','ts', chunk_time_interval => interval '7 days');
create index forecasts_latest_idx on forecasts (source, station_id, variable, forecast_ts desc, ts);

create table observations (
  source     text not null,
  station_id text not null references stations(id),
  variable   text not null,
  ts         timestamptz not null,
  value      double precision,
  unit       text not null,
  quality    smallint,
  primary key (source, station_id, variable, ts)
);
select create_hypertable('observations','ts', chunk_time_interval => interval '7 days');

create table raw_payloads (
  id         bigserial,
  source     text not null,
  fetched_at timestamptz not null default now(),
  url        text not null,
  hash       text not null,
  body       bytea not null,
  primary key (id, fetched_at)
);
select create_hypertable('raw_payloads','fetched_at', chunk_time_interval => interval '1 day');
select add_retention_policy('raw_payloads', interval '7 days');
select add_retention_policy('forecasts', interval '365 days');

-- 0004
create table alerts (
  id          text primary key,             -- CAP <identifier>
  source      text not null,
  area_code   text not null,
  area_name   text,
  event_code  text,                         -- 'PR'
  event       text,                         -- 'Lluvias'
  level       text not null check (level in ('verde','amarillo','naranja','rojo')),
  severity    text,                         -- CAP severity
  parameter   text,                         -- 'Precipitación acumulada en 12 horas;60 mm'
  onset       timestamptz not null,
  expires     timestamptz not null,
  sent        timestamptz not null,
  headline    text,
  description text,
  geom        geometry(MultiPolygon,4326),
  raw         jsonb not null,
  updated_at  timestamptz not null default now()
);
create index alerts_active_idx on alerts (area_code, expires);

-- 0005 seeds
insert into sources values
 ('aemet','AEMET OpenData','official','https://opendata.aemet.es'),
 ('open-meteo:meteofrance_arome_france_hd','Météo-France AROME HD 1,5 km (Open-Meteo)','model','https://open-meteo.com'),
 ('open-meteo:icon_eu','DWD ICON EU 7 km (Open-Meteo)','model','https://open-meteo.com'),
 ('open-meteo:ecmwf_ifs','ECMWF IFS 9 km (Open-Meteo)','model','https://open-meteo.com'),
 ('open-meteo:gfs_seamless','NCEP GFS 13 km (Open-Meteo)','model','https://open-meteo.com'),
 ('open-meteo:arpege_europe','Météo-France ARPEGE 11 km (Open-Meteo)','model','https://open-meteo.com'),
 ('open-meteo:ukmo_global_deterministic_10km','UKMO Global 10 km (Open-Meteo)','model','https://open-meteo.com'),
 ('virtual','Puntos virtuales','official',null);
insert into stations (id,source,name,kind,geom,elevation_m,meta) values
 ('virtual:albal','virtual','Albal','municipality',ST_SetSRID(ST_Point(-0.415,39.397),4326),14,
   '{"ine":"46007","aemet_zone":"774602","primary":true}'),
 ('virtual:benetusser','virtual','Benetússer','municipality',ST_SetSRID(ST_Point(-0.3969,39.4227),4326),15,
   '{"ine":"46054","aemet_zone":"774602"}'),
 ('virtual:mareny-barraquetes','virtual','Mareny de Barraquetes (Sueca)','locality',ST_SetSRID(ST_Point(-0.2646,39.2458),4326),2,
   '{"ine":"46235","aemet_zone":"774604","aemet_note":"predicción municipal de Sueca"}'),
 ('virtual:benaguasil','virtual','Benaguasil','municipality',ST_SetSRID(ST_Point(-0.583,39.6),4326),103,
   '{"ine":"46051","aemet_zone":"774602"}');
```

Nota: `source_status` tiene una fila por `source` lógica de collector: `aemet:forecast:<ine>` (una por municipio), `aemet:alerts`, `open-meteo`. Para eso `source_status.source` **no** referencia `sources` (se relaja la FK) — decisión: `source_status.source text primary key` sin FK.

## Localizaciones objetivo

Los collectors leen las estaciones `kind in ('municipality','locality')` con `source='virtual'` de la tabla `stations` al arrancar cada ejecución. AEMET usa `meta.ine`; Open-Meteo usa `geom`; el filtro de avisos usa el conjunto distinto de `meta.aemet_zone`. No hay `TARGET_*` en el entorno.

## Collector AEMET

- `AemetClient.get(path)`: GET con header `api_key`; parsea JSON del paso 1; si `estado != 200` o cuerpo vacío → error tipado (`AemetError{estado}`); GET a `datos` como bytes; decodifica según `charset` del `Content-Type` (fallback `ISO-8859-15`, `iconv-lite`). Reintento único ante 429 con espera de 61 s. Limitador: mínimo 1,6 s entre peticiones (≈37/min).
- **Caché**: SHA‑256 del cuerpo de `datos`; si coincide con `source_status.payload_hash` → no reescribir, solo `last_success_at`.
- `parseHourly(json, tz='Europe/Madrid')` → filas `{ts, variable, value, unit}`:
  - `forecast_ts` = `elaborado` interpretado en `Europe/Madrid` → UTC.
  - `ts` = `fecha` del día + `periodo` (hora local) → UTC. `precipitacion` con `periodo="07"` vale para la hora 06–07 local; se guarda con `ts` = **inicio del intervalo** (06:00 local), convención global del proyecto: `ts` = inicio del intervalo horario.
  - `probPrecipitacion` en tramos de 6 h → replicar a cada hora del tramo (`precip_prob_pct`).
  - Strings → número; `""` → se omite la fila.
  - viento km/h → m/s.
- `parseCap(tarGz)` → extraer con `tar-stream` + `zlib`, parsear cada XML (`fast-xml-parser`), tomar `<info>` en `es-ES`, filtrar `geocode` por las zonas objetivo (`774602`, `774604`), descartar `severity=Minor`/nivel verde (o guardarlos con `level='verde'` — **se guardan**, sirven para mostrar "sin avisos vigentes" con fecha). `id` = `<identifier>`. Upsert por `id`.
- Una consulta por municipio distinto (`meta.ine` deduplicado), en secuencia respetando el limitador: 4 municipios = 8 peticiones. Fuente lógica en `source_status`: `aemet:forecast:<ine>`.
- Programación: horaria cada 30 min (la predicción se emite ~4 veces/día; la caché evita reescrituras); avisos cada 10 min.

## Collector Open-Meteo

- Una petición con las cuatro localizaciones (`latitude=a,b,c&longitude=…`; la respuesta es un array en el mismo orden ✅), `models=` los 6 y `hourly=precipitation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,cape&wind_speed_unit=ms&timezone=UTC&forecast_days=3`.
- Antes, `meta.json` de cada modelo (mapa `models id → meta id` en `docs/fuentes.md`) → `forecast_ts = last_run_initialisation_time`. Si `meta.json` falla, `forecast_ts` = hora de descarga truncada a la hora y se registra advertencia. Para `gfs_seamless` (virtual) usar `ncep_gfs013`.
- Parser tolerante: claves `<var>_<model>` ausentes o `null` → omitir. `ts` = `time[i]` (UTC; en Open-Meteo `precipitation` en `time=T` es la suma de la hora **anterior** → `ts = T - 1h` para respetar la convención "inicio del intervalo").
- Idempotencia: PK de `forecasts` + `on conflict do update`. Si `forecast_ts` no cambió respecto a la última corrida almacenada para ese modelo, se salta la escritura.
- Programación: cada 30 min.

## Scheduler

- Proceso Node con `node-cron`; cada job envuelve `run()` en `try/catch`, timeout de 120 s, escribe `source_status`. Un fallo nunca detiene el proceso. Logs JSON (pino).
- Al arrancar ejecuta todos los collectors una vez.

## API

- NestJS 11 sobre `@nestjs/platform-fastify`. Validación de query con DTOs (`class-validator`) o `zod` + pipe. Módulos: `HealthModule`, `StatusModule`, `StationsModule`, `CompareModule`; `DbModule` global que expone la instancia Drizzle de `packages/shared`.
- La query de comparativa se ejecuta como SQL crudo vía `sql` de Drizzle (CTE con `max(forecast_ts)`).
- `GET /api/v1/health` → `{ok:true, db:true}`.
- `GET /api/v1/stations` → estaciones virtuales (id, nombre, lat, lon, ine, zona).
- `GET /api/v1/status` → lista de `source_status` con `age_seconds`.
- `GET /api/v1/compare?variable=precip_mm&station=virtual:albal&hours=24`:

```sql
with latest as (
  select source, max(forecast_ts) as forecast_ts
  from forecasts
  where station_id=$1 and variable=$2 and ts >= $3 and ts < $4
  group by source
)
select f.source, f.forecast_ts, f.ts, f.value, f.unit
from forecasts f join latest l using (source, forecast_ts)
where f.station_id=$1 and f.variable=$2 and f.ts >= $3 and f.ts < $4
order by f.source, f.ts;
```

Respuesta:

```json
{
  "station": {"id":"virtual:albal","name":"Albal","lat":39.397,"lon":-0.415},
  "variable": "precip_mm", "unit": "mm",
  "from": "2026-08-25T14:00:00Z", "to": "2026-08-26T14:00:00Z",
  "series": [
    {"source":"aemet","name":"AEMET OpenData","forecast_ts":"2026-08-25T10:47:45Z",
     "total": 12.4, "max_hourly": 6.1,
     "points":[{"ts":"2026-08-25T14:00:00Z","value":0.0}, …]},
    {"source":"open-meteo:meteofrance_arome_france_hd", …}
  ],
  "summary": {"min_total":3.2,"median_total":9.8,"max_total":21.0,"sources":7}
}
```

Series sin datos en la ventana se omiten; `summary` se calcula en servidor.

## Despliegue en Docker Swarm

Producción = `docker stack deploy -c infra/stack.yml talaia` en el homelab. Desarrollo = `docker compose -f infra/docker-compose.yml up` (con `build`).

- **Imágenes**: `docker stack deploy` ignora `build`; las imágenes se publican en un registro (GHCR, `ghcr.io/<usuario>/talaia-{api,collectors,migrate}:<tag>`) desde GitHub Actions y el stack las referencia por tag. Alternativa sin registro: `docker build` en el nodo manager y `image:` local (solo válido en Swarm de un nodo).
- **Secrets**: externos, creados una vez con `docker secret create aemet_api_key -` y `docker secret create postgres_password -`; en el stack `secrets: aemet_api_key: {external: true}`. Los servicios reciben `AEMET_API_KEY_FILE=/run/secrets/aemet_api_key` y `POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password` (la imagen oficial de Postgres/Timescale soporta `_FILE`). El código lee el fichero si existe y, si no, `AEMET_API_KEY` (desarrollo local con compose).
- **Configuración no secreta**: variables `environment` en el stack (intervalos, puerto, `TZ=UTC`); opcionalmente `configs` de Swarm.
- **DB**: servicio `db` con `deploy.replicas: 1`, `placement.constraints: [node.labels.talaia.db == true]` y volumen local en ese nodo (Timescale no se replica; un solo nodo). `stop_grace_period: 1m`.
- **Sin `depends_on`**: Swarm no lo respeta. `migrate`, `collectors` y `api` esperan a la DB con reintentos (bucle de `select 1` hasta 60 s) al arrancar.
- **Migraciones**: servicio `migrate` con `deploy.restart_policy.condition: on-failure` y `max_attempts: 5`; termina con exit 0 tras aplicar (Swarm no lo reinicia). Alternativa: `api` aplica migraciones al arrancar con lock advisory; se elige el servicio `migrate` para no acoplar.
- **Redes**: red overlay `talaia` interna; `api` publica el puerto (`ports: ["3000:3000"]`, modo ingress) o se expone vía el proxy inverso ya existente en el homelab (Traefik/Caddy) con labels.
- **Healthchecks**: `api` → `GET /api/v1/health`; `collectors` → fichero de heartbeat que el scheduler toca en cada ciclo; `db` → `pg_isready`.
- **Logs**: stdout JSON (pino); `docker service logs`.
- **Actualización**: `deploy.update_config: {order: start-first, failure_action: rollback}` en `api`; `collectors` con `order: stop-first` (evita dos schedulers concurrentes contra la cuota de AEMET) y `replicas: 1` siempre.

## Tests

- Unitarios (Vitest) con fixtures reales en `collectors/*/fixtures/`: parseo horario AEMET (DST incluido: un fixture de un día de cambio de hora), parseo CAP (tar real con avisos amarillo/naranja + "sin aviso"), parseo multi-modelo Open-Meteo con `null` y modelos ausentes, conversión de unidades.
- Integración: `docker compose -f infra/docker-compose.test.yml` con TimescaleDB, migraciones + inserción + `/compare` (Vitest + `testcontainers` o compose en CI).
- CI (GitHub Actions): lint, typecheck, unit, integración con servicio Postgres/Timescale.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| AEMET caído o 429 | Caché, limitador, reintento único, `source_status.last_error`; Open-Meteo sigue funcionando |
| Cambio de formato Open-Meteo | Parser tolerante + tests con fixture; alerta si 0 filas |
| Errores de zona horaria (AEMET local, Open-Meteo UTC) | Tests con fixture de DST; todo en UTC en DB |
| `meta.json` desalineado con `models` | Tabla de mapeo explícita + fallback a hora de descarga |
