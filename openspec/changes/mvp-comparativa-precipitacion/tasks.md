# Tareas del MVP

## 0. Base del monorepo
- [x] `pnpm-workspace.yaml`, `package.json` raíz, `tsconfig.base.json`, ESLint + Prettier, Vitest config.
- [x] `packages/shared`: esquema Drizzle, cliente DB, tipos `Forecast`, `Observation`, `Alert`, `SourceStatus`; utilidades `toUtc(local, tz)`, `kmhToMs`; logger pino.

## 1. Base de datos
- [x] Esquema Drizzle + `drizzle-kit generate`; migraciones SQL manuales (extensiones, hypertables, políticas, semillas de las 4 estaciones virtuales).
- [x] `db/migrate.ts` con el migrator de Drizzle.
- [x] Test de integración: migración limpia + idempotente + hypertables + políticas.

## 2. Collector Open-Meteo (primero: sin clave, desbloquea el endpoint)
- [x] Cliente multi-localización (array) + mapeo `models → meta id`.
- [x] Capturar fixtures reales (`forecast.json`, `meta-*.json`).
- [x] Parser + tests (null, modelo ausente, convención de intervalo).
- [x] `run()` con idempotencia por `forecast_ts` y `source_status`.

## 3. Collector AEMET
- [x] `AemetClient` (dos pasos, charset, limitador, 429, cuerpo vacío; clave desde `AEMET_API_KEY_FILE` o `AEMET_API_KEY`) + tests con servidor mock.
- [x] Fixtures: horaria real (fixture público de la API, municipio 28065) + derivada con día de DST; tar CAP construido según el Anexo 3 oficial (774602 amarillo, 774604 naranja, 774601, sin aviso).
- [ ] Sustituir las fixtures por capturas reales de 46007/46054/46235/46051 y del tar CAP del área 77 cuando haya clave de AEMET.
- [x] `parseHourly` + tests.
- [x] `parseCap` + tests (zona 774602, otra zona, sin aviso, upsert).
- [x] `run()` para `aemet:forecast` y `aemet:alerts` con caché por hash.

## 4. Scheduler
- [x] Proceso con `node-cron`, aislamiento, timeout, ejecución inicial, logs.

## 5. API
- [x] NestJS (Fastify): módulos `/health`, `/status`, `/stations`, `/compare` con DTOs validados.
- [x] Test de integración de `/compare` (última emisión, fuente sin datos, 400).

## 6. Infra y CI
- [x] `infra/Dockerfile` multi-stage con targets `api` y `collectors` podados con `pnpm deploy` (imágenes independientes).
- [x] `infra/docker-compose.yml` (targets por servicio, `dokploy-network`, `expose`, `${VAR}`, volumen `../files/db`; migraciones al arrancar en `api` y `collectors`), `docker-compose.override.yml` (local) y `docker-compose.test.yml`.
- [x] `infra/README.md`: alta del servicio Compose en Dokploy, variables a definir, dominio, auto-deploy.
- [x] `.github/workflows/ci.yml` (tests).
- [x] Prueba de humo: `docker compose up` en local → `/status` y `/compare` con datos reales.
- [ ] Prueba de humo: *Deploy* en Dokploy (Applications `api` y `collectors` + DB) con dominio y clave de AEMET reales.

## 7. Cierre
- [x] Actualizar `CLAUDE.md` (comandos, estado) y `docs/`.
- [ ] Archivar el cambio en `openspec/changes/archive/` y fusionar en `openspec/specs/`.
