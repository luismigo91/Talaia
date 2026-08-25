# Propuesta: semáforo de riesgo por localización (fase 3)

**Estado**: propuesta (25‑08‑2026) · **Fecha**: 2026‑08‑25 · **Depende de**: `mvp-comparativa-precipitacion`, `collector-saih-jucar`

## Por qué

Ya hay predicción (AEMET, seis modelos de Open‑Meteo), observación hidrológica (SAIH, cada cinco minutos) y avisos oficiales (CAP). Pero para saber si Albal está en riesgo hay que abrir tres pantallas y saber que `13873` es el barranc del Poyo. El objetivo del proyecto —*anticipar riesgo de inundación en cuatro localizaciones concretas*— exige un único número por localidad, calculado en servidor, que diga **verde, amarillo, naranja o rojo** y, sobre todo, **por qué**.

Es también lo que falta para que el dato sirva de algo: sin semáforo no hay notificación posible, y sin explicación del semáforo no hay confianza en él.

## Qué cambia

1. **`watch_points`** (`db/migrations/0007_watch_points.sql`): qué sensores amenazan a cada localización, con su rol (`flow_primary`, `flow_secondary`, `reservoir`, `rain_upstream`, `rain_local`) y el retardo de propagación conocido (Chiva → Riba‑roja ≈ 120 min). Sale del inventario por cuenca de `docs/cuencas.md`.
2. **La precipitación horaria derivada entra en el catálogo**: 13 filas de `sensors` con `meta.derived_from`, para que la lluvia se pueda vigilar y aparezca en `/api/v1/sensors`. `loadSensors()` las excluye por defecto, para que el collector no intente descargarlas del portal.
3. **`thresholds`**: umbrales de lluvia prevista y observada, por localización o globales. Los de caudal, nivel y embalse **no** se duplican: ya vienen de la CHJ en `sensors`.
4. **`RiskService`** (API): combina cuatro señales independientes y se queda con la peor, devolviendo el desglose completo.
5. **`GET /api/v1/risk`**: semáforo de las cuatro localizaciones (o de una), con sus componentes, sus avisos vigentes y sus advertencias de frescura.

## Las cuatro señales

| Señal | De dónde sale | Cómo se evalúa |
|---|---|---|
| **Caudal y embalses** | `observations` de los `watch_points` de rol `flow_*` / `reservoir` | Último valor contra los umbrales oficiales de la CHJ en `sensors`. Se toma el peor sensor |
| **Lluvia observada** | `precip_mm` derivado de los pluviómetros vigilados | Acumulado de 1 h y 12 h **por pluviómetro** (no la suma entre ellos) contra `thresholds` |
| **Lluvia prevista** | `forecasts` de la localización, última emisión de cada fuente | Acumulado 12 h y 24 h; el nivel lo marca la **mediana entre fuentes**, y el máximo se informa aparte |
| **Aviso oficial** | `alerts` vigentes de la zona AEMET de la localidad | El nivel del aviso, solo para eventos de inundación (`PR` lluvias, `TO` tormentas, `IN` inundaciones) |

El nivel de la localidad es el **máximo** de las señales que cuentan. Nunca una media: un caudal en rojo no se compensa con un cielo despejado.

## Decisiones tomadas

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Combinación | **Máximo**, no media ponderada. Un semáforo de riesgo no promedia |
| 2 | Lluvia prevista | El nivel lo marca la **mediana** entre fuentes (un modelo aislado no dispara el semáforo); el máximo se devuelve como contexto |
| 3 | Lluvia observada | Se compara **cada pluviómetro por separado**: 60 mm en Chiva es una señal, no se diluye promediando con Picassent |
| 4 | Datos viejos | Un sensor cuyo último dato supere `RISK_STALE_MINUTES` (30 por defecto) **no cuenta** para el nivel y genera una advertencia. Nunca un verde por silencio |
| 5 | Avisos que cuentan | Solo `PR`, `TO` e `IN`. Viento y costeros se devuelven como informativos: mezclar rebase marítimo con crecida haría el semáforo ilegible |
| 6 | Umbrales de lluvia | En `thresholds`, sembrados con los umbrales oficiales del **Plan Meteoalerta de AEMET** (Anexo 1): **20/40/90 mm en 1 h** y **60/100/180 mm en 12 h**, idénticos en 774602 y 774604. Ajustables por localización sin desplegar |
| 7 | Explicabilidad | Cada componente devuelve su valor, su umbral y una frase en español. El semáforo se puede auditar sin leer el código |
| 8 | Dónde se calcula | En la API, al vuelo. Sin tabla de estado ni histórico de niveles en esta fase |

## No-objetivos (explícitos)

- Notificaciones push y WebSocket (necesitan un histórico de cambios de nivel: fase siguiente).
- Frontend.
- Calibración fina de umbrales con series históricas: el portal no publica la DANA del 29‑10‑2024, así que no hay con qué calibrar todavía. Los umbrales arrancan con los de AEMET y se ajustan con episodios reales.
- Modelo hidrológico propio (tránsito de la crecida, tiempo de concentración). `lag_minutes` se guarda como dato, no se usa aún para desplazar series.
- Riesgo para puntos que no sean las cuatro localizaciones objetivo.

## Impacto

- Nuevas tablas: `watch_points`, `thresholds`. 13 filas nuevas en `sensors` (derivadas).
- Nuevo módulo `api/src/risk`, nuevos helpers en `packages/shared`.
- Sin dependencias nuevas. Sin cambios en los collectors.
