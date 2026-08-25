# Capacidad: api-riesgo

## ADDED Requirements

### Requirement: Endpoint de riesgo
`GET /api/v1/risk` DEBE devolver el semáforo de las cuatro localizaciones objetivo, ordenadas con la principal primero, y aceptar `station` para filtrar por una. Cada elemento DEBE incluir `station`, `level`, `components`, `alerts`, `warnings`, `stale` y `computed_at`.

#### Scenario: Todas las localizaciones
- **Dado** `GET /api/v1/risk`
- **Entonces** se devuelven 4 elementos y el primero es `virtual:albal`.

#### Scenario: Una localización
- **Dado** `?station=virtual:benaguasil`
- **Entonces** se devuelve solo esa.

#### Scenario: Estación desconocida
- **Dado** `?station=virtual:nada`
- **Entonces** la respuesta es `404`.

### Requirement: Coherencia con el resto de la API
El nivel devuelto DEBE usar el mismo vocabulario que `alerts` y `/api/v1/sensors` (`verde|amarillo|naranja|rojo`) y calcularse en servidor, de modo que pantalla, API y futuras notificaciones vean el mismo valor.

#### Scenario: Mismo nivel que el sensor
- **Dado** un sensor de caudal que `/api/v1/sensors` marca en `naranja`
- **Entonces** el componente de caudal de su localización vigilante también es `naranja`.
