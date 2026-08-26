# Capacidad: almacenamiento

## MODIFIED Requirements

### Requirement: Políticas de retención y compresión
Las hypertables DEBEN tener política de retención: `raw_payloads` 7 días, `forecasts` 365 días y `observations` **3 años**. `observations` y `forecasts` DEBEN comprimirse en formato columnar a partir de los **30 días**, segmentadas por `(source, station_id, variable)` y ordenadas por `ts` descendente.

#### Scenario: Políticas activas tras migrar
- **Dado** una base recién migrada
- **Entonces** `timescaledb_information.jobs` tiene retención para las tres hypertables y compresión para `observations` y `forecasts`.

#### Scenario: Los upserts recientes no chocan con la compresión
- **Dado** que el collector reescribe muestras provisionales de las últimas horas
- **Entonces** esas filas están en chunks sin comprimir, porque solo se comprime lo anterior a 30 días.

#### Scenario: El histórico sobrevive para calibrar
- **Dado** que el objetivo es ajustar umbrales con episodios pasados
- **Entonces** las observaciones se conservan 3 años, no los 365 días de las predicciones.
