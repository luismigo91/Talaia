# Tareas del MVP

## 0. Base del monorepo
- [ ] `pnpm-workspace.yaml`, `package.json` raíz, `tsconfig.base.json`, ESLint + Prettier, Vitest config.
- [ ] `packages/shared`: esquema Drizzle, cliente DB, tipos `Forecast`, `Observation`, `Alert`, `SourceStatus`; utilidades `toUtc(local, tz)`, `kmhToMs`; logger pino.

## 1. Base de datos
- [ ] Esquema Drizzle + `drizzle-kit generate`; migraciones SQL manuales (extensiones, hypertables, políticas, semillas de las 4 estaciones virtuales).
- [ ] `db/migrate.ts` con el migrator de Drizzle.
- [ ] Test de integración: migración limpia + idempotente + hypertables + políticas.

## 2. Collector Open-Meteo (primero: sin clave, desbloquea el endpoint)
- [ ] Cliente multi-localización (array) + mapeo `models → meta id`.
- [ ] Capturar fixtures reales (`forecast.json`, `meta-*.json`).
- [ ] Parser + tests (null, modelo ausente, convención de intervalo).
- [ ] `run()` con idempotencia por `forecast_ts` y `source_status`.

## 3. Collector AEMET
- [ ] `AemetClient` (dos pasos, charset, limitador, 429, cuerpo vacío; clave desde `AEMET_API_KEY_FILE` o `AEMET_API_KEY`) + tests con servidor mock.
- [ ] Capturar fixtures reales: horaria 46007, 46054, 46235 y 46051 (y un día de DST), tar CAP área 77 con avisos en 774602/774604 y sin avisos.
- [ ] `parseHourly` + tests.
- [ ] `parseCap` + tests (zona 774602, otra zona, sin aviso, upsert).
- [ ] `run()` para `aemet:forecast` y `aemet:alerts` con caché por hash.

## 4. Scheduler
- [ ] Proceso con `node-cron`, aislamiento, timeout, ejecución inicial, logs.

## 5. API
- [ ] NestJS (Fastify): módulos `/health`, `/status`, `/stations`, `/compare` con DTOs validados.
- [ ] Test de integración de `/compare` (última emisión, fuente sin datos, 400).

## 6. Infra y CI
- [ ] `infra/Dockerfile.node` multi-stage; `infra/docker-compose.yml` (db, migrate, collectors, api, secret `aemet_api_key`); `docker-compose.test.yml`.
- [ ] `.github/workflows/ci.yml`.
- [ ] Prueba de humo manual: `docker compose up` → `/status` y `/compare` con datos reales.

## 7. Cierre
- [ ] Actualizar `CLAUDE.md` (comandos, estado) y `docs/`.
- [ ] Archivar el cambio en `openspec/changes/archive/` y fusionar en `openspec/specs/`.
