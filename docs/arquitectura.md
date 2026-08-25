# Arquitectura de Talaia

## Visión general

Pipeline vertical, desacoplado por fuente:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ collector    │  │ collector    │  │ collector    │   … uno por fuente,
│ aemet        │  │ open-meteo   │  │ saih         │     cron 5–15 min
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │ raw             │ raw             │ raw
       ▼                 ▼                 ▼
┌──────────────────────────────────────────────────┐
│ normalizador (por fuente) → esquema común        │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ Postgres 16 + TimescaleDB                        │
│ observations · forecasts · stations · alerts     │
│ source_status · continuous aggregates            │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ API (REST + WebSocket)                           │
│ comparativa · frescura · umbrales · semáforo     │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ Web: Mapa · Comparativa · Alertas (+ push)       │
└──────────────────────────────────────────────────┘
```

Principio rector: **que una fuente falle no debe afectar al resto**, y **el riesgo se calcula en un solo sitio (servidor)**.

## 1. Collectors

- Un paquete por fuente en `collectors/<fuente>/`. Cada uno expone una función `run()` idempotente que:
  1. Descarga los datos crudos (con reintentos y timeout).
  2. Guarda opcionalmente el crudo en `raw_payloads` (para depurar y reprocesar; retención corta, p. ej. 7 días).
  3. Normaliza al esquema común.
  4. Hace *upsert* en `observations` / `forecasts` / `alerts`.
  5. Actualiza `source_status` (`last_run_at`, `last_success_at`, `last_error`, `records_written`).
- Ejecución por **cron** (en el MVP, un proceso *scheduler* dentro del contenedor de collectors con `node-cron`; alternativa: cron del host lanzando `docker compose run`). Intervalos orientativos:
  - AEMET predicción horaria: cada 60 min (AEMET la actualiza pocas veces al día; cuota).
  - AEMET avisos CAP: cada 10 min.
  - AEMET observación: cada 30 min (los datos llegan con ~1 h de retraso).
  - Open-Meteo: cada 30 min.
  - SAIH: cada 5–10 min (fase 2).
- Los collectors **nunca** llaman a la red en tests: se usan *fixtures* capturadas en `collectors/<fuente>/fixtures/`.
- Caché HTTP obligatoria para AEMET (cuota): se guarda `ETag`/hash del payload y no se reescribe si no ha cambiado.

## 2. Normalizador

Convierte cada fuente a filas del esquema común. Responsabilidades:

- Mapear variables de la fuente a **variables canónicas** (tabla en `docs/fuentes.md` por fuente).
- Convertir unidades a las canónicas (p. ej. km/h → m/s).
- Convertir tiempos a UTC `timestamptz`. Ojo con AEMET, que da horas locales (`Europe/Madrid`) y períodos ("0107" = 01–07 h).
- Resolver `station_id` (estación física o "punto virtual" para predicciones: `virtual:albal`, `virtual:benetusser`, `virtual:mareny-barraquetes`, con `geom` del punto objetivo y `meta.ine` / `meta.aemet_zone` para AEMET). Las localizaciones objetivo viven en la tabla `stations`, no en configuración.
- Para predicciones, fijar `forecast_ts` = hora de emisión (`elaborado` en AEMET; hora de corrida del modelo en Open-Meteo, si está disponible; si no, hora de descarga truncada).

## 3. Almacenamiento: esquema de datos

### Tablas de referencia

```sql
sources (
  id          text primary key,          -- 'aemet', 'open-meteo:ecmwf_ifs025', 'saih'
  name        text not null,
  kind        text not null,             -- 'official' | 'model' | 'amateur'
  url         text
);

stations (
  id          text primary key,          -- '<source>:<id_fuente>' p.ej. 'aemet:8414A', 'virtual:albal'
  source      text references sources(id),
  name        text not null,
  kind        text not null,             -- 'station' | 'municipality' | 'gauge' | 'reservoir' | 'rain_gauge'
  geom        geometry(Point, 4326),
  elevation_m real,
  meta        jsonb
);

source_status (
  source          text primary key references sources(id),
  last_run_at     timestamptz,
  last_success_at timestamptz,
  last_error      text,
  records_written int,
  next_run_at     timestamptz
);
```

### Series temporales (hypertables)

```sql
observations (
  source     text not null,
  station_id text not null,
  variable   text not null,     -- 'precip_mm', 'river_level_m', …
  ts         timestamptz not null,
  value      double precision,
  unit       text not null,
  quality    smallint,          -- opcional: flag de calidad de la fuente
  primary key (source, station_id, variable, ts)
);
select create_hypertable('observations', 'ts', chunk_time_interval => interval '7 days');

forecasts (
  source      text not null,     -- incluye el modelo: 'open-meteo:ecmwf_ifs025'
  station_id  text not null,
  variable    text not null,
  forecast_ts timestamptz not null,   -- cuándo se emitió
  ts          timestamptz not null,   -- para cuándo vale
  value       double precision,
  unit        text not null,
  primary key (source, station_id, variable, forecast_ts, ts)
);
select create_hypertable('forecasts', 'ts', chunk_time_interval => interval '7 days');
create index on forecasts (source, station_id, variable, forecast_ts desc, ts);
```

`geom` no se repite en cada fila: se obtiene por *join* con `stations`. (El prompt de arranque lo lista en el esquema común; se materializa en la vista, no en la hypertable, para no multiplicar el almacenamiento.)

### Alertas

```sql
alerts (
  id           text primary key,     -- identificador CAP
  source       text not null,
  area_code    text,                  -- zona AEMET p.ej. '771302'
  area_name    text,
  event        text,                  -- 'Lluvias', 'Tormentas'…
  severity     text,                  -- 'Minor'|'Moderate'|'Severe'|'Extreme' (CAP)
  level        text,                  -- 'amarillo'|'naranja'|'rojo'
  onset        timestamptz,
  expires      timestamptz,
  sent         timestamptz,
  headline     text,
  description  text,
  geom         geometry(MultiPolygon, 4326),
  raw          jsonb
);
```

### Agregados continuos y retención

- `precip_daily_by_station`: suma diaria de `precip_mm` observado (para verificar predicciones).
- `forecast_latest`: vista (no materializada) con la última `forecast_ts` por `(source, station_id, variable)`.
- Retención: crudos 7 días; `forecasts` 1 año (para estudiar error de modelos); `observations` indefinida (volumen pequeño).
- Compresión TimescaleDB en chunks > 30 días.

### Variables canónicas

| variable | unidad | descripción |
|---|---|---|
| `precip_mm` | mm | precipitación acumulada en el intervalo (1 h salvo indicación) |
| `precip_prob_pct` | % | probabilidad de precipitación |
| `temp_c` | °C | temperatura a 2 m |
| `rh_pct` | % | humedad relativa |
| `wind_ms` | m/s | viento medio a 10 m |
| `gust_ms` | m/s | racha máxima |
| `wind_dir_deg` | ° | dirección del viento |
| `pressure_hpa` | hPa | presión a nivel del mar |
| `river_level_m` | m | nivel en aforo |
| `river_flow_m3s` | m³/s | caudal en aforo |
| `reservoir_hm3` | hm³ | volumen embalsado |
| `reservoir_pct` | % | porcentaje de llenado |

## 4. API

- REST (JSON). Rutas previstas:
  - `GET /api/v1/status` — frescura por fuente (`source_status`).
  - `GET /api/v1/compare?variable=precip_mm&station=virtual:albal&from=&to=` — una serie por fuente (última emisión de cada una). **Es el endpoint del MVP.**
  - `GET /api/v1/observations?station=&variable=&from=&to=`
  - `GET /api/v1/forecasts?station=&variable=&source=&forecast_ts=` — permite pedir una emisión concreta (verificación a posteriori).
  - `GET /api/v1/alerts?active=true`
  - `GET /api/v1/risk` — semáforo por localización (§7). **Implementado.**
- `GET /api/v1/risk/history` — transiciones de nivel registradas. **Implementado.**
- WebSocket `/ws` para empujar nuevos datos y cambios de semáforo (pendiente; hoy la vía de aviso es ntfy).
- Umbrales de lluvia configurables en la tabla `thresholds`, evaluados en servidor. Los de caudal vienen de la CHJ en `sensors`.

## 5. Frontend (fases posteriores)

- **Mapa** (MapLibre): radar AEMET (tiles o imagen georreferenciada), sensores SAIH, polígonos Meteoalarm.
- **Comparativa**: gráfico de líneas (una serie por fuente) + tabla "quién dice qué para las próximas 24 h".
- **Alertas**: semáforo (lluvia prevista × nivel de barranco × aviso vigente) + notificaciones push (Web Push / ntfy).

## 6. Despliegue

Producción en **Dokploy** (homelab): servicio *Compose* en modo Docker Compose que construye las imágenes desde el repo y redespliega en cada push a `main`. Variables de entorno y dominio (Traefik) por la UI de Dokploy; DB con volumen persistente. Detalles en `openspec/changes/archive/2026-08-25-mvp-comparativa-precipitacion/design.md` → "Despliegue en Dokploy".

Desarrollo local con el mismo compose más `docker-compose.override.yml`. Servicios:

- `db`: `timescale/timescaledb:latest-pg16` (incluye PostGIS en la variante `-ha`; alternativa: instalar `postgis` en la imagen). Volumen persistente.
- `collectors`: imagen Node alpine con scheduler interno.
- `api`: imagen Node alpine.
- `web` (futuro): Next.js standalone o estático servido por Caddy.

Configuración por variables de entorno (`.env` en desarrollo; UI de Dokploy en producción).

## 7. Semáforo de riesgo (implementado el 25‑08‑2026, fase 3)

`GET /api/v1/risk` devuelve un nivel por localización y el desglose que lo justifica. Cuatro señales independientes; el nivel es el **máximo**, nunca una media: un caudal en rojo no se compensa con un cielo despejado.

| Señal | Qué mira | Umbrales |
|---|---|---|
| Caudal / embalses | último valor de los `watch_points` de rol `flow_*` y `reservoir` | Oficiales de la CHJ, en `sensors` |
| Lluvia observada | `precip_mm` de cada pluviómetro vigilado, **por separado** (el peor manda): hora más lluviosa de las últimas 6 h, y suma de 12 h | AEMET: 20/40/90 (1 h), 60/100/180 (12 h) |
| Lluvia prevista | acumulado 12 h y 24 h por fuente, última emisión de cada una; nivel por **mediana** entre fuentes, máximo como contexto | 60/100/180 (12 h); 20 mm (24 h, regla propia) |
| Aviso oficial | `alerts` vigentes de la zona AEMET, solo `PR`/`TO`/`IN` | El nivel del propio aviso |

Umbrales de lluvia: Plan Meteoalerta de AEMET, Anexo 1 (v1, 31‑05‑2022), idénticos en las once zonas de la Comunitat Valenciana. Se siembran en la tabla `thresholds`, con su procedencia en `meta.source`, y una localización puede sobrescribirlos sin desplegar.

Reglas que evitan falsos verdes y falsas alarmas:

- Un dato más viejo que `RISK_STALE_MINUTES` (30; 90 en estaciones de embalse, que publican cada media hora) **no cuenta** y genera advertencia. El silencio no es verde.
- La lluvia observada no se promedia ni se suma entre estaciones: en la DANA, Turís marcó 771 mm mientras a 20 km apenas llovía.
- La lluvia prevista la marca la mediana entre fuentes: un modelo desatado no enciende el semáforo, pero su máximo se muestra.
- Un sensor sin umbrales (volumen de embalse) es contexto: ni eleva el nivel ni avisa de frescura.
- AEMET pondera además la probabilidad al emitir sus avisos: **el semáforo no reproduce los avisos oficiales**, los complementa. Por eso el aviso vigente entra como señal propia.

Los sensores vigilados por localización están en `watch_points` (semilla en `db/migrations/0007_watch_points.sql`, inventario razonado en `docs/cuencas.md`). Calibrar los umbrales con episodios reales queda pendiente: el portal del SAIH no publica la DANA del 29‑10‑2024.

### Notificaciones (fase 4)

El scheduler evalúa el semáforo cada `RISK_INTERVAL_MIN` (5 min) con **la misma función** que la API (`evaluateRisk`, en `packages/shared`), de modo que el aviso que llega al móvil y lo que enseña `/api/v1/risk` no pueden divergir. Lo que se notifica es un **cambio** de nivel, no un nivel: `risk_state` guarda el actual y `risk_events` el histórico, con el desglose del momento de la transición.

- **Histéresis asimétrica**: las subidas se aplican y notifican en el acto (en una crecida del Poyo, cinco minutos son la mitad del margen de aviso); las bajadas exigen `RISK_FALL_CONFIRMATIONS` evaluaciones seguidas (3 ≈ 15 min). Un semáforo que parpadea deja de leerse.
- **El silencio no baja el nivel**: si una evaluación se queda sin componentes (sensores mudos u obsoletos), se conserva el nivel anterior y se anota la advertencia.
- **Canal**: ntfy por HTTP (`NTFY_URL`, `NTFY_TOKEN`), con prioridad según el nivel. Sin configurar, la transición se registra y no se envía nada: el sistema nunca falla por no tener canal. Si el envío falla, el evento queda con `notified=false` y el error en `notify_error`.
- `GET /api/v1/risk/history` devuelve las transiciones; `pnpm --filter @talaia/scheduler risk-once` fuerza una evaluación.
