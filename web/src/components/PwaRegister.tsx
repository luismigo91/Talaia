"use client";

import { useEffect } from "react";

/** Registra el service worker (offline + push). Silencioso si el navegador no lo soporta. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Al montar, sin esperar a `load`: tras la hidratación ese evento ya ha disparado.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin SW: la app sigue funcionando, solo sin offline ni push */
    });
  }, []);
  return null;
}
