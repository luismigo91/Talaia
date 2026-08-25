-- Fase 4: estado del semáforo e histórico de transiciones.
--
-- Lo que se notifica no es un nivel, es un CAMBIO de nivel: hace falta recordar el anterior.
-- `risk_events` guarda además el desglose del momento, porque dentro de seis meses querremos
-- saber por qué saltó y los datos de origen ya habrán rotado.

create table risk_state (
  station_id    text primary key references stations(id),
  level         text not null check (level in ('verde','amarillo','naranja','rojo')),
  since         timestamptz not null,
  evaluated_at  timestamptz not null,
  -- Bajada a medio confirmar (histéresis): nivel candidato y cuántas veces se ha repetido.
  pending_level text check (pending_level in ('verde','amarillo','naranja','rojo')),
  pending_since timestamptz,
  pending_count integer not null default 0,
  warnings      jsonb not null default '[]'::jsonb,
  components    jsonb not null default '[]'::jsonb
);

create table risk_events (
  id             bigserial primary key,
  station_id     text not null references stations(id),
  ts             timestamptz not null default now(),
  level          text not null check (level in ('verde','amarillo','naranja','rojo')),
  previous_level text,
  direction      text not null check (direction in ('subida','bajada')),
  components     jsonb not null default '[]'::jsonb,
  notified       boolean not null default false,
  notify_error   text
);
create index risk_events_station_ts_idx on risk_events (station_id, ts desc);
