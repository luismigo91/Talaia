create table alerts (
  id          text primary key,
  source      text not null,
  area_code   text not null,
  area_name   text,
  event_code  text,
  event       text,
  level       text not null check (level in ('verde','amarillo','naranja','rojo')),
  severity    text,
  parameter   text,
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
