# Capacidad: api-alertas

> Comportamiento **vigente**. Origen: `frontend-web` (Fase 6), archivado el 05-09-2026.

## ADDED Requirements

### Requirement: Avisos de las zonas vigiladas
`GET /api/v1/alerts` DEBE devolver los avisos de las zonas de aviso de las localizaciones objetivo, **deduplicados entre fuentes** con la misma regla que el semáforo, indicando de qué fuente procede cada uno y a qué localidades afecta. Por defecto solo los vigentes; `active=false` incluye los caducados. Acepta `zone` y `limit` (1–200).

#### Scenario: El mismo aviso en dos fuentes
- **Dado** un aviso idéntico publicado por `aemet` y por `meteoalarm`
- **Entonces** se devuelve una sola vez, con `source='aemet'`.

#### Scenario: Aviso caducado
- **Dado** un aviso cuya vigencia terminó
- **Entonces** no aparece salvo con `active=false`.

#### Scenario: Zona traducida a localidades
- **Dado** un aviso de la zona `774602`
- **Entonces** el resultado nombra las localidades que dependen de esa zona.
