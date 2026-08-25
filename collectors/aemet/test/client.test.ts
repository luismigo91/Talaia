import { describe, expect, it, vi } from "vitest";
import iconv from "iconv-lite";
import { AemetClient, AemetError, decodeBody, resolveApiKey } from "../src/client.js";

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const makeFetch = (h: Handler) => vi.fn(h) as unknown as typeof fetch;
const step1 = (datos = "https://opendata.aemet.es/opendata/sh/abc") =>
  new Response(JSON.stringify({ descripcion: "exito", estado: 200, datos, metadatos: "x" }), {
    status: 200,
    headers: { "content-type": "text/plain; charset=UTF-8" },
  });

describe("AemetClient", () => {
  it("dos pasos: envía api_key en el primero y decodifica ISO-8859-15 en el segundo", async () => {
    const latin = iconv.encode(
      '[{"nombre":"Predicción","elaborado":"2026-08-25T10:00:00"}]',
      "ISO-8859-15",
    );
    const f = makeFetch((url, init) => {
      if (url.includes("/api/")) {
        expect((init?.headers as Record<string, string>).api_key).toBe("KEY");
        return step1();
      }
      expect((init?.headers as Record<string, string>).api_key).toBeUndefined();
      return new Response(latin, {
        status: 200,
        headers: { "content-type": "text/plain;charset=ISO-8859-15" },
      });
    });
    const c = new AemetClient({ apiKey: "KEY", fetch: f, minIntervalMs: 0 });
    const text = await c.getText("/api/prediccion/especifica/municipio/horaria/46007");
    expect(text).toContain("Predicción");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("estado != 200 en el primer paso → AemetError con estado", async () => {
    const f = makeFetch(
      () =>
        new Response(JSON.stringify({ descripcion: "Not Found", estado: 404 }), { status: 200 }),
    );
    const c = new AemetClient({ apiKey: "KEY", fetch: f, minIntervalMs: 0 });
    await expect(c.getText("/x")).rejects.toMatchObject({ name: "AemetError", estado: 404 });
  });

  it("cuerpo vacío con HTTP 200 → AemetError", async () => {
    const f = makeFetch(() => new Response("", { status: 200 }));
    const c = new AemetClient({ apiKey: "KEY", fetch: f, minIntervalMs: 0 });
    await expect(c.getText("/x")).rejects.toBeInstanceOf(AemetError);
  });

  it("429: espera y reintenta una sola vez", async () => {
    let calls = 0;
    const f = makeFetch((url) => {
      calls++;
      if (url.includes("/api/")) return calls === 1 ? new Response("", { status: 429 }) : step1();
      return new Response("ok", { status: 200 });
    });
    const sleep = vi.fn(async () => {});
    const c = new AemetClient({
      apiKey: "KEY",
      fetch: f,
      minIntervalMs: 0,
      retryAfterMs: 61_000,
      sleep,
    });
    await expect(c.getText("/api/x")).resolves.toBe("ok");
    expect(sleep).toHaveBeenCalledWith(61_000);
    expect(calls).toBe(3);
  });

  it("429 persistente → AemetError 429 sin más reintentos", async () => {
    let calls = 0;
    const f = makeFetch(() => {
      calls++;
      return new Response("", { status: 429 });
    });
    const c = new AemetClient({ apiKey: "KEY", fetch: f, minIntervalMs: 0, sleep: async () => {} });
    await expect(c.getText("/api/x")).rejects.toMatchObject({ estado: 429 });
    expect(calls).toBe(2);
  });

  it("limitador: 5 peticiones consecutivas se espacian al menos minIntervalMs", async () => {
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      waits.push(ms);
    });
    const f = makeFetch((url) =>
      url.includes("/api/") ? step1() : new Response("ok", { status: 200 }),
    );
    const c = new AemetClient({ apiKey: "KEY", fetch: f, minIntervalMs: 1500, sleep });
    // 3 getText = 6 peticiones HTTP → 5 esperas (la primera no espera)
    await Promise.all([c.getText("/api/a"), c.getText("/api/b"), c.getText("/api/c")]);
    expect(waits.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...waits)).toBeGreaterThan(0);
    expect(Math.max(...waits)).toBeLessThanOrEqual(1500);
  });

  it("sin clave → AemetError al construir", () => {
    expect(() => new AemetClient({ apiKey: "", fetch: makeFetch(() => step1()) })).toThrow(/clave/);
  });

  it("resolveApiKey prefiere el fichero y cae a la variable", () => {
    expect(resolveApiKey({ AEMET_API_KEY_FILE: "/no/existe", AEMET_API_KEY: " k " })).toBe("k");
    expect(resolveApiKey({})).toBeUndefined();
  });

  it("decodeBody usa el charset del header y latin-9 por defecto", () => {
    const bytes = iconv.encode("Ñandú", "ISO-8859-15");
    expect(decodeBody(bytes, null)).toBe("Ñandú");
    expect(decodeBody(Buffer.from("Ñandú", "utf8"), "application/json; charset=UTF-8")).toBe(
      "Ñandú",
    );
  });
});
