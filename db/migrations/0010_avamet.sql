-- AVAMET: red de estaciones amateur de la Comunitat Valenciana.
--
-- Es la única señal disponible del barranc de l'Horteta, que está fuera del SAIH y que pudo
-- aportar ~3.500 m³/s en Torrent el 29-10-2024. Dato sin control de calidad: entra como
-- contexto y se muestra siempre marcado como amateur.
--
-- Las estaciones no se siembran aquí: el collector las da de alta con las coordenadas de su
-- ficha técnica, así que la red puede crecer sin tocar el repositorio.

insert into sources (id, name, kind, url) values
  ('avamet', 'AVAMET · Meteoxarxa (estaciones amateur, CC BY-NC-ND 4.0)', 'amateur',
   'https://www.avamet.org');
