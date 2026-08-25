insert into sources (id, name, kind, url) values
  ('virtual', 'Puntos virtuales (localizaciones objetivo)', 'official', null),
  ('aemet', 'AEMET OpenData', 'official', 'https://opendata.aemet.es'),
  ('open-meteo:meteofrance_arome_france_hd', 'Météo-France AROME HD 1,5 km (Open-Meteo)', 'model', 'https://open-meteo.com'),
  ('open-meteo:icon_eu', 'DWD ICON EU 7 km (Open-Meteo)', 'model', 'https://open-meteo.com'),
  ('open-meteo:ecmwf_ifs', 'ECMWF IFS 9 km (Open-Meteo)', 'model', 'https://open-meteo.com'),
  ('open-meteo:gfs_seamless', 'NCEP GFS 13 km (Open-Meteo)', 'model', 'https://open-meteo.com'),
  ('open-meteo:arpege_europe', 'Météo-France ARPEGE Europe 11 km (Open-Meteo)', 'model', 'https://open-meteo.com'),
  ('open-meteo:ukmo_global_deterministic_10km', 'UKMO Global 10 km (Open-Meteo)', 'model', 'https://open-meteo.com');

insert into stations (id, source, name, kind, geom, elevation_m, meta) values
  ('virtual:albal', 'virtual', 'Albal', 'municipality',
    ST_SetSRID(ST_Point(-0.415, 39.397), 4326), 14,
    '{"ine":"46007","aemet_zone":"774602","primary":true}'),
  ('virtual:benetusser', 'virtual', 'Benetússer', 'municipality',
    ST_SetSRID(ST_Point(-0.3969, 39.4227), 4326), 15,
    '{"ine":"46054","aemet_zone":"774602"}'),
  ('virtual:mareny-barraquetes', 'virtual', 'Mareny de Barraquetes (Sueca)', 'locality',
    ST_SetSRID(ST_Point(-0.2646, 39.2458), 4326), 2,
    '{"ine":"46235","aemet_zone":"774604","aemet_note":"predicción municipal de Sueca"}'),
  ('virtual:benaguasil', 'virtual', 'Benaguasil', 'municipality',
    ST_SetSRID(ST_Point(-0.583, 39.6), 4326), 103,
    '{"ine":"46051","aemet_zone":"774602"}');
