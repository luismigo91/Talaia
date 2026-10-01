-- Fase 16: catálogo SAIH Hidrosur (Junta de Andalucía) para Málaga y Rincón.
--
-- Sin clave: tablas de última hora + gráficas horarias de 48 h por estación
-- (redhidrosurmedioambiente.es/saih). Estaciones verificadas en el visor el
-- 01-10-2026; coordenadas en lat/lon reales (el visor las publica así).
-- IDs espejo del Júcar: hidrosur:{numero}:{variable} como saih:{n}:{variable}.
-- Sin umbrales de caudal a propósito: Hidrosur no los publica en sus tablas;
-- la lluvia usa los globales de AEMET y el caudal entra como contexto hasta
-- calibrar con episodios reales (misma doctrina que el Poyo en la fase 13).

insert into sources (id, name, kind, url) values
  ('hidrosur', 'SAIH Hidrosur (Junta de Andalucía)', 'official', 'https://www.redhidrosurmedioambiente.es/saih');

insert into stations (id, source, name, kind, geom, meta) values
  ('hidrosur:22', 'hidrosur', 'MÁLAGA - PASEO DE LA FAROLA', 'rain_gauge',
    ST_SetSRID(ST_Point(-4.4128, 36.7164), 4326), '{"number": "22", "town": "Málaga"}'),
  ('hidrosur:120', 'hidrosur', 'CENTRO CONTROL LIMONERO', 'rain_gauge',
    ST_SetSRID(ST_Point(-4.4292, 36.7606), 4326), '{"number": "120", "town": "Málaga"}'),
  ('hidrosur:35', 'hidrosur', 'COÍN', 'rain_gauge',
    ST_SetSRID(ST_Point(-4.7542, 36.6562), 4326), '{"number": "35", "town": "Coín"}'),
  ('hidrosur:101', 'hidrosur', 'LA ARAÑA', 'rain_gauge',
    ST_SetSRID(ST_Point(-4.3225, 36.713), 4326), '{"number": "101", "town": "Rincón de la Victoria"}'),
  ('hidrosur:44', 'hidrosur', 'TORROX', 'rain_gauge',
    ST_SetSRID(ST_Point(-3.9311, 36.7522), 4326), '{"number": "44", "town": "Torrox"}'),
  ('hidrosur:37', 'hidrosur', 'EMBALSE DE LA VIÑUELA', 'reservoir',
    ST_SetSRID(ST_Point(-4.16, 36.86), 4326), '{"number": "37", "town": "Viñuela"}'),
  ('hidrosur:38', 'hidrosur', 'RÍO GUADALHORCE (CÁRTAMA)', 'gauge',
    ST_SetSRID(ST_Point(-4.6136, 36.7293), 4326), '{"number": "38", "town": "Cártama"}'),
  ('hidrosur:46', 'hidrosur', 'RÍO GUADALHORCE (ALJAIMA)', 'gauge',
    ST_SetSRID(ST_Point(-4.6654, 36.7279), 4326), '{"number": "46", "town": "Cártama"}'),
  ('hidrosur:127', 'hidrosur', 'RÍO GUADALHORCE (BOBADILLA)', 'gauge',
    ST_SetSRID(ST_Point(-4.6958, 37.0401), 4326), '{"number": "127", "town": "Antequera"}'),
  ('hidrosur:106', 'hidrosur', 'RÍO CAMPANILLAS (LOS LLANES)', 'gauge',
    ST_SetSRID(ST_Point(-4.5105, 36.8278), 4326), '{"number": "106", "town": "Málaga"}'),
  ('hidrosur:43', 'hidrosur', 'RÍO BENAMARGOSA (S. NEGRO)', 'gauge',
    ST_SetSRID(ST_Point(-4.2047, 36.8471), 4326), '{"number": "43", "town": "Benamargosa"}'),
  ('hidrosur:104', 'hidrosur', 'RÍO GRANDE (LAS MILLANAS)', 'gauge',
    ST_SetSRID(ST_Point(-4.8813, 36.7014), 4326), '{"number": "104", "town": "Tolox"}'),
  ('hidrosur:20', 'hidrosur', 'EMBALSE DEL LIMONERO', 'reservoir',
    ST_SetSRID(ST_Point(-4.434, 36.7589), 4326), '{"number": "20", "town": "Málaga"}'),
  ('hidrosur:30', 'hidrosur', 'EMBALSE DEL GUADALHORCE', 'reservoir',
    ST_SetSRID(ST_Point(-4.782, 36.96), 4326), '{"number": "30", "town": "Ardales"}');

insert into sensors (id, source, station_id, external_id, variable, unit, meta) values
  ('hidrosur:22:precip_mm', 'hidrosur', 'hidrosur:22', '22', 'precip_mm', 'mm', '{}'),
  ('hidrosur:120:precip_mm', 'hidrosur', 'hidrosur:120', '120', 'precip_mm', 'mm', '{}'),
  ('hidrosur:35:precip_mm', 'hidrosur', 'hidrosur:35', '35', 'precip_mm', 'mm', '{}'),
  ('hidrosur:101:precip_mm', 'hidrosur', 'hidrosur:101', '101', 'precip_mm', 'mm', '{}'),
  ('hidrosur:44:precip_mm', 'hidrosur', 'hidrosur:44', '44', 'precip_mm', 'mm', '{}'),
  ('hidrosur:37:precip_mm', 'hidrosur', 'hidrosur:37', '37', 'precip_mm', 'mm', '{}'),
  ('hidrosur:37:reservoir_pct', 'hidrosur', 'hidrosur:37', '37', 'reservoir_pct', '%', '{}'),
  ('hidrosur:37:reservoir_hm3', 'hidrosur', 'hidrosur:37', '37', 'reservoir_hm3', 'hm³', '{}'),
  ('hidrosur:38:river_level_m', 'hidrosur', 'hidrosur:38', '38', 'river_level_m', 'm', '{}'),
  ('hidrosur:38:river_flow_m3s', 'hidrosur', 'hidrosur:38', '38', 'river_flow_m3s', 'm³/s', '{}'),
  ('hidrosur:46:river_level_m', 'hidrosur', 'hidrosur:46', '46', 'river_level_m', 'm', '{}'),
  ('hidrosur:46:river_flow_m3s', 'hidrosur', 'hidrosur:46', '46', 'river_flow_m3s', 'm³/s', '{}'),
  ('hidrosur:127:river_level_m', 'hidrosur', 'hidrosur:127', '127', 'river_level_m', 'm', '{}'),
  ('hidrosur:127:river_flow_m3s', 'hidrosur', 'hidrosur:127', '127', 'river_flow_m3s', 'm³/s', '{}'),
  ('hidrosur:106:river_level_m', 'hidrosur', 'hidrosur:106', '106', 'river_level_m', 'm', '{}'),
  ('hidrosur:106:river_flow_m3s', 'hidrosur', 'hidrosur:106', '106', 'river_flow_m3s', 'm³/s', '{}'),
  ('hidrosur:43:river_level_m', 'hidrosur', 'hidrosur:43', '43', 'river_level_m', 'm', '{}'),
  ('hidrosur:43:river_flow_m3s', 'hidrosur', 'hidrosur:43', '43', 'river_flow_m3s', 'm³/s', '{}'),
  ('hidrosur:104:river_level_m', 'hidrosur', 'hidrosur:104', '104', 'river_level_m', 'm', '{}'),
  ('hidrosur:104:river_flow_m3s', 'hidrosur', 'hidrosur:104', '104', 'river_flow_m3s', 'm³/s', '{}'),
  ('hidrosur:20:reservoir_pct', 'hidrosur', 'hidrosur:20', '20', 'reservoir_pct', '%', '{}'),
  ('hidrosur:20:reservoir_hm3', 'hidrosur', 'hidrosur:20', '20', 'reservoir_hm3', 'hm³', '{}'),
  ('hidrosur:30:reservoir_pct', 'hidrosur', 'hidrosur:30', '30', 'reservoir_pct', '%', '{}'),
  ('hidrosur:30:reservoir_hm3', 'hidrosur', 'hidrosur:30', '30', 'reservoir_hm3', 'hm³', '{}');

insert into watch_points (station_id, sensor_id, role, lag_minutes, note) values
  ('virtual:malaga', 'hidrosur:38:river_flow_m3s', 'flow_primary', null, 'Guadalhorce en Cártama, aguas abajo de la confluencia con el Campanillas'),
  ('virtual:malaga', 'hidrosur:46:river_flow_m3s', 'flow_secondary', null, 'Guadalhorce en Aljaima (Pizarra)'),
  ('virtual:malaga', 'hidrosur:127:river_flow_m3s', 'flow_secondary', null, 'Guadalhorce en Bobadilla, cabecera'),
  ('virtual:malaga', 'hidrosur:106:river_flow_m3s', 'flow_secondary', null, 'Campanillas en Los Llanes, afluente por la derecha'),
  ('virtual:malaga', 'hidrosur:20:reservoir_hm3', 'reservoir', null, 'volumen del Limonero (Guadalmedina)'),
  ('virtual:malaga', 'hidrosur:22:precip_mm', 'rain_local', null, 'Farola, lluvia en la ciudad'),
  ('virtual:malaga', 'hidrosur:120:precip_mm', 'rain_local', null, 'Limonero, cabecera del Guadalmedina'),
  ('virtual:malaga', 'hidrosur:35:precip_mm', 'rain_upstream', null, 'Coín, cabecera del Guadalhorce medio'),
  ('virtual:rincon-de-la-victoria', 'hidrosur:43:river_flow_m3s', 'flow_primary', null, 'Benamargosa, arroyo mayor de la Axarquía oriental'),
  ('virtual:rincon-de-la-victoria', 'hidrosur:104:river_flow_m3s', 'flow_secondary', null, 'Río Grande, afluente del Guadalhorce (contexto comarcal)'),
  ('virtual:rincon-de-la-victoria', 'hidrosur:101:precip_mm', 'rain_local', null, 'La Araña, en el propio municipio'),
  ('virtual:rincon-de-la-victoria', 'hidrosur:44:precip_mm', 'rain_local', null, 'Torrox, Axarquía oriental'),
  ('virtual:rincon-de-la-victoria', 'hidrosur:37:precip_mm', 'rain_upstream', null, 'Viñuela, cabecera de la Axarquía'),
  ('virtual:rincon-de-la-victoria', 'hidrosur:37:reservoir_hm3', 'reservoir', null, 'volumen de La Viñuela');
