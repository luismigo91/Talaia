## ADDED Requirements

### Requirement: Calibración lluvia‑caudal
El sistema DEBE poder, para un aforo y sus pluviómetros de cabecera, sobre el histórico descargado: construir la lluvia media horaria de cabecera, estimar el retardo entre 0 y 6 h por correlación cruzada con el caudal horario máximo, ajustar `Q = a·P^b` en log‑log sobre las horas con lluvia acumulada apreciable y caudal medido, e informar de episodios usados, retardo, coeficientes, r² y un veredicto en español. Con `--apply` DEBE escribir o actualizar la fila de `runoff_models` con esa procedencia en `meta`; sin él, solo informa.

El ajuste solo DEBE darse por utilizable si, además de r² ≥ 0,5 y `RUNOFF_MIN_EVENTS` horas, el mayor caudal observado en las horas con respuesta alcanza el **primer umbral del aforo**: una relación ajustada sobre el goteo no dice nada sobre llegar a los umbrales y no debe extrapolarse.

#### Scenario: Pocos episodios
- **Dado** menos de `RUNOFF_MIN_EVENTS` (5) horas‑episodio con lluvia apreciable
- **Entonces** el veredicto dice que no hay episodios suficientes y `--apply` no escribe nada.

#### Scenario: Buen r² sobre el goteo
- **Dado** el Poyo real: 41 horas con respuesta, r² 0,61, pero caudal máximo 1,9 m³/s frente a un primer umbral de 30
- **Entonces** el veredicto dice que la relación no dice nada sobre alcanzar los umbrales y `--apply` no escribe nada.

#### Scenario: Ajuste razonable
- **Dado** un ajuste con r² ≥ 0,5, episodios suficientes y un caudal máximo con respuesta por encima del primer umbral
- **Entonces** el informe propone la fila y `--apply` la escribe con `fitted_from`, `fitted_to`, `n_events` y `r2`.

### Requirement: Modelos lluvia‑caudal como datos
`runoff_models` DEBE guardar por modelo: localización, aforo (`flow_sensor_id`), pluviómetros (`rain_sensor_ids`), `window_hours`, `lag_minutes`, `coef_a`, `coef_b`, `min_rain_mm`, `enabled` y `meta` con la procedencia. El semáforo DEBE leer solo los habilitados.

#### Scenario: Deshabilitar sin desplegar
- **Dado** `enabled=false` en el modelo del Poyo
- **Entonces** el semáforo deja de emitir `flow_projected` para Albal y Benetússer.
