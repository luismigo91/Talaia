## ADDED Requirements

### Requirement: Caudal anticipado desde la lluvia de cabecera
Para cada localización con un modelo lluvia‑caudal habilitado en `runoff_models`, el semáforo DEBE añadir un componente `flow_projected` cuando la lluvia media de los pluviómetros de cabecera acumulada en `window_hours` sea al menos 1 mm. El valor DEBE ser el caudal proyectado `a·P^b` en m³/s, evaluado contra los umbrales oficiales del aforo del modelo, y el componente DEBE llevar `horizon_minutes` (el retardo) y un `detail` que empiece por "la lluvia en cabecera anticipa", nombre los pluviómetros, la ventana, el aforo y el plazo.

#### Scenario: Cabecera cargada
- **Dado** 40 mm de media en Chiva, Siete Aguas y Turís en las últimas 3 h y un modelo del Poyo que proyecta 95 m³/s
- **Entonces** hay un componente `flow_projected` con `value≈95`, `level='naranja'` (95 ≥ 70), `threshold=70`, `horizon_minutes` igual al retardo del modelo y un detalle que nombra Riba‑roja.

#### Scenario: Sin lluvia
- **Dado** 0,4 mm de media en cabecera en la ventana
- **Entonces** no hay componente `flow_projected`.

#### Scenario: Sin modelo
- **Dado** el Mareny, sin fila en `runoff_models`
- **Entonces** no hay componente `flow_projected` ni advertencia.

### Requirement: La proyección no da rojo
El nivel del componente `flow_projected` DEBE limitarse a `naranja` aunque el caudal proyectado supere el umbral rojo; el detalle DEBE decir que el rojo exige caudal medido.

#### Scenario: Proyección por encima del rojo
- **Dado** una proyección de 400 m³/s en el Poyo (umbral rojo 150)
- **Entonces** el componente es `naranja` y el detalle lo explica.

### Requirement: Tendencia entre corridas en la lluvia prevista
Cada componente `rain_forecast` DEBE incluir `trend` con la mediana de las corridas anteriores para la **misma ventana** (`previous`), la diferencia (`delta`), el sentido (`sube|baja|estable`), la emisión más reciente usada y el número de fuentes comparadas, o `null` si no hay corrida anterior comparable. La corrida anterior de una fuente DEBE ser su última emisión al menos `RISK_TREND_GAP_HOURS` (5) antes de la vigente y no más antigua de 36 h. El sentido DEBE ser `estable` si `|delta| < max(2 mm, 20 % del mayor de los dos)`. La tendencia NO DEBE alterar el nivel y DEBE aparecer en el detalle en español.

#### Scenario: El episodio crece
- **Dado** tres modelos que hace 7 h daban 24 mm en 12 h y ahora dan 120 mm
- **Entonces** `trend.previous=24`, `trend.delta=96`, `trend.direction='sube'`, el detalle dice "al alza: las corridas de hace 7 h daban 24 mm" y el nivel es el de los 120 mm (`naranja`).

#### Scenario: Emisiones demasiado seguidas
- **Dado** un modelo con una corrida de hace 3 h y otra de hace 1 h
- **Entonces** `trend` es `null`.

#### Scenario: Ruido no es tendencia
- **Dado** 0,4 mm antes y 0,6 mm ahora
- **Entonces** `direction='estable'`.
