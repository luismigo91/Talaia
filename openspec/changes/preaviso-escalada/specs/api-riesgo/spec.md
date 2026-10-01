## ADDED Requirements

### Requirement: Avisos futuros en la respuesta de riesgo
`GET /api/v1/risk` DEBE incluir `upcoming_alerts` por localización: los avisos
de su zona (`aemetZone` + `gvaZones`) con `onset > now` y `expires > now`,
ordenados por `onset` (máximo 20), con `id, source, level, event, event_code,
onset, expires, counts`. Los de inundación (`PR`/`TO`/`IN`) DEBEN marcar
`counts=true`; el resto viaja como contexto sin preavisar nada.

#### Scenario: Rojo publicado por adelantado
- **Dado** un aviso `PR` rojo con `onset` dentro de 4 h en la zona 774602
- **Entonces** Albal lo trae en `upcoming_alerts` con su `onset`, y su `level`
  sigue siendo el de las señales actuales.

#### Scenario: Sin avisos futuros
- **Dado** ningún aviso con `onset` futuro en la zona
- **Entonces** `upcoming_alerts` es `[]`.

### Requirement: Próximo cambio por avisos
Cada localización DEBE incluir `next_change` con el primer instante (dentro de
72 h) en que el máximo entre avisos vigentes y futuros deja el nivel actual
distinto: `{ at, level, direction: sube|baja, reason: "aviso oficial" }`, o
`null` si no hay ninguno. El cálculo DEBE suponer caudal y lluvia constantes
en su máximo actual (suelo) y SOLO DEBE considerar avisos que cuentan
(`counts`). NO DEBE alterar `level`, `components` ni `alerts`, y NO DEBE
generar eventos ni notificaciones.

#### Scenario: Escalada anunciada
- **Dado** nivel actual amarillo y un `PR` rojo que empieza en 4 h
- **Entonces** `next_change = { level: 'rojo', direction: 'sube' }` con `at`
  igual al `onset` del aviso.

#### Scenario: Desescalada al vencer
- **Dado** nivel rojo por un `PR` rojo que vence a las 23:59 con un `PR`
  naranja vigente hasta las 09:59 del día siguiente (y suelo verde)
- **Entonces** `next_change = { level: 'naranja', direction: 'baja' }` con `at`
  igual al fin del rojo.

#### Scenario: Viento futuro no preavisa
- **Dado** solo un aviso `VI` futuro
- **Entonces** `next_change` es `null` (viaja en `upcoming_alerts` con
  `counts=false`).

### Requirement: Preaviso visible en la web
La tarjeta de la home y la página `/l/{id}` DEBEN mostrar, cuando exista
`next_change`, "Próximo: sube|baja a {nivel} a las {DD/MM HH:MM}" en hora de
Madrid. Sin `next_change` NO DEBE mostrarse nada.
