-- Retención y compresión de las series temporales.
--
-- `observations` crecía sin límite: el SAIH escribe ~16.000 filas al día. Se conservan 3 años
-- —no menos: calibrar los umbrales con episodios reales exige tener el histórico— y se
-- comprimen en columnar a partir de los 30 días.
--
-- Los 30 días no son arbitrarios: el collector reescribe muestras recientes (solape de 15 min
-- y datos provisionales que la CHJ corrige a posteriori), así que un upsert nunca debe caer
-- en un chunk ya comprimido.
--
-- Se usa `add_compression_policy` y no `add_columnstore_policy` porque la segunda es un
-- PROCEDIMIENTO y el migrador aplica cada fichero dentro de una transacción.

alter table observations set (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby = 'source, station_id, variable',
  timescaledb.orderby = 'ts desc'
);
select add_compression_policy('observations', compress_after => interval '30 days');
select add_retention_policy('observations', interval '3 years');

alter table forecasts set (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby = 'source, station_id, variable',
  timescaledb.orderby = 'ts desc'
);
select add_compression_policy('forecasts', compress_after => interval '30 days');
