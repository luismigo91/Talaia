# Capacidad: pwa

> Comportamiento **vigente**. Origen: `pwa-movil` (Fase 11: PWA móvil), archivado el 05-09-2026.

## Requirements

### Requirement: Instalable como app
El frontend DEBE servir un manifest (`/manifest.webmanifest`) con nombre, iconos (192/512 y maskable), `display: standalone`, `theme_color` y `start_url`, de modo que el navegador ofrezca instalar Talaia y abrirla en pantalla completa.

#### Scenario: Manifest válido
- **Dado** una carga de la home
- **Entonces** hay un `<link rel="manifest">` y el manifest declara al menos un icono de 192 y otro de 512.

#### Scenario: iOS
- **Dado** Safari en iPhone
- **Entonces** existe `apple-touch-icon` y los metadatos `apple-mobile-web-app` para "Añadir a pantalla de inicio".

### Requirement: Funciona sin red
Un service worker DEBE cachear la interfaz y la última respuesta, sirviendo las páginas con estrategia network-first (dato fresco si hay red, último conocido si no) y los estáticos cache-first. Su instalación NO DEBE fallar si no puede precachear.

#### Scenario: Registro
- **Dado** un navegador compatible
- **Entonces** el service worker se registra al cargar la app.

#### Scenario: Sin conexión
- **Dado** que se pierde la red tras una visita
- **Entonces** la app abre mostrando el último estado conocido, no un error del navegador.
