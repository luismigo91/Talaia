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

Nueve incrementos implementados y verificados contra las fuentes reales (25–26‑08‑2026). Los tres primeros están **archivados** (`openspec/specs/`, once capacidades vigentes); el resto sigue en `openspec/changes/` pendiente de archivar.

| # | Incremento | Qué aporta |
|---|---|---|
| 1 | MVP | Collectors Open‑Meteo y AEMET, TimescaleDB, `/compare` |
| 2 | SAIH Júcar | 29 estaciones y 57 sensores, series cincominutales, `/sensors` y `/observations` |
| 3 | Semáforo | `watch_points`, `thresholds`, `/risk` con desglose explicable |
| 4 | Notificaciones | `risk_state`/`risk_events`, histéresis asimétrica, ntfy, `/risk/history` |
| 5 | Meteoalarm | Avisos oficiales **sin clave**; cierra la cuarta señal del semáforo |
| 6 | Frontend | `web/` (Next.js 16): semáforo, mapa, comparativa, avisos y detalle por localidad |
| 7 | Retención y CI | Compresión a 30 días, observaciones 3 años; CI construye frontend e imágenes |
| 8 | Observación y directo | Estaciones automáticas de AEMET; semáforo en vivo por SSE |
| 9 | Calibración y AVAMET | Backfill e informe de umbrales; estaciones amateur para el hueco del Horteta |
| 10 | GVA Emergències | Fases del plan de Protección Civil (Situación 0‑3) como cuarta señal de aviso |

**Hallazgo de la calibración**: el histórico del Poyo trae **picos espurios** —de 0,1 a 855 m³/s en cinco minutos, sostenidos media hora y de vuelta a cero, con `estado` normal—. El semáforo usa ahora la última lectura *creíble* (`lastPlausible`): un salto mayor de 250 m³/s queda en cuarentena y solo se acepta si se sostiene una hora. Sin eso habría dado rojo cinco veces en año y medio sin llover.

**Pendiente**:

- Desplegar el servicio `web` en Dokploy y **mover el dominio de `api` a `web`** (la API es interna a propósito).
- `AEMET_API_KEY` real: sin ella no entran la predicción municipal ni la observación de AEMET, y las fixtures de AEMET siguen sin ser capturas reales (ver final de `openspec/specs/collector-aemet/spec.md`).
- `NTFY_URL` si se quieren recibir las notificaciones; sin ella las transiciones solo se registran.
- Capturar una respuesta real de la GVA con emergencias activas (`z2` poblado) en el próximo episodio, para confirmar la fixture de test.

## Estructura del monorepo

```
collectors/   Un paquete por fuente (aemet, open-meteo, saih, meteoalarm…). Cron cada 5–15 min. Desacoplados: uno puede fallar sin afectar al resto.
api/          REST. Calcula umbrales y semáforo de riesgo en servidor (el cálculo vive en packages/shared para que el scheduler notifique exactamente lo mismo).
web/          Frontend Next.js 16 (App Router): semáforo, mapa y comparativa. Consume la API desde el servidor.
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
| Meteoalarm | Avisos AEMET republicados en CAP (API v1 JSON) | Feed público sin clave | **Implementado** (fase 5) |
| SAIH Júcar (CHJ) | Nivel/caudal de barrancos, embalses, pluviómetros en tiempo real | Sin API pública ni auth; endpoints internos `/admin/…` | **Implementado** (fase 2) |
| MITECO / embalses.net | Estado de embalses | Boletín semanal | **Descartado**: ya hay 6 embalses del SAIH cada 5 min |
| GVA Emergències / 112 CV | Fases del plan de emergencias (Situación 0‑3) | API JSON pública `wpr.112cv.gva.es` | **Implementado** (fase 10) |
| Copernicus EFAS | Alerta europea de inundación | GRIB/NetCDF | **Descartado para alerta**: ciego al Poyo (<500 km²). Solo histórico para calibrar |
| AVAMET | Estaciones amateur (l'Horta Sud); única señal del Horteta | Scraping HTML, CC BY‑NC‑ND | **Implementado** (fase 9) |

## Identificadores clave (verificados 25‑08‑2026, detalle en `docs/fuentes.md`)

- AEMET: municipios `46007`, `46054`, `46235`, `46051`; zonas de avisos `774602` (Litoral norte de Valencia: Albal, Benetússer y también **Benaguasil** pese a ser interior — no confundir con Benagéber `46050`, que sí es `774601`) y `774604` (Litoral sur: Sueca/Mareny), verificadas el 25‑08‑2026 contra el listado de municipios y el shapefile de zonas de AEMET; área CCAA `77`; estaciones `8416` (València), `8414A` (Manises), `8337X` (Turís); radar `va`. Cuota 40 req/min; respuestas en ISO‑8859‑15; horas locales.
- Open-Meteo: modelos que cubren Albal: `meteofrance_arome_france_hd` (1,5 km), `icon_eu`, `ecmwf_ifs`, `gfs_seamless`, `arpege_europe`, `ukmo_global_deterministic_10km`. Hora de corrida vía `/data/{meta_id}/static/meta.json`.
- SAIH Júcar: caudal del Poyo en Riba‑roja = variable `13873` (estación 227), umbrales CHJ 30/70/150 m³/s; lluvia (intensidad) Chiva `14079`, Turís `16922`, Azud de Sueca `2710`; Forata estación 303. Túria: Vilamarxant `12808`, salida Loriguilla `12905`, ramblas Castellana `13896` y Primera `13897`. Xúquer: Huerto Mulet `13070`, salida Tous `13080`, Magro en Guadassuar `14551`. Inventario completo por localidad en `docs/cuencas.md`; el catálogo vivo está en la tabla `sensors`. Endpoint `GET https://saih.chj.es/admin/variables/valor/{id}/{YYYY-MM-DD HH:MM}/{…}` (sin auth, cincominutal, sin datos de la DANA): **el rango va en hora local `Europe/Madrid` y la respuesta viene en UTC**.

## Arquitectura (pipeline vertical; ver `docs/arquitectura.md`)

Collector → Normalizador → TimescaleDB → API → Frontend.

- Cada collector guarda su marca `last_success_at` en `source_status` para mostrar frescura por fuente.
- El normalizador convierte cada fuente al esquema común. La comparativa entre fuentes es filtrar la misma `variable` por varias `source`.
- Umbrales y semáforo de riesgo se calculan **en servidor** para que pantalla y notificaciones vean lo mismo. El semáforo combina cuatro señales por **máximo**, nunca por media, y cada componente explica su nivel en español (ver `docs/arquitectura.md` §7).

## Esquema común de datos

```
source, station_id, variable, value, unit, ts, geom [, forecast_ts]
```

- `ts`: instante para el que vale el dato (UTC, `timestamptz`).
- `forecast_ts`: instante de emisión de la predicción (NULL en observaciones). Permite comparar a posteriori el error de cada modelo.
- Variables canónicas: `precip_mm`, `precip_prob_pct`, `precip_rate_mmh`, `precip_1h_mm`, `precip_12h_mm`, `precip_24h_mm`, `precip_day_mm`, `temp_c`, `rh_pct`, `wind_ms`, `gust_ms`, `river_level_m`, `river_flow_m3s`, `reservoir_hm3`, `reservoir_level_m`, `reservoir_pct`.
- Unidades canónicas: mm, mm/h, %, °C, m/s, m, m³/s, hm³. Se convierte en el normalizador, nunca en el frontend.
- Tablas: `observations`, `forecasts` (hypertables con compresión a 30 días; observaciones 3 años, predicciones 365 días), `stations`, `sensors`, `watch_points`, `thresholds`, `risk_state`, `risk_events`, `sources`, `source_status`, `alerts`.
- `sensors` = catálogo de sensores externos (sensor de la fuente → variable canónica, unidad y umbrales oficiales). Añadir un sensor es una fila, no un despliegue. Los sensores **derivados** (`meta.derived_from`) los calcula el collector y `loadSensors()` los excluye por defecto para no pedirlos al portal.
- `watch_points` = qué sensores vigila cada localización objetivo y con qué rol; `thresholds` = umbrales de lluvia (los de caudal ya vienen de la CHJ en `sensors`).

## Convenciones

- **Idioma**: español en docs, commits, comentarios y specs. Código e identificadores en inglés.
- **Commits**: Conventional Commits en español (`feat(collectors): añade collector AEMET`).
- **Especificación primero (OpenSpec)**: cambios de comportamiento nacen como propuesta en `openspec/changes/<nombre>/` (proposal + specs + tasks). Se implementa tras validación, con loop implementación → QA → tests en verde. Al terminar se archiva en `openspec/changes/archive/AAAA-MM-DD-<nombre>/` y sus specs se fusionan en `openspec/specs/<capacidad>/`, que es el comportamiento vigente.
- **Tests**: cada collector con tests unitarios sobre fixtures reales guardadas en `collectors/<fuente>/fixtures/` (respuestas capturadas de la API, nunca llamar a la red en tests).
- **Secretos**: nunca en el repo. `AEMET_API_KEY` y `POSTGRES_PASSWORD` como variables de entorno definidas en la UI de Dokploy (no soporta Docker secrets); en local, `.env` (ignorado) + `.env.example` documentado.
- **Zona horaria**: todo en UTC en base de datos; convertir a `Europe/Madrid` solo al presentar.
- **SQL crudo con Drizzle (`sql\`…\``)**: pasar fechas como `${d.toISOString()}::timestamptz`, nunca objetos `Date` (el cliente `postgres` va con `fetch_types: false` y no los serializa). Las tablas de filas de `db.execute<T>` deben ser `type`, no `interface`.
- **NestJS + Vitest**: esbuild no emite metadatos de decoradores; usar `@Inject(Token)` explícito y `ValidationPipe({ expectedType })` en lugar de confiar en el tipo del parámetro.
- **Docker**: imágenes ligeras e **independientes por servicio** (targets `api`, `collectors` y `web`; cada uno solo lleva su paquete). Compatible con **Dokploy**: sin redes explícitas (Dokploy gestiona la red al asignar dominio), sin `container_name`, `api` con `expose` (dominio por UI), variables `${VAR}`. `collectors` un solo contenedor (cuota AEMET). Nuevos servicios = nuevo target en el Dockerfile + nueva Application.
- **Errores en collectors**: nunca lanzar excepciones no controladas fuera del collector; registrar fallo en `source_status` y continuar. Si un ciclo escribe datos pero pierde parte de la fuente (p. ej. un sensor SAIH caído), devolver `warning` en el `RunResult`: se registra en `last_error` conservando el éxito.

## Stack (decidido el 25‑08‑2026)

- Monorepo **pnpm workspaces**, **TypeScript / Node 22** en collectors y API.
- API: **NestJS** sobre adaptador Fastify.
- DB: **Postgres 16 + TimescaleDB + PostGIS** (`timescale/timescaledb-ha:pg16`). Acceso con **Drizzle ORM**; hypertables, políticas y PostGIS en migraciones SQL manuales.
- Collectors: proceso scheduler con `node-cron`, un job por fuente aislado.
- Tests: **Vitest** con fixtures reales; integración contra TimescaleDB en CI (GitHub Actions).
- Docker: **una imagen por servicio** (un Dockerfile por servicio (`infra/Dockerfile.{api,collectors,web}`), podadas con `pnpm deploy`). **Producción en Dokploy** como una *Application* por servicio (Dockerfile + Build Stage) más la DB aparte; compose solo como alternativa/desarrollo. Cada servicio aplica migraciones al arrancar. Sin registro de imágenes.
- Frontend: **Next.js 16 (App Router) + React 19 + MapLibre**, `output: standalone`. Sin framework de CSS ni librería de gráficos: CSS con variables y SVG propio.

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
pnpm --filter @talaia/collector-saih run-once                   # sin clave; SAIH_BACKFILL_HOURS ajusta la 1.ª ventana
pnpm --filter @talaia/collector-meteoalarm run-once             # avisos oficiales sin clave
pnpm --filter @talaia/collector-avamet run-once                 # estaciones amateur (l'Horta Sud)
pnpm --filter @talaia/collector-saih backfill 2025-01-01        # histórico para calibrar
pnpm --filter @talaia/scheduler calibrate                       # informe de umbrales vs histórico
pnpm --filter @talaia/scheduler risk-once                       # fuerza una evaluación del semáforo
pnpm --filter @talaia/api dev        # API en :3000 con recarga
API_URL=http://127.0.0.1:3000 pnpm --filter @talaia/web dev   # frontend en :3001
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build  # stack completo local
```

Paquetes: `packages/shared` (esquema Drizzle, cliente DB, utilidades), `db` (migrador SQL propio, `db/migrations/NNNN_*.sql`), `collectors/{open-meteo,aemet,saih,meteoalarm,avamet,gva,scheduler}`, `api` (NestJS/Fastify), `web` (Next.js). Los tests importan `src` por alias de Vitest; `dist` solo se usa en Docker y en `run-once`/`start` — **rebuild (`pnpm typecheck`) antes de probar binarios**.
