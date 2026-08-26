# Capacidad: api-badge

## ADDED Requirements

### Requirement: Insignia del nivel
`GET /api/v1/risk/badge` DEBE devolver un JSON compacto con `level`, `color`, `reading` (el valor que manda), `updated` y `stale` de una localización (`station`, por defecto la principal). `…/badge.svg` DEBE devolver la misma insignia como imagen SVG, para incrustar en un widget (Scriptable, KWGT…).

#### Scenario: JSON
- **Dado** `?station=virtual:albal`
- **Entonces** se devuelve su nivel, su color y la lectura que lo determina.

#### Scenario: Imagen
- **Dado** `…/badge.svg?station=virtual:albal`
- **Entonces** la respuesta es `image/svg+xml` con el nombre, el nivel y la lectura.
