-- Fase 13: modelos lluvia-caudal para anticipar el caudal desde la lluvia de cabecera.
--
-- Cada fila relaciona un aforo con los pluviómetros de su cabecera y guarda la relación
-- empírica Q = coef_a · P^coef_b (P = lluvia media de cabecera acumulada en window_hours) y el
-- retardo con que el agua llega al aforo. La procedencia del ajuste (periodo, episodios, r²)
-- va en `meta`, como en `thresholds`.
--
-- Sin semilla a propósito: el histórico que publica el SAIH (2025-01 → 2026-09) no contiene
-- ninguna crecida del Poyo —el aforo de Riba-roja marcó 0,0–0,3 m³/s en el episodio más
-- lluvioso del periodo (97 mm en Siete Aguas el 05-03-2025)— y sin respuesta medida no hay
-- relación que ajustar. Inventar coeficientes sería peor que no tener la señal. Cuando haya un
-- episodio real: `pnpm --filter @talaia/collector-saih backfill` y
-- `pnpm --filter @talaia/scheduler calibrate-runoff --apply`.
create table runoff_models (
  id              text primary key,
  station_id      text not null references stations(id),
  flow_sensor_id  text not null references sensors(id),
  rain_sensor_ids text[] not null,
  window_hours    integer not null check (window_hours between 1 and 24),
  lag_minutes     integer not null check (lag_minutes between 0 and 720),
  coef_a          double precision not null,
  coef_b          double precision not null,
  min_rain_mm     double precision not null default 1,
  enabled         boolean not null default true,
  meta            jsonb not null default '{}'::jsonb
);
create index runoff_models_station_idx on runoff_models (station_id) where enabled;
