"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MlMap, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Level, Sensor, StationRisk } from "@/lib/api";
import { ago, formatValue, label, VARIABLE_LABEL } from "@/lib/format";
import { mapStyle } from "@/lib/mapStyle";

const LEVEL_COLOR: Record<Level, string> = {
  verde: "#2f8f5a",
  amarillo: "#ad8210",
  naranja: "#c9691c",
  rojo: "#c0392b",
};
const NO_DATA = "#879898";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function dot(color: string, size: number, ring: boolean): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};
    border:${ring ? "3px solid #fff" : "2px solid rgba(255,255,255,.85)"};
    box-shadow:0 0 0 1px rgba(0,0,0,.35);cursor:pointer`;
  return el;
}

/**
 * Mapa de situación: dónde está cada localidad y qué sensores la vigilan. Los datos llegan
 * ya resueltos desde el servidor; aquí solo se dibujan.
 */
export function RiskMap({ risks, sensors }: { risks: StationRisk[]; sensors: Sensor[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MlMap({
      container: container.current,
      style: mapStyle(),
      center: [-0.45, 39.42],
      zoom: 9,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.current = m;

    const bounds = new LngLatBounds();

    for (const s of sensors) {
      if (!Number.isFinite(s.station.lat) || !Number.isFinite(s.station.lon)) continue;
      const color = s.last_value === null ? NO_DATA : LEVEL_COLOR[s.level ?? "verde"];
      const html = `<strong>${escape(s.station.name)}</strong><br>
        ${escape(label(VARIABLE_LABEL, s.variable))}: <b>${escape(formatValue(s.last_value, s.unit))}</b><br>
        <small>${escape(s.level ? `nivel ${s.level}` : "sin umbrales oficiales")} · ${escape(ago(s.age_seconds))}</small>`;
      new Marker({ element: dot(color, 11, false) })
        .setLngLat([s.station.lon, s.station.lat])
        .setPopup(new Popup({ offset: 12 }).setHTML(html))
        .addTo(m);
      bounds.extend([s.station.lon, s.station.lat]);
    }

    for (const r of risks) {
      const html = `<strong>${escape(r.station.name)}</strong><br>
        Nivel <b>${escape(r.level)}</b><br>
        <small>${escape(r.components[0]?.detail ?? "sin datos evaluables")}</small>`;
      new Marker({ element: dot(LEVEL_COLOR[r.level], 20, true) })
        .setLngLat([r.station.lon, r.station.lat])
        .setPopup(new Popup({ offset: 16 }).setHTML(html))
        .addTo(m);
      bounds.extend([r.station.lon, r.station.lat]);
    }

    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 0 });

    return () => {
      m.remove();
      map.current = null;
    };
  }, [risks, sensors]);

  return <div className="map" ref={container} role="application" aria-label="Mapa de sensores" />;
}
