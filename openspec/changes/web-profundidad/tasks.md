# Tareas

## API
- [x] `GET /api/v1/verify` — predicción de la víspera vs. observación por día completo
- [x] Registrar `VerifyController`/`VerifyService` en el módulo

## Web
- [x] `/verificacion` — tabla predicción vs. realidad con selector de localidad y rango
- [x] `/como-funciona` — método, umbrales, histéresis y límites honestos
- [x] `/embalses` — volumen, cota y ocupación de los seis embalses
- [x] `/avisos` — conmutador vigentes / todos (con caducados atenuados)
- [x] Detalle de localidad — selector 24 h / 7 días y series de lluvia y embalse
- [x] Bug del eje del gráfico: `formatTick` (sin etiquetas repetidas) y marcas diarias en ventanas largas
- [x] Open Graph (`og.png`, metadata), `robots.txt`, `sitemap.xml`
- [x] Frescura ("actualizado a las …") a la vista en la home
- [x] Enlaces de navegación a las páginas nuevas

## QA
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm prettier --check`
- [x] `next build` (rutas de metadata incluidas) y tests del frontend en verde
- [x] Verificación visual (móvil 390 y escritorio) sin desbordes horizontales
- [ ] Verificar `/verificacion` con datos reales tras desplegar la API
- [ ] Archivar y fusionar en `openspec/specs/`
