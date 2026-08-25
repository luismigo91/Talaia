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
  meta        jsonb not null default '{}'::jsonb
);
create index stations_geom_idx on stations using gist (geom);

-- Una fila por fuente lógica de collector (aemet:forecast:46007, aemet:alerts, open-meteo). Sin FK.
create table source_status (
  source          text primary key,
  last_run_at     timestamptz,
  last_success_at timestamptz,
  last_error      text,
  records_written integer,
  payload_hash    text
);
