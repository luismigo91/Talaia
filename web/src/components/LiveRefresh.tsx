"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca la página cuando el semáforo cambia de nivel.
 *
 * El dato de fondo se mueve cada 5–10 minutos, así que no tiene sentido sondear: la API avisa
 * por SSE cuando hay un cambio real, y aquí solo se pide a Next que vuelva a renderizar.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/risk-stream");
    const onRisk = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as { station?: string; level?: string };
        setLast(
          data.station && data.level ? `${data.station} pasó a ${data.level}` : "nivel actualizado",
        );
      } catch {
        setLast("nivel actualizado");
      }
      router.refresh();
    };
    source.addEventListener("risk", onRisk as EventListener);
    return () => {
      source.removeEventListener("risk", onRisk as EventListener);
      source.close();
    };
  }, [router]);

  if (!last) return null;
  return (
    <p className="empty" role="status" aria-live="polite">
      Actualizado en directo: {last}.
    </p>
  );
}
