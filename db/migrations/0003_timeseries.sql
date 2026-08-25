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
select create_hypertable('forecasts', 'ts', chunk_time_interval => interval '7 days');
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
select create_hypertable('observations', 'ts', chunk_time_interval => interval '7 days');

create table raw_payloads (
  id         bigserial,
  source     text not null,
  fetched_at timestamptz not null default now(),
  url        text not null,
  hash       text not null,
  body       bytea not null,
  primary key (id, fetched_at)
);
select create_hypertable('raw_payloads', 'fetched_at', chunk_time_interval => interval '1 day');

select add_retention_policy('raw_payloads', interval '7 days');
select add_retention_policy('forecasts', interval '365 days');
