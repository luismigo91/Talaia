import type { StyleSpecification } from "maplibre-gl";

/**
 * Estilo raster de OpenStreetMap definido aquí mismo: sin clave y sin depender de un
 * servicio de estilos de terceros que pueda caerse o empezar a cobrar. `NEXT_PUBLIC_MAP_STYLE`
 * permite apuntar a otro (por ejemplo, uno propio servido en el homelab).
 */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const mapStyle = (): string | StyleSpecification =>
  process.env.NEXT_PUBLIC_MAP_STYLE || OSM_STYLE;
