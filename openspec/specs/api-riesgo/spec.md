# Capacidad: api-riesgo

> Comportamiento **vigente**. Origen: `semaforo-riesgo` (Fase 3: semáforo de riesgo), archivado el 25‑08‑2026 y 05‑09‑2026 (SSE/health).

## Requirements

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

### Requirement: Anuncio de cambios de nivel
Al registrar una transición, el ciclo de riesgo DEBE publicarla en el canal `talaia_risk` de Postgres con la localización, el nivel nuevo, el anterior y el sentido del cambio.

#### Scenario: Transición anunciada
- **Dado** una subida a `rojo` en Albal
- **Entonces** quien esté escuchando el canal recibe un JSON con `stationId`, `level='rojo'` y `direction='subida'`.

### Requirement: Stream de cambios
`GET /api/v1/risk/stream` DEBE mantener una conexión SSE que emita un evento `risk` por cada cambio, con latidos periódicos para que ningún intermediario la dé por muerta, y DEBE seguir funcionando aunque la escucha de Postgres no se haya podido establecer.

#### Scenario: Varios clientes
- **Dado** dos navegadores conectados
- **Entonces** ambos reciben el mismo evento, con una sola escucha en la base de datos.

#### Scenario: Cliente que se va
- **Dado** un cliente que cierra la conexión
- **Entonces** deja de recibir y no afecta a los demás.

### Requirement: Health y status con frescura (Fase observabilidad)
`GET /api/v1/health` DEBE incluir `sources` y `warnings` con el estado stale por fuente (30 min SAIH/AVAMET/GVA/Meteoalarm, 120 min Open-Meteo/AEMET). `GET /api/v1/status` DEBE incluir `stale` y `threshold_seconds` por fuente.

#### Scenario: Fuente desactualizada
- **Dado** `saih` con `last_success_at` de hace 45 min
- **Entonces** `health.warnings` menciona `saih` y `status.sources[0].stale=true`.
