# Talaia

Portal personal de vigilancia meteorológica e hidrológica para **Albal** (l'Horta Sud, València) y la cuenca del **barranc del Poyo**. Agrega fuentes oficiales (AEMET, SAIH Júcar, Meteoalarm, GVA Emergències) y complementarias (Open-Meteo, AVAMET), las normaliza en un esquema común y permite compararlas para anticipar riesgo de inundación.

- Contexto para desarrollo: [`CLAUDE.md`](CLAUDE.md)
- Arquitectura y esquema de datos: [`docs/arquitectura.md`](docs/arquitectura.md)
- Fichas de fuentes: [`docs/fuentes.md`](docs/fuentes.md)
- Cuencas y sensores a vigilar por localidad: [`docs/cuencas.md`](docs/cuencas.md)
- Especificaciones vigentes: [`openspec/specs/`](openspec/specs/) · propuestas: [`openspec/changes/`](openspec/changes/)

Estado: **en producción local / pre-despliegue Dokploy** — 11 incrementos implementados (MVP + SAIH + semáforo + notificaciones + Meteoalarm + frontend + retención + observación/SSE + calibración/AVAMET + GVA + PWA). Tests unitarios en verde; pendiente mover dominio de `api` a `web` y proveer `AEMET_API_KEY`/`VAPID_*`/`NTFY_URL` reales.
