# Tareas: preaviso de escalada

- [x] `risk-eval.ts`: `upcoming_alerts` + `nextAlertChange` puro y cableado en `riskFor` (nivel intacto).
- [x] Tests unitarios del cálculo puro (sube, baja, sin cambio, horizonte, no-inundación).
- [x] Test de integración: vigente + futuro en `alerts` → `upcoming_alerts` y `next_change` en `/risk`.
- [x] Web: tipos en `lib/api.ts`, línea de preaviso en `StationCard` y bloque en `/l/{id}`.
- [x] Documentación: `docs/arquitectura.md` §7 (preaviso).
- [ ] Verificar en local (unitarios + integración + typecheck + lint) y archivar.
