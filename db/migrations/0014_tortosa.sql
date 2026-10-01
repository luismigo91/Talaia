-- Fase 15: Tortosa, quinta localización objetivo.
--
-- Identificadores verificados el 01-10-2026 en la página de AEMET
-- (eltiempo/prediccion/municipios/tortosa-id43155):
--   municipio 43155, capital a 40°48'39"N 0°31'30"E (40.8108, 0.525), altitud 49 m,
--   zona de avisos "Prelitoral sur de Tarragona" = 694305 en nuestro catálogo
--   (ES193 en Meteoalarm, ya mapeado en collectors/meteoalarm/src/zones.ts).
--
-- Sin watch_points a propósito: el Ebro es demarcación de la CHE y ningún sensor
-- del catálogo SAIH-Júcar lo cubre. El semáforo combina lluvia prevista (Open-Meteo,
-- por coordenadas) y avisos oficiales (Meteoalarm, por zona); el caudal del Ebro
-- espera a un collector del SAIH del Ebro, que es otro portal. Sin gva_zones:
-- es Catalunya y las fases de la GVA no aplican.
insert into stations (id, source, name, kind, geom, elevation_m, meta) values
  ('virtual:tortosa', 'virtual', 'Tortosa', 'municipality',
    ST_SetSRID(ST_Point(0.525, 40.8108), 4326), 49,
    '{"ine":"43155","aemet_zone":"694305","aemet_note":"zona Prelitoral sur de Tarragona (verificado 01-10-2026)","hydro_note":"Ebro (CHE): sin cobertura SAIH en el catálogo; semáforo con lluvia prevista + avisos"}');
