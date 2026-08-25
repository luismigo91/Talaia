# Tareas: semáforo de riesgo (fase 3)

## 1. Catálogo
- [x] `db/migrations/0007_watch_points.sql`: sensores derivados en `sensors`, tabla `watch_points` con las 30 filas de `docs/cuencas.md`, tabla `thresholds` con los umbrales del Plan Meteoalerta.
- [x] `loadSensors()` excluye derivados salvo petición explícita.
- [x] Esquema Drizzle de `watch_points` y `thresholds`; `loadWatchPoints()` y `loadThresholds()` en `packages/shared`.

## 2. Cálculo
- [x] `RiskService` con las cuatro señales, combinación por máximo y componentes explicables.
- [x] Frescura: `RISK_STALE_MINUTES`, exclusión del cálculo y `warnings`.
- [x] Filtro de avisos por `event_code` (`PR|TO|IN`) con el resto como informativos.

## 3. API
- [x] `GET /api/v1/risk` (todas o una localización).
- [x] Tests de integración: nivel por máximo, mediana entre modelos, lluvia por pluviómetro, aviso de viento que no eleva, dato obsoleto que no cuenta.

## 4. Cierre
- [x] Verificación con datos reales de SAIH y Open-Meteo, y con un episodio simulado (Poyo a 185 m³/s → rojo).
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration` en verde.
- [x] `docs/arquitectura.md` §7: sustituir el diseño preliminar por el implementado, con los umbrales y su procedencia.
- [x] `CLAUDE.md`: estado y variables nuevas.
- [x] Verificar la zona de avisos de Benaguasil: **es 774602**, confirmado contra el listado de municipios y el shapefile de AEMET. El seed era correcto.
- [ ] Archivar el cambio y fusionar en `openspec/specs/` (tras validación).
