-- Fase 15 (cont.): Málaga y Rincón de la Victoria, sexta y séptima localización.
--
-- Identificadores verificados el 01-10-2026 en las páginas de AEMET y en el feed
-- vivo de Meteoalarm (ver propuesta en openspec/changes/nuevas-localizaciones):
--   Málaga: municipio 29067, capital a 36°43'13"N 4°25'11"W (36.7203, -4.4197),
--     altitud 8 m, zona "Sol y Guadalhorce" = 612903 (ES094 en Meteoalarm).
--   Rincón de la Victoria: municipio 29082, capital a 36°42'58"N 4°17'32"W
--     (36.7161, -4.2922), altitud 12 m, zona "Axarquía" = 612904 (ES095).
--
-- Sin watch_points a propósito: Málaga y Rincón están en la Demarcación de las
-- Cuencas Mediterráneas Andaluzas y ningún sensor del catálogo SAIH-Júcar los cubre
-- (el SAIH Hidrosur es otro portal). El semáforo combina lluvia prevista (Open-Meteo)
-- y avisos oficiales (Meteoalarm). Sin gva_zones: no es Comunitat Valenciana.
insert into stations (id, source, name, kind, geom, elevation_m, meta) values
  ('virtual:malaga', 'virtual', 'Málaga', 'municipality',
    ST_SetSRID(ST_Point(-4.4197, 36.7203), 4326), 8,
    '{"ine":"29067","aemet_zone":"612903","aemet_note":"zona Sol y Guadalhorce (verificado 01-10-2026)","hydro_note":"Guadalmedina/Guadalhorce (Cuencas Mediterráneas Andaluzas): sin cobertura SAIH en el catálogo; semáforo con lluvia prevista + avisos"}'),
  ('virtual:rincon-de-la-victoria', 'virtual', 'Rincón de la Victoria', 'municipality',
    ST_SetSRID(ST_Point(-4.2922, 36.7161), 4326), 12,
    '{"ine":"29082","aemet_zone":"612904","aemet_note":"zona Axarquía (verificado 01-10-2026)","hydro_note":"arroyos de la Axarquía (Cuencas Mediterráneas Andaluzas): sin cobertura SAIH en el catálogo; semáforo con lluvia prevista + avisos"}');
