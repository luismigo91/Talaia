# OpenSpec en Talaia

- `specs/` — comportamiento **vigente** del sistema, una carpeta por capacidad (`specs/<capacidad>/spec.md`).
- `changes/` — **propuestas** de cambio pendientes o en curso. Cada una tiene:
  - `proposal.md` — qué y por qué, alcance, no-objetivos, preguntas abiertas.
  - `design.md` — decisiones técnicas (opcional si es trivial).
  - `specs/<capacidad>/spec.md` — requisitos con escenarios (`### Requirement` / `#### Scenario`, formato Given/When/Then).
  - `tasks.md` — checklist de implementación.

Flujo: propuesta → validación por el desarrollador → implementación (loop implementación → QA → tests en verde) → archivado en `changes/archive/` y fusión en `specs/`.
