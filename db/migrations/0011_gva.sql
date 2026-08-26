-- GVA Emergències / CCE 112 Comunitat Valenciana.
--
-- Avisos de Protección Civil autonómica: activación de las fases del plan de emergencias
-- (Situación 0/1/2/3), distintos de los avisos meteorológicos de AEMET. Es la señal de que
-- las autoridades han escalado, no de que vaya a llover.
--
-- Las zonas de la GVA son comarcas (`idZonaEmergencia`), no las zonas de aviso de AEMET, así
-- que cada localización guarda las suyas: su comarca y el comodín provincial (51 = Valencia),
-- que la GVA usa para activaciones de toda la provincia. Verificado contra su API el 26-08-2026.

insert into sources (id, name, kind, url) values
  ('gva', 'GVA Emergències · CCE 112 Comunitat Valenciana', 'official', 'https://www.112cv.gva.es');

update stations set meta = meta || '{"gva_zones":["28","51"]}'::jsonb
  where id in ('virtual:albal', 'virtual:benetusser');       -- L'Horta Sud
update stations set meta = meta || '{"gva_zones":["33","51"]}'::jsonb
  where id = 'virtual:mareny-barraquetes';                   -- La Ribera Baixa
update stations set meta = meta || '{"gva_zones":["23","51"]}'::jsonb
  where id = 'virtual:benaguasil';                           -- El Camp de Túria
