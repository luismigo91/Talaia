# Diseño: histórico de riesgo y notificaciones

## 1. Un solo sitio donde se calcula el riesgo

Hoy la lógica vive en `api/src/risk/risk.service.ts`, un servicio de NestJS. El scheduler no puede importarlo sin arrastrar Nest, así que el cálculo se muda a `packages/shared/src/risk-eval.ts` como una función:

```ts
evaluateRisk(db, { station?, now? }): Promise<StationRisk[]>
```

El `RiskService` queda como envoltorio delgado que traduce la ausencia de estación a un `NotFoundException`. Así el aviso que llega al móvil y lo que enseña `/api/v1/risk` no pueden divergir nunca — que es justo lo que promete `docs/arquitectura.md`.

## 2. Estado e histórico

```sql
create table risk_state (
  station_id     text primary key references stations(id),
  level          text not null,
  since          timestamptz not null,   -- desde cuándo está en este nivel
  evaluated_at   timestamptz not null,
  pending_level  text,                   -- nivel inferior candidato...
  pending_since  timestamptz,            -- ...y desde cuándo se propone
  pending_count  integer not null default 0,
  components     jsonb not null default '[]'::jsonb
);

create table risk_events (
  id             bigserial primary key,
  station_id     text not null references stations(id),
  ts             timestamptz not null default now(),
  level          text not null,
  previous_level text,
  direction      text not null check (direction in ('subida','bajada')),
  components     jsonb not null default '[]'::jsonb,
  notified       boolean not null default false,
  notify_error   text
);
```

`risk_events` es de volumen bajísimo (una fila por cambio real de color, quizá decenas al año): tabla normal con índice por `(station_id, ts desc)`, sin hypertable. `components` guarda el desglose **en el momento de la transición**: dentro de seis meses querremos saber por qué saltó, y los datos de origen pueden haber rotado.

## 3. Histéresis asimétrica

El riesgo sube rápido y baja despacio, y la notificación debe comportarse igual:

- **Subida** (`nuevo > actual`): se aplica y se notifica **en el mismo ciclo**. En una crecida del Poyo, cinco minutos son la mitad del margen de aviso.
- **Bajada** (`nuevo < actual`): el nivel candidato se guarda en `pending_level` y hay que confirmarlo `RISK_FALL_CONFIRMATIONS` veces seguidas (3 por defecto ≈ 15 min con el job cada 5). Cualquier evaluación que no confirme la bajada resetea el contador.

Sin esto, un caudal oscilando alrededor de 30 m³/s generaría una notificación cada cinco minutos y el sistema se volvería ruido — el modo más rápido de que alguien silencie el canal justo antes del episodio que importa.

## 4. Los datos obsoletos no bajan el semáforo

Si una localización no tiene ningún componente evaluable (todos sus sensores obsoletos o mudos), `evaluateRisk` devuelve verde con advertencias. Bajar el nivel por eso sería exactamente el fallo que se quiso evitar en la fase 3: **silencio no es calma**. Cuando la evaluación llega sin componentes, se conserva el nivel anterior, se anota la advertencia en `risk_state` y no se emite transición.

## 5. Notificación que no puede tumbar nada

```ts
interface Notifier { send(event: RiskEvent): Promise<void> }
```

Implementación por defecto: **ntfy** (`POST ${NTFY_URL}`, cabeceras `Title`, `Priority`, `Tags`; `NTFY_TOKEN` opcional). Sin `NTFY_URL` configurada se usa un notificador nulo que solo registra en el log: un homelab sin canal configurado debe seguir funcionando.

El envío ocurre **después** de escribir el evento y en su propio `try/catch`: si ntfy está caído, la transición ya está registrada y el evento queda con `notified=false` y el error en `notify_error`. Nunca se pierde el hecho de que el nivel cambió por un fallo de mensajería.

Prioridad del mensaje según el nivel: `rojo` → `urgent`, `naranja` → `high`, `amarillo` → `default`, vuelta a `verde` → `low`. El cuerpo lleva el `detail` del componente que manda: *"Albal: NARANJA (antes verde) — 80 m³/s ≥ 70 m³/s (naranja) en MC RAMBLA POYO N-III"*. Un aviso que no dice por qué obliga a sacar el móvil del bolsillo para nada.

## 6. Job en el scheduler

`risk` cada `RISK_INTERVAL_MIN` (5 por defecto), con el mismo aislamiento que los collectors: registra en `source_status` bajo la fuente lógica `risk`, y un fallo de una localización no impide evaluar las demás. Se ejecuta después de los collectors en el arranque, para no evaluar sobre una base vacía.
