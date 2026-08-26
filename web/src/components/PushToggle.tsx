"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "working";

/** base64url (VAPID) → Uint8Array, como exige PushManager.subscribe. */
function urlB64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // ArrayBuffer explícito: applicationServerKey exige BufferSource, no ArrayBufferLike.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Activa/desactiva las notificaciones de cambio de nivel (Web Push). */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const { key } = (await (await fetch("/api/push/key")).json()) as { key?: string };
      if (!key) throw new Error("sin clave");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <p className="push-hint">
        Los avisos están bloqueados en el navegador. Actívalos en los permisos del sitio si los
        quieres.
      </p>
    );
  }

  const on = state === "on";
  return (
    <button
      type="button"
      className="push-btn"
      data-on={on}
      disabled={state === "working"}
      onClick={on ? disable : enable}
    >
      {state === "working" ? "…" : on ? "🔔 Avisos activados" : "🔕 Activar avisos de nivel"}
    </button>
  );
}
