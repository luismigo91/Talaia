-- Fase 3: qué vigila cada localización objetivo y con qué umbrales.
--
-- `watch_points` conecta cada localización (estación virtual) con los sensores que la amenazan,
-- según el inventario por cuenca de docs/cuencas.md. `thresholds` guarda los umbrales que NO
-- publica ninguna fuente oficial por sensor (lluvia prevista y observada); los de caudal y nivel
-- ya vienen en `sensors` desde la CHJ.

-- 1. La precipitación horaria que deriva el collector también es catálogo: así aparece en
--    /api/v1/sensors y puede vigilarse. `derived_from` evita que el collector intente descargarla.
insert into sensors (id, source, station_id, external_id, variable, unit, meta) values
  ('saih:225:precip_mm', 'saih', 'saih:225', '13891', 'precip_mm', 'mm', '{"saih_station": "225", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "13891", "note": "Rambla Castellana (Pedralba), no regulada"}'::jsonb),
  ('saih:226:precip_mm', 'saih', 'saih:226', '1774', 'precip_mm', 'mm', '{"saih_station": "226", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "1774", "note": "Túria en Vilamarxant, aguas arriba inmediato de Benaguasil"}'::jsonb),
  ('saih:227:precip_mm', 'saih', 'saih:227', '13871', 'precip_mm', 'mm', '{"saih_station": "227", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "13871", "note": "Poyo en Riba-roja (N-III): único aforo de la cuenca del Poyo"}'::jsonb),
  ('saih:232:precip_mm', 'saih', 'saih:232', '13693', 'precip_mm', 'mm', '{"saih_station": "232", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "13693", "note": "Siete Aguas: cabecera del Poyo"}'::jsonb),
  ('saih:233:precip_mm', 'saih', 'saih:233', '14174', 'precip_mm', 'mm', '{"saih_station": "233", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "14174", "note": "Casinos: cabecera de la rambla Primera"}'::jsonb),
  ('saih:238:precip_mm', 'saih', 'saih:238', '14965', 'precip_mm', 'mm', '{"saih_station": "238", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "14965", "note": "Picassent (Parada 14): tramo bajo del Poyo"}'::jsonb),
  ('saih:306:precip_mm', 'saih', 'saih:306', '2710', 'precip_mm', 'mm', '{"saih_station": "306", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "2710", "note": "Azud de Sueca (Riola): lluvia local del Mareny, la señal más importante"}'::jsonb),
  ('saih:371:precip_mm', 'saih', 'saih:371', '14079', 'precip_mm', 'mm', '{"saih_station": "371", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "14079", "note": "Chiva: cabecera del Poyo"}'::jsonb),
  ('saih:387:precip_mm', 'saih', 'saih:387', '13805', 'precip_mm', 'mm', '{"saih_station": "387", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "13805", "note": "Barranc de la Casella (Alzira)"}'::jsonb),
  ('saih:408:precip_mm', 'saih', 'saih:408', '13335', 'precip_mm', 'mm', '{"saih_station": "408", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "13335", "note": "Bugarra (EA 22)"}'::jsonb),
  ('saih:409:precip_mm', 'saih', 'saih:409', '15317', 'precip_mm', 'mm', '{"saih_station": "409", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "15317", "note": "Marines (EA 221)"}'::jsonb),
  ('saih:789:precip_mm', 'saih', 'saih:789', '16922', 'precip_mm', 'mm', '{"saih_station": "789", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "16922", "note": "Turís: 771 mm el 29-10-2024"}'::jsonb),
  ('saih:802:precip_mm', 'saih', 'saih:802', '16906', 'precip_mm', 'mm', '{"saih_station": "802", "saih_name": "precipitación horaria derivada de la intensidad", "derived_from": "16906", "note": "Tancat de la Pipa: Albufera, lluvia local"}'::jsonb);
-- 2. Localización → sensores a vigilar.
create table watch_points (
  station_id  text not null references stations(id),
  sensor_id   text not null references sensors(id),
  role        text not null check (role in
                ('flow_primary','flow_secondary','reservoir','rain_upstream','rain_local')),
  lag_minutes integer,
  note        text,
  primary key (station_id, sensor_id)
);
create index watch_points_sensor_idx on watch_points (sensor_id);

insert into watch_points (station_id, sensor_id, role, lag_minutes, note) values
  -- Albal: barranc del Poyo. El único aforo de la cuenca está en Riba-roja; la cabecera
  -- (Chiva, Siete Aguas, Turís) avisa unas 2 h antes de la crecida.
  ('virtual:albal', 'saih:13873', 'flow_primary', null, 'único aforo de la cuenca del Poyo'),
  ('virtual:albal', 'saih:371:precip_mm', 'rain_upstream', 120, 'Chiva, cabecera del Poyo'),
  ('virtual:albal', 'saih:232:precip_mm', 'rain_upstream', 150, 'Siete Aguas, cabecera'),
  ('virtual:albal', 'saih:789:precip_mm', 'rain_upstream', 120, 'Turís, divisoria Poyo/Magro'),
  ('virtual:albal', 'saih:238:precip_mm', 'rain_local', null, 'Picassent, tramo bajo'),
  ('virtual:albal', 'saih:227:precip_mm', 'rain_local', null, 'pluviómetro del propio aforo'),
  -- Benetússer: misma cuenca, aguas arriba de Albal. La señal de Riba-roja llega con menos
  -- margen y no captura lo que aporta l'Horteta, que está fuera del SAIH.
  ('virtual:benetusser', 'saih:13873', 'flow_primary', null, 'no captura el aporte de l''Horteta'),
  ('virtual:benetusser', 'saih:371:precip_mm', 'rain_upstream', 120, 'Chiva, cabecera del Poyo'),
  ('virtual:benetusser', 'saih:232:precip_mm', 'rain_upstream', 150, 'Siete Aguas, cabecera'),
  ('virtual:benetusser', 'saih:227:precip_mm', 'rain_local', null, 'pluviómetro del propio aforo'),
  -- Mareny de Barraquetes: Xúquer bajo, Albufera y marjal. Sin aforo en Sueca ni Cullera:
  -- el último del Xúquer es Huerto Mulet. La lluvia local ha inundado el Mareny por sí sola.
  ('virtual:mareny-barraquetes', 'saih:13070', 'flow_primary', null, 'Huerto Mulet, último aforo del Xúquer'),
  ('virtual:mareny-barraquetes', 'saih:13080', 'flow_secondary', null, 'salida de Tous'),
  ('virtual:mareny-barraquetes', 'saih:14551', 'flow_secondary', null, 'Magro en Guadassuar'),
  ('virtual:mareny-barraquetes', 'saih:2443', 'flow_secondary', null, 'Albaida en Manuel'),
  ('virtual:mareny-barraquetes', 'saih:2701', 'flow_secondary', null, 'Sellent en Estubeny'),
  ('virtual:mareny-barraquetes', 'saih:2470', 'reservoir', null, 'volumen de Tous (NMN 378,6 hm³)'),
  ('virtual:mareny-barraquetes', 'saih:306:precip_mm', 'rain_local', null, 'Azud de Sueca: la señal más importante'),
  ('virtual:mareny-barraquetes', 'saih:802:precip_mm', 'rain_local', null, 'Tancat de la Pipa, Albufera'),
  ('virtual:mareny-barraquetes', 'saih:387:precip_mm', 'rain_upstream', null, 'Barranc de la Casella (Alzira)'),
  -- Benaguasil: el Túria va regulado por Benagéber y Loriguilla; el riesgo real son las
  -- ramblas no reguladas (Primera y Castellana) y la lluvia local.
  ('virtual:benaguasil', 'saih:12808', 'flow_primary', null, 'Túria en Vilamarxant, aguas arriba inmediato'),
  ('virtual:benaguasil', 'saih:13897', 'flow_secondary', null, 'rambla Primera, no regulada'),
  ('virtual:benaguasil', 'saih:13896', 'flow_secondary', null, 'rambla Castellana, no regulada'),
  ('virtual:benaguasil', 'saih:12905', 'flow_secondary', null, 'Túria bajo la salida de Loriguilla'),
  ('virtual:benaguasil', 'saih:16693', 'flow_secondary', null, 'salida de Benagéber'),
  ('virtual:benaguasil', 'saih:2462', 'reservoir', null, 'volumen de Loriguilla (NMN 73,2 hm³)'),
  ('virtual:benaguasil', 'saih:233:precip_mm', 'rain_upstream', null, 'Casinos, cabecera de la rambla Primera'),
  ('virtual:benaguasil', 'saih:408:precip_mm', 'rain_upstream', null, 'Bugarra'),
  ('virtual:benaguasil', 'saih:409:precip_mm', 'rain_upstream', null, 'Marines'),
  ('virtual:benaguasil', 'saih:225:precip_mm', 'rain_local', null, 'Pedralba'),
  ('virtual:benaguasil', 'saih:226:precip_mm', 'rain_local', null, 'Vilamarxant');

-- 3. Umbrales que ninguna fuente publica por sensor (lluvia). Los de caudal, nivel y embalse
--    ya vienen de la CHJ en `sensors` y no se duplican aquí.
create table thresholds (
  id           text primary key,
  station_id   text references stations(id),   -- NULL = regla global
  signal       text not null,
  level_yellow double precision,
  level_orange double precision,
  level_red    double precision,
  enabled      boolean not null default true,
  meta         jsonb not null default '{}'::jsonb,
  unique (station_id, signal)
);

-- Umbrales oficiales de AEMET (Plan Meteoalerta, Anexo 1 v1 de 31-05-2022). Son idénticos en
-- las once zonas de la Comunitat Valenciana, así que se siembran como reglas globales.
insert into thresholds (id, station_id, signal, level_yellow, level_orange, level_red, meta) values
  ('default:observed_precip_1h', null, 'observed_precip_1h', 20, 40, 90,
   '{"source":"AEMET Plan Meteoalerta Anexo 1 (v1, 31-05-2022), zonas 774602/774604",
     "url":"https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/METEOALERTA_ANX1_Umbrales_y_niveles_de_aviso.pdf",
     "official":true}'::jsonb),
  ('default:observed_precip_12h', null, 'observed_precip_12h', 60, 100, 180,
   '{"source":"AEMET Plan Meteoalerta Anexo 1 (v1, 31-05-2022), zonas 774602/774604",
     "url":"https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/METEOALERTA_ANX1_Umbrales_y_niveles_de_aviso.pdf",
     "official":true,
     "note":"tras la DANA del 29-10-2024 se discutió públicamente el umbral rojo de 180 mm/12 h; no hay revisión oficial publicada"}'::jsonb),
  ('default:forecast_precip_12h', null, 'forecast_precip_12h', 60, 100, 180,
   '{"source":"mismos umbrales de AEMET aplicados a la predicción",
     "official":false,
     "note":"AEMET pondera además la probabilidad: el semáforo no reproduce sus avisos, los complementa"}'::jsonb),
  ('default:forecast_precip_24h', null, 'forecast_precip_24h', 20, null, null,
   '{"source":"diseño preliminar de Talaia (docs/arquitectura.md §7)",
     "official":false,
     "note":"aviso temprano; naranja y rojo los cubre la regla de 12 h"}'::jsonb);
