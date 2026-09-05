# Capacidad: web-avisos

> Comportamiento **vigente**. Origen: `frontend-web` (Fase 6), archivado el 05-09-2026.

## ADDED Requirements

### Requirement: Pantalla de avisos
La página `/avisos` DEBE listar los avisos vigentes con su nivel (en texto), el fenómeno, la zona y las localidades afectadas, la vigencia en hora local y la fuente de la que proceden.

#### Scenario: Aviso que no eleva el semáforo
- **Dado** un aviso de viento o costero
- **Entonces** se muestra marcado como que no eleva el semáforo, en lugar de omitirlo.

#### Scenario: Sin avisos
- **Dado** que no hay ninguno vigente
- **Entonces** se explica que la ausencia de aviso no implica ausencia de riesgo, porque el semáforo mira además caudal y lluvia real.
