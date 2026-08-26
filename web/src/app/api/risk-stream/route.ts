import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Reenvía el stream de cambios de nivel de la API al navegador.
 *
 * Existe para no romper la regla que sostiene el despliegue: el navegador solo habla con el
 * frontend, y la API sigue siendo interna. Aquí solo se hace de tubería, sin transformar nada.
 */
export async function GET(request: Request): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/risk/stream`, {
      headers: { accept: "text/event-stream" },
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    // La API no está disponible: se responde un stream vacío en lugar de un error, para que
    // el navegador reintente solo con su propio `retry`.
    return new Response(": sin conexión con la API\n\n", {
      status: 200,
      headers: sseHeaders(),
    });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(`: la API respondió ${upstream.status}\n\n`, {
      status: 200,
      headers: sseHeaders(),
    });
  }
  return new Response(upstream.body, { status: 200, headers: sseHeaders() });
}

const sseHeaders = () => ({
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
});
