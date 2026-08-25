# Tareas: frontend web (fase 6)

## 1. Paquete
- [x] `web/` con Next.js 16 (App Router), React 19 y TypeScript; `output: "standalone"`.
- [x] Cliente de la API en el servidor (`API_URL`, `revalidate`), con tipos compartidos y manejo de errores.
- [x] Estilos base con variables, tema claro y oscuro.

## 2. Pantallas
- [x] `/` semáforo: tarjetas ordenadas por riesgo, desglose, avisos, advertencias e histórico.
- [x] `/mapa`: MapLibre con localizaciones y sensores coloreados por umbral.
- [x] `/comparativa`: series por fuente en SVG, selección por URL y tabla de totales.

## 3. Tests
- [x] Unitarios de la lógica de presentación (orden por riesgo, formato de hora local, escalas del gráfico).
- [x] Componentes con Testing Library: nivel visible en texto, advertencias, estados vacíos.

## 4. Infra
- [x] Target `web` en `infra/Dockerfile` y servicio en el compose.
- [x] `pnpm-workspace.yaml`, `.env.example` (`API_URL`, `NEXT_PUBLIC_MAP_STYLE`), lint y formato.

## 5. Cierre
- [x] Comprobación real con la pila local: las tres páginas sirven datos reales (4 tarjetas, 70 sensores en el mapa, 6 series en la comparativa con sus horas de emisión).
- [ ] Verificación visual en navegador: no fue posible (la extensión de Chrome no está conectada); se verificó el HTML servido.
- [x] Suite completa en verde y build de producción.
- [x] Comprobación real contra la API local con datos reales.
- [x] `docs/arquitectura.md` y `CLAUDE.md`.
- [ ] Archivar y fusionar en `openspec/specs/` (tras validación).
