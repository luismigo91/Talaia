## ADDED Requirements

### Requirement: Corridas de la lluvia prevista
`GET /api/v1/forecast-runs` DEBE devolver, para una localización (`station`, la principal por defecto) y un horizonte `horizon` de 12 o 24 h, la lluvia acumulada que cada emisión (`forecast_ts`) de las últimas `lookback` horas (48 por defecto, 6–96) preveía para la ventana **fija** que empieza en la hora actual. Cada corrida DEBE indicar `hours_covered`; la respuesta DEBE incluir por fuente el `delta` entre la primera y la última corrida y una lista `medians` con la mediana entre fuentes por tramo de 6 h de antigüedad (una corrida por fuente y tramo). Un `horizon` distinto de 12 o 24 DEBE responder `400`.

#### Scenario: Episodio que se desinfla
- **Dado** un modelo con una corrida antigua que daba 36 mm y una nueva que da 4 mm para la misma ventana
- **Entonces** su serie lista `[36, 4]` y `delta=-32`.

#### Scenario: Corrida que no cubre la ventana
- **Dado** una corrida que solo alcanza 4 de las 24 h
- **Entonces** `hours_covered=4` y el frontend la marca.

#### Scenario: Datos fuera de ventana
- **Dado** una fuente cuyas horas previstas caen todas antes de ahora
- **Entonces** no aparece en `series`.
