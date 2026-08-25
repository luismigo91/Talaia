# Diseño: collector SAIH Júcar

## 1. El catálogo es una tabla, no código

`docs/cuencas.md` enumera ~30 sensores con su `idVariable`, su significado y sus umbrales. Meterlos en un array de TypeScript obligaría a desplegar para añadir un pluviómetro. Van a una tabla `sensors`:

```sql
create table sensors (
  id             text primary key,          -- 'saih:13873'
  source         text not null,             -- 'saih'
  station_id     text not null references stations(id),
  external_id    text not null,             -- '13873' (idVariable del SAIH)
  variable       text not null,             -- canónica: river_flow_m3s, precip_rate_mmh, …
  unit           text not null,
  enabled        boolean not null default true,
  threshold_low  double precision,          -- fldFUmbralBajo  (amarillo)
  threshold_mid  double precision,          -- fldFUmbralMedio (naranja)
  threshold_high double precision,          -- fldFUmbralAlto  (rojo)
  meta           jsonb not null default '{}'::jsonb,
  unique (source, external_id, variable)
);
```

`meta` lleva el contexto que no se consulta desde SQL: `saih_station` (idEstacionRemota), `note`, `derived_from`. Las estaciones SAIH se siembran en `stations` con `kind` ∈ `gauge | reservoir | rain_gauge` y `source='saih'`, y conviven con las virtuales sin colisión de id (`saih:227` vs `virtual:albal`).

**Coordenadas**: el portal publica UTM 30N ETRS89 (EPSG:25830) bajo nombres engañosos (`fldNCoordGPSLat` es la X). La migración inserta `ST_Transform(ST_SetSRID(ST_Point(x, y), 25830), 4326)`: PostGIS ya está, y así no hay una reproyección casera en JavaScript.

## 2. Ventana incremental por sensor

Por cada sensor habilitado:

- `desde` = último `ts` en `observations` para (`source`, `station_id`, `variable`) **menos 15 min de solape** (las muestras provisionales se corrigen a posteriori; el upsert las reescribe).
- Si no hay dato previo, `desde` = ahora − `SAIH_BACKFILL_HOURS` (por defecto 24, tope 168).
- `hasta` = ahora.
- Si la ventana es menor que 5 min, se salta el sensor.

Un solo `select` agregado obtiene el último `ts` de todos los sensores de golpe (`group by station_id, variable`), no una consulta por sensor.

## 3. Hora local en la URL, UTC en la respuesta

Verificado el 25‑08‑2026: pedir `…/13873/2026-08-24 00:00/2026-08-24 02:00` devuelve muestras desde `2026-08-23T22:00:00.000Z`. El rango se interpreta en `Europe/Madrid` y los timestamps salen en UTC. El collector formatea el rango con `formatLocal(date, "Europe/Madrid")` (nuevo en `shared/time.ts`, inverso de `localToUtc`) y parsea la respuesta como UTC directo. Un rango en el formato equivocado devuelve `[]` sin error HTTP: por eso una respuesta vacía con ventana ≥ 1 h se registra como aviso, no como éxito silencioso.

## 4. Lluvia: de intensidad cincominutal a milímetros por hora

El SAIH no publica precipitación horaria. Publica:

- `INTENSIDAD DE LLUVIA CALCULADA` (`fkNFuncion=12`), **mm/h**, cada 5 min, en múltiplos de 2,4 (0,2 mm de cazoleta × 12).
- `LLUVIA ACUMULADA EN 24 HORAS` (`fkNFuncion=91`), acumulado **móvil**: la diferencia entre dos instantes no es la lluvia del intervalo, así que no sirve para derivar horarios.

Derivación: `precip_mm(H) = Σ v_i · 5/60` sobre las muestras con `ts ∈ [H, H+1h)`, exigiendo **≥ 10 de 12** muestras y **solo horas completas** (nunca la hora en curso). `ts` = inicio de la hora, la misma convención que Open‑Meteo (`ts = time − 1 h` para acumulados), de modo que `/compare` puede poner observación y predicción en el mismo eje sin ajustes en el frontend.

Validación empírica (estación 227, episodio 5‑6 de marzo de 2026): Σ(v·5/60) sobre 24 h = 27,8 mm frente a los 29,2 mm del acumulado publicado (−5 %, atribuible al desfase de la ventana móvil). Suficiente para el semáforo; se documenta que `precip_mm` de `saih` es una **estimación derivada**, no un dato publicado, y se marca en `sensors.meta.derived_from`.

## 5. Fallo aislado por sensor y éxito parcial

Un sensor caído no puede tumbar el ciclo: cada sensor se descarga en un `try/catch`, los errores se acumulan y al final el collector devuelve `{ recordsWritten, warning }`. `runWithStatus` gana un campo `warning` opcional: si viene, se escribe en `last_error` **aunque** el ciclo se marque como exitoso, de modo que `/api/v1/status` muestre "va, pero se ha perdido el sensor X" en lugar de verde falso o rojo falso. Si fallan **todos** los sensores, se lanza y el ciclo es un fallo normal.

## 6. Cuota y cortesía

No hay cuota documentada. El cliente serializa las peticiones del proceso con una separación mínima de 300 ms (~30 sensores ≈ 10 s por ciclo), timeout de 30 s, un único reintento ante 5xx o error de red, y `User-Agent` identificable. El job corre cada 10 min: por debajo del registro cincominutal, sin martillear el portal.

## 7. Qué se expone en la API

- `GET /api/v1/sensors` — catálogo: sensor, estación, variable, umbrales, último valor, `age_seconds` y `level` (`verde|amarillo|naranja|rojo`) calculado **en servidor** comparando el último valor con los umbrales. El semáforo *por localidad* sigue siendo fase 3; esto es el estado por sensor, que es dato, no política.
- `GET /api/v1/observations?station=&variable=&hours=` (o `?sensor=`) — serie temporal cruda para pintar la curva del Poyo.
