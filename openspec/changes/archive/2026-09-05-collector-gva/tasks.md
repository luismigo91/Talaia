# Tareas: collector GVA Emergències

- [x] `db/migrations/0011_gva.sql`: fuente `gva` y `meta.gva_zones` en las cuatro estaciones.
- [x] `VirtualStation.gvaZones` en `packages/shared`.
- [x] `collectors/gva` (cliente, parser con catálogos embebidos, run, cli) y fixtures.
- [x] El semáforo y `/alerts` consultan la unión de zonas AEMET + GVA.
- [x] Job `gva` cada 5 min, Dockerfile, `.env.example`.
- [x] Tests unitarios y de integración (semáforo elevado por la GVA, comodín provincial, TTL).
- [x] Ejecución real contra la API (sin emergencias activas: 0 avisos, éxito registrado).
- [ ] **Capturar una respuesta real con `z2` poblado en el próximo episodio y confirmar la fixture.**
- [x] Archivar y fusionar en `openspec/specs/` (tras validación).
