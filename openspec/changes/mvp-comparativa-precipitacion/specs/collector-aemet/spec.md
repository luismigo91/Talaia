# Capacidad: collector-aemet

## ADDED Requirements

### Requirement: Cliente OpenData en dos pasos
El collector DEBE obtener datos de AEMET OpenData siguiendo la URL `datos` de la primera respuesta, decodificando el cuerpo según el `charset` declarado (fallback ISO‑8859‑15), y DEBE tratar `estado != 200` o cuerpo vacío como fallo.

#### Scenario: Petición correcta
- **Dado** un endpoint que devuelve `{"estado":200,"datos":"<url>"}`
- **Cuando** el cliente lo consulta
- **Entonces** hace GET a `<url>` y devuelve el cuerpo decodificado como texto UTF‑8 correcto (p. ej. "Predicción" sin mojibake).

#### Scenario: Cuota excedida
- **Dado** un endpoint que responde `{"estado":429}`
- **Cuando** el cliente lo consulta
- **Entonces** espera 61 s, reintenta una vez, y si vuelve a fallar lanza `AemetError` con `estado=429` sin más reintentos.

#### Scenario: Cuerpo vacío
- **Dado** un endpoint que responde HTTP 200 con cuerpo vacío
- **Entonces** el cliente lanza `AemetError`.

### Requirement: Limitación de cuota
El cliente DEBE espaciar las peticiones a AEMET al menos 1,5 s entre sí dentro del proceso, de forma que nunca supere 40 peticiones/min.

#### Scenario: Ráfaga de peticiones
- **Dado** 5 llamadas consecutivas
- **Entonces** la quinta se inicia al menos 6 s después de la primera.

### Requirement: Caché por hash del payload
Si el cuerpo obtenido es idéntico (SHA‑256) al último guardado en `source_status.payload_hash` para esa fuente lógica, el collector NO DEBE reescribir filas y DEBE actualizar solo `last_success_at`.

#### Scenario: Predicción sin cambios
- **Dado** que la última ejecución guardó el hash H
- **Cuando** la nueva descarga tiene hash H
- **Entonces** `records_written = 0` y `last_success_at` se actualiza.

### Requirement: Predicción horaria por localización objetivo
El collector DEBE consultar `/api/prediccion/especifica/municipio/horaria/{ine}` para cada `meta.ine` distinto de las estaciones virtuales (`46007`, `46054`, `46235`, `46051`), en secuencia, y escribir las filas con `station_id` de cada estación virtual asociada a ese INE, `source='aemet'`, `forecast_ts` = `elaborado` (hora `Europe/Madrid` → UTC) y `ts` = inicio del intervalo horario en UTC.

#### Scenario: Cuatro localizaciones
- **Dado** las cuatro estaciones virtuales sembradas
- **Cuando** se ejecuta `run()`
- **Entonces** se hacen exactamente 4 consultas (8 peticiones HTTP) y existen filas de `precip_mm` para `virtual:albal`, `virtual:benetusser`, `virtual:mareny-barraquetes` (con los datos del municipio `46235`) y `virtual:benaguasil`.

#### Scenario: Fallo en una localización
- **Dado** que la consulta de `46235` devuelve 404
- **Entonces** las otras dos se escriben igualmente, `source_status['aemet:forecast:46235'].last_error` se rellena y `run()` no lanza.

#### Scenario: Precipitación horaria
- **Dado** `dia[0].fecha="2026-10-25T00:00:00"` y `precipitacion:[{"value":"1.4","periodo":"07"}]`
- **Entonces** se genera `{variable:'precip_mm', ts:'2026-10-25T04:00:00Z', value:1.4, unit:'mm'}` (06:00 CEST = 04:00 UTC).

#### Scenario: Cambio de hora
- **Dado** un fixture del día de cambio de horario (último domingo de octubre)
- **Entonces** todas las `ts` resultantes son estrictamente crecientes en UTC y no hay duplicados.

#### Scenario: Valor vacío
- **Dado** `{"value":"","periodo":"09"}`
- **Entonces** no se genera fila para esa hora y variable.

#### Scenario: Probabilidad por tramos
- **Dado** `probPrecipitacion:[{"value":"60","periodo":"0713"}]`
- **Entonces** se generan 6 filas `precip_prob_pct=60` para las horas 07–12 locales.

#### Scenario: Viento en km/h
- **Dado** `vientoAndRachaMax` con `velocidad:["28"]` y racha `value:"41"`
- **Entonces** `wind_ms=7.78` y `gust_ms=11.39` (±0.01).

### Requirement: Avisos CAP de las zonas objetivo
El collector DEBE descargar `/api/avisos_cap/ultimoelaborado/area/77`, extraer el tar.gz, parsear cada XML CAP 1.2 y hacer upsert en `alerts` de los avisos cuyo `geocode` "AEMET-Meteoalerta zona" esté en el conjunto de `meta.aemet_zone` de las estaciones virtuales (`774602`, `774604`), usando el bloque `<info>` en `es-ES`.

#### Scenario: Aviso amarillo por lluvia
- **Dado** un tar con un CAP de zona `774602`, `eventCode=PR;Lluvias`, nivel `amarillo`, parámetro `P2;Precipitación acumulada en 12 horas;60 mm`
- **Entonces** existe una fila en `alerts` con `id=<identifier>`, `level='amarillo'`, `event='Lluvias'`, `area_code='774602'`, `onset`/`expires` en UTC y `geom` con el polígono.

#### Scenario: Aviso de Litoral sur
- **Dado** un CAP de zona `774604` nivel naranja
- **Entonces** se inserta con `area_code='774604'`.

#### Scenario: Aviso de otra zona
- **Dado** un CAP de zona `774601` (Interior norte)
- **Entonces** no se inserta.

#### Scenario: Mensaje "sin aviso"
- **Dado** un CAP de zona `77VV77` / nivel verde
- **Entonces** no se inserta en `alerts`, pero `source_status['aemet:alerts'].last_success_at` se actualiza.

#### Scenario: Actualización de un aviso existente
- **Dado** un aviso con `id` ya presente y nuevo `sent` posterior
- **Entonces** la fila se actualiza (nivel, expires, raw) sin duplicar.

### Requirement: Registro de estado por fuente lógica
Cada ejecución DEBE escribir en `source_status` (`aemet:forecast:<ine>`, `aemet:alerts`) `last_run_at`, y `last_success_at` + `records_written` si tuvo éxito, o `last_error` si falló, sin propagar la excepción fuera de `run()`.

#### Scenario: Fallo de red
- **Dado** que AEMET no responde
- **Entonces** `run()` resuelve sin lanzar, `last_error` contiene el mensaje y `last_success_at` no cambia.
