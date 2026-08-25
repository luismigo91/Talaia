# Talaia — contexto del proyecto

> *Talaia* (valenciano: atalaya, torre de vigía). Portal personal que agrega datos meteorológicos, hidrológicos y de alertas de varias fuentes, los normaliza, los muestra y permite compararlas entre sí.

## Objetivo

Anticipar riesgo de inundación en las **localizaciones objetivo**, todas en la zona afectada por la DANA del 29‑10‑2024, priorizando las fuentes oficiales del Estado y de la Generalitat Valenciana:

| id estación virtual | Localidad | Municipio AEMET (INE) | Coordenadas | Zona avisos | Contexto hidrológico |
|---|---|---|---|---|---|
| `virtual:albal` | Albal (l'Horta Sud) | Albal `46007` | 39.397, −0.415 | `774602` | barranc del Poyo (rambla del Poyo) |
| `virtual:benetusser` | Benetússer (l'Horta Sud) | Benetússer `46054` | 39.4227, −0.3969 | `774602` | barranc del Poyo / Horteta, tramo bajo |
| `virtual:mareny-barraquetes` | Mareny de Barraquetes (pedanía de Sueca, costa de la Ribera Baixa) | Sueca `46235` | 39.2458, −0.2646 | `774604` | Xúquer bajo, Albufera, marjal; lluvia local y mar |
| `virtual:benaguasil` | Benaguasil (Camp de Túria) | Benaguasil `46051` | 39.6, −0.583 | `774602` | Túria (margen derecha) aguas abajo de Benagéber/Loriguilla; barrancos locales |

Albal es la localización principal (el semáforo se calibra primero ahí). El Mareny no es municipio: la predicción municipal de AEMET es la de Sueca (núcleo a ~7 km); la puntual viene de Open-Meteo. Los cauces y sensores SAIH a vigilar por localidad están en `docs/cuencas.md`.

## Estado actual

- **MVP implementado** (25‑08‑2026) según `openspec/changes/mvp-comparativa-precipitacion/`: collectors de Open-Meteo y AEMET, TimescaleDB, API NestJS con `/compare`, compose para Dokploy. Pendiente en `tasks.md`: desplegar en Dokploy con clave real de AEMET y sustituir las fixtures de AEMET por capturas reales; después archivar el cambio en `openspec/specs/`.
- Siguiente incremento previsto: collector SAIH Júcar (fase 2; sensores en `docs/cuencas.md`), luego Meteoalarm, semáforo y frontend.

## Estructura del monorepo

```
collectors/   Un paquete por fuente (aemet, open-meteo, saih, meteoalarm…). Cron cada 5–15 min. Desacoplados: uno puede fallar sin afectar al resto.
api/          REST + WebSocket. Calcula umbrales y semáforo de riesgo en servidor.
web/          Frontend (Mapa, Comparativa, Alertas). No existe todavía.
db/           Migraciones SQL de Postgres + TimescaleDB, seeds (estaciones, umbrales).
docs/         Documentación técnica en español. Contexto para sesiones futuras.
infra/        docker-compose, Dockerfiles, config de cron, CI.
openspec/     Especificaciones (OpenSpec): specs/ = comportamiento vigente; changes/ = propuestas.
```

## Fuentes de datos (ver `docs/fuentes.md` para las fichas completas)

| Fuente | Tipo | Acceso | Prioridad |
|---|---|---|---|
| AEMET OpenData | Predicción municipal horaria/diaria, observación, radar, avisos CAP | REST con `api_key`; respuesta en 2 pasos (URL intermedia `datos`). Cuota → cachear siempre | MVP |
| Open-Meteo | Predicción multi-modelo (ECMWF, GFS, ICON, AROME…) | REST sin clave. Uso no comercial | MVP |
| Meteoalarm | Avisos AEMET republicados en CAP/Atom | Feed público | Fase 2 |
| SAIH Júcar (CHJ) | Nivel/caudal de barrancos, embalses, pluviómetros en tiempo real | Sin API pública; scraping / exports internos | Fase 2 (clave para el Poyo) |
| MITECO / embalses.net | Estado de embalses | Boletín semanal / scraping | Fase 3 |
| GVA Emergències / 112 CV | Avisos Protección Civil | RSS / scraping | Fase 3 |
| Copernicus EFAS | Alerta europea de inundación | GRIB/NetCDF pesados | Fase 4 |
| AVAMET / Meteoclimatic | Estaciones amateur | Por ver | Fase 4 |

## Identificadores clave (verificados 25‑08‑2026, detalle en `docs/fuentes.md`)

- AEMET: municipios `46007`, `46054`, `46235`, `46051`; zonas de avisos `774602` (Litoral norte de Valencia) y `774604` (Litoral sur), área CCAA `77`; estaciones `8416` (València), `8414A` (Manises), `8337X` (Turís); radar `va`. Cuota 40 req/min; respuestas en ISO‑8859‑15; horas locales.
- Open-Meteo: modelos que cubren Albal: `meteofrance_arome_france_hd` (1,5 km), `icon_eu`, `ecmwf_ifs`, `gfs_seamless`, `arpege_europe`, `ukmo_global_deterministic_10km`. Hora de corrida vía `/data/{meta_id}/static/meta.json`.
- SAIH Júcar: caudal del Poyo en Riba‑roja = variable `13873` (estación 227), umbrales CHJ 30/70/150 m³/s; lluvia 24 h Chiva `15311`, Turís `16927`; Forata estación 303. Túria: Vilamarxant `12808`, salida Loriguilla `12905`, ramblas Castellana `13896` y Primera `13897`. Xúquer: Huerto Mulet `13070`, salida Tous `13080`, Magro en Guadassuar `14551`; lluvia Azud de Sueca est. 306. Inventario completo por localidad en `docs/cuencas.md`. Endpoint `GET https://saih.chj.es/admin/variables/valor/{id}/{YYYY-MM-DD HH:MM}/{…}` (sin auth, cincominutal, sin datos de la DANA).

## Arquitectura (pipeline vertical; ver `docs/arquitectura.md`)

Collector → Normalizador → TimescaleDB → API → Frontend.

- Cada collector guarda su marca `last_success_at` en `source_status` para mostrar frescura por fuente.
- El normalizador convierte cada fuente al esquema común. La comparativa entre fuentes es filtrar la misma `variable` por varias `source`.
- Umbrales y semáforo de riesgo se calculan **en servidor** para que pantalla y notificaciones vean lo mismo.

## Esquema común de datos

```
source, station_id, variable, value, unit, ts, geom [, forecast_ts]
```

- `ts`: instante para el que vale el dato (UTC, `timestamptz`).
- `forecast_ts`: instante de emisión de la predicción (NULL en observaciones). Permite comparar a posteriori el error de cada modelo.
- Variables canónicas: `precip_mm`, `precip_prob_pct`, `temp_c`, `rh_pct`, `wind_ms`, `gust_ms`, `river_level_m`, `river_flow_m3s`, `reservoir_hm3`, `reservoir_pct`.
- Unidades canónicas: mm, %, °C, m/s, m, m³/s, hm³. Se convierte en el normalizador, nunca en el frontend.
- Tablas: `observations`, `forecasts` (hypertables), `stations`, `sources`, `source_status`, `alerts`.

## Convenciones

- **Idioma**: español en docs, commits, comentarios y specs. Código e identificadores en inglés.
- **Commits**: Conventional Commits en español (`feat(collectors): añade collector AEMET`).
- **Especificación primero (OpenSpec)**: cambios de comportamiento nacen como propuesta en `openspec/changes/<nombre>/` (proposal + specs + tasks). Se implementa tras validación, con loop implementación → QA → tests en verde. Al terminar, se archiva y se fusiona en `openspec/specs/`.
- **Tests**: cada collector con tests unitarios sobre fixtures reales guardadas en `collectors/<fuente>/fixtures/` (respuestas capturadas de la API, nunca llamar a la red en tests).
- **Secretos**: nunca en el repo. `AEMET_API_KEY` y `POSTGRES_PASSWORD` como variables de entorno definidas en la UI de Dokploy (no soporta Docker secrets); en local, `.env` (ignorado) + `.env.example` documentado.
- **Zona horaria**: todo en UTC en base de datos; convertir a `Europe/Madrid` solo al presentar.
- **SQL crudo con Drizzle (`sql\`…\``)**: pasar fechas como `${d.toISOString()}::timestamptz`, nunca objetos `Date` (el cliente `postgres` va con `fetch_types: false` y no los serializa). Las tablas de filas de `db.execute<T>` deben ser `type`, no `interface`.
- **NestJS + Vitest**: esbuild no emite metadatos de decoradores; usar `@Inject(Token)` explícito y `ValidationPipe({ expectedType })` en lugar de confiar en el tipo del parámetro.
- **Docker**: imágenes ligeras e **independientes por servicio** (cada target solo lleva su paquete). Compatible con **Dokploy**: red `dokploy-network`, sin `container_name`, `api` con `expose` (dominio por UI), variables `${VAR}`. `collectors` un solo contenedor (cuota AEMET). Nuevos servicios = nuevo target en el Dockerfile + nueva Application.
- **Errores en collectors**: nunca lanzar excepciones no controladas fuera del collector; registrar fallo en `source_status` y continuar.

## Stack (decidido el 25‑08‑2026)

- Monorepo **pnpm workspaces**, **TypeScript / Node 22** en collectors y API.
- API: **NestJS** sobre adaptador Fastify.
- DB: **Postgres 16 + TimescaleDB + PostGIS** (`timescale/timescaledb-ha:pg16`). Acceso con **Drizzle ORM**; hypertables, políticas y PostGIS en migraciones SQL manuales.
- Collectors: proceso scheduler con `node-cron`, un job por fuente aislado.
- Tests: **Vitest** con fixtures reales; integración contra TimescaleDB en CI (GitHub Actions).
- Docker: **una imagen por servicio** (`infra/Dockerfile` targets `api` y `collectors`, podadas con `pnpm deploy`). **Producción en Dokploy** como una *Application* por servicio (Dockerfile + Build Stage) más la DB aparte; compose solo como alternativa/desarrollo. Cada servicio aplica migraciones al arrancar. Sin registro de imágenes.
- Frontend (futuro): Next.js + MapLibre.

## Comandos útiles

```bash
pnpm install                         # dependencias (pnpm 11, Node 22)
pnpm typecheck                       # build topológico + tsc en todos los paquetes
pnpm lint && pnpm prettier --check . # calidad
pnpm test                            # unitarios (Vitest, fixtures reales, sin red)
docker compose -f infra/docker-compose.test.yml up -d --wait   # solo TimescaleDB en :5433
pnpm test:integration                # integración (secuencial) contra esa DB
pnpm db:migrate                      # aplica db/migrations (DATABASE_URL)
pnpm --filter @talaia/collector-open-meteo run-once             # un ciclo del collector
pnpm --filter @talaia/collector-aemet run-once                  # requiere AEMET_API_KEY
pnpm --filter @talaia/api dev        # API en :3000 con recarga
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build  # stack completo local
```

Paquetes: `packages/shared` (esquema Drizzle, cliente DB, utilidades), `db` (migrador SQL propio, `db/migrations/NNNN_*.sql`), `collectors/{open-meteo,aemet,scheduler}`, `api` (NestJS/Fastify). Los tests importan `src` por alias de Vitest; `dist` solo se usa en Docker y en `run-once`/`start` — **rebuild (`pnpm typecheck`) antes de probar binarios**.
