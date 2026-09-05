# Propuesta: profundidad de la web (fase 12)

**Estado**: propuesta (26‑08‑2026) · **Depende de**: `frontend-web`

## Por qué

La web cubre lo esencial pero deja datos sin lucir y falta transparencia. Se añade lo que más eleva una atalaya: ver el pasado (episodios), contrastar predicción con realidad, explicar el método, y sacar a la superficie embalses, lluvia amateur y avisos históricos.

## Qué cambia

1. **Predicción vs. realidad** (`/verificacion` + `GET /api/v1/verify`): por día, lo que predijo cada modelo frente a lo que se observó.
2. **Historia / episodio**: el detalle de localidad gana selector de rango (24 h / 7 días) y grafica también lluvia y embalse, no solo caudal.
3. **Página de método** (`/como-funciona`): semáforo, umbrales, fuentes y límites, con honestidad (sensor provisional, datos amateur, picos filtrados).
4. **Embalses** (`/embalses`): cota, volumen y % de los seis embalses vigilados.
5. **Histórico de avisos**: `/avisos` con conmutador vigentes / todos.
6. **Pulido**: bug del eje del gráfico con valores casi cero, Open Graph (tarjeta al compartir), `robots.txt`, `sitemap`, y frescura ("actualizado a las …") a la vista.

## No‑objetivos

- Radar de AEMET (necesita clave), autenticación, analítica.
- Modelo de verificación fino: la observación de referencia es la lluvia de los pluviómetros vigilados (aproximación, documentada).

## Impacto

- `api/`: endpoint `/verify`.
- `web/`: páginas `/verificacion`, `/como-funciona`, `/embalses`; detalle con rango; robots/sitemap/OG; fix del gráfico.
