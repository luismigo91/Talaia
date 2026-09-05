# Capacidad: historico-riesgo

> Comportamiento **vigente**. Origen: `notificaciones-riesgo` (Fase 4), archivado el 05-09-2026.

## ADDED Requirements

### Requirement: Evaluación periódica
El scheduler DEBE evaluar el riesgo de todas las localizaciones cada `RISK_INTERVAL_MIN` (5 por defecto) con la **misma** función que usa la API, y registrar su ejecución en `source_status` bajo la fuente lógica `risk`.

#### Scenario: Ciclo normal
- **Dado** el job `risk`
- **Cuando** se ejecuta
- **Entonces** `source_status` tiene una fila `risk` con `last_success_at` actualizado.

#### Scenario: Una localización que falla no impide las demás
- **Dado** que la evaluación de una localización lanza
- **Entonces** el resto se evalúan y el fallo se refleja como aviso del ciclo.

### Requirement: Estado y transiciones
El sistema DEBE mantener `risk_state` (nivel actual por localización, con `since`) y registrar en `risk_events` cada cambio de nivel con `previous_level`, `direction` (`subida`/`bajada`) y el desglose de componentes del momento.

#### Scenario: Primera evaluación
- **Dado** que no hay estado previo para una localización
- **Entonces** se crea `risk_state` y **no** se registra evento si el nivel es `verde`.

#### Scenario: Subida
- **Dado** estado `verde` y una evaluación `naranja`
- **Entonces** se registra un evento `direction='subida'` y `risk_state` pasa a `naranja` en el mismo ciclo.

#### Scenario: Sin cambio
- **Dado** estado `naranja` y una evaluación `naranja`
- **Entonces** no se registra ningún evento y `since` no cambia.

### Requirement: Histéresis en las bajadas
Una bajada de nivel DEBE confirmarse en `RISK_FALL_CONFIRMATIONS` evaluaciones consecutivas (3 por defecto) antes de aplicarse. Cualquier evaluación que no confirme el nivel inferior DEBE reiniciar el contador. Las subidas DEBEN aplicarse de inmediato.

#### Scenario: Bajada confirmada
- **Dado** estado `naranja` y tres evaluaciones seguidas en `verde`
- **Entonces** en la tercera se aplica el cambio y se registra un evento `direction='bajada'`.

#### Scenario: Bajada interrumpida
- **Dado** estado `naranja`, dos evaluaciones en `verde` y una en `naranja`
- **Entonces** el nivel sigue siendo `naranja`, no hay evento y el contador vuelve a cero.

#### Scenario: Subida durante una bajada pendiente
- **Dado** estado `naranja` con una bajada a `verde` a medio confirmar
- **Cuando** llega una evaluación `rojo`
- **Entonces** se aplica `rojo` inmediatamente y la bajada pendiente se descarta.

### Requirement: El silencio no baja el semáforo
Si una evaluación no tiene ningún componente evaluable (todos los datos obsoletos o ausentes), el nivel anterior DEBE conservarse, sin transición, y la advertencia DEBE quedar registrada.

#### Scenario: Sensores mudos
- **Dado** estado `naranja` y una evaluación sin componentes
- **Entonces** `risk_state` sigue en `naranja` y no se registra ningún evento.

### Requirement: Consulta del histórico
`GET /api/v1/risk/history` DEBE devolver las transiciones más recientes, con `station`, `level`, `previous_level`, `direction`, `ts` y si se notificó; DEBE aceptar `station` y `limit` (1–200, 50 por defecto).

#### Scenario: Orden
- **Dado** varias transiciones
- **Entonces** se devuelven de la más reciente a la más antigua.

#### Scenario: Filtro por localización
- **Dado** `?station=virtual:albal`
- **Entonces** solo se devuelven las suyas.
