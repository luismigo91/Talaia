import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await fetch(`${API_URL}/api/v1/push/key`, { cache: "no-store" });
    return new Response(await r.text(), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "sin conexión con la API" }, { status: 502 });
  }
}
