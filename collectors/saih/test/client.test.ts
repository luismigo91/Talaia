import { describe, expect, it, vi } from "vitest";
import { SaihClient, SaihError } from "../src/client.js";

const ok = (body: string) => new Response(body, { status: 200 });
const calls = (f: unknown) => (f as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);

describe("SaihClient", () => {
  it("formatea el rango en hora local de Madrid (verano, UTC+2)", () => {
    const c = new SaihClient();
    const url = c.valuesUrl(
      "13873",
      new Date("2026-08-24T00:00:00Z"),
      new Date("2026-08-24T02:00:00Z"),
    );
    expect(url).toBe(
      "https://saih.chj.es/admin/variables/valor/13873/2026-08-24%2002%3A00/2026-08-24%2004%3A00",
    );
  });

  it("formatea el rango en hora local de Madrid (invierno, UTC+1)", () => {
    const c = new SaihClient();
    const url = c.valuesUrl(
      "13873",
      new Date("2026-01-15T23:30:00Z"),
      new Date("2026-01-16T00:30:00Z"),
    );
    expect(url).toContain("2026-01-16%2000%3A30/2026-01-16%2001%3A30");
  });

  it("reintenta una sola vez ante 5xx", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(ok("[]"));
    const c = new SaihClient({ fetch: f as unknown as typeof fetch, sleep: async () => {} });
    await expect(c.values("1", new Date(0), new Date(1))).resolves.toEqual([]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("no reintenta ante 4xx", async () => {
    const f = vi.fn(async () => new Response("no", { status: 404 }));
    const c = new SaihClient({ fetch: f as unknown as typeof fetch, sleep: async () => {} });
    await expect(c.values("1", new Date(0), new Date(1))).rejects.toThrow(SaihError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("rechaza una respuesta que no sea un array de muestras", async () => {
    const f = vi.fn(async () => ok('{"error":"nope"}'));
    const c = new SaihClient({ fetch: f as unknown as typeof fetch, sleep: async () => {} });
    await expect(c.values("1", new Date(0), new Date(1))).rejects.toThrow(/array/);
  });

  it("envía un user-agent identificable", async () => {
    const f = vi.fn(async () => ok("[]"));
    const c = new SaihClient({ fetch: f as unknown as typeof fetch, sleep: async () => {} });
    await c.values("13873", new Date(0), new Date(1));
    const init = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect((init.headers as Record<string, string>)["user-agent"]).toMatch(/talaia/);
    expect(calls(f)[0]).toContain("/admin/variables/valor/13873/");
  });
});
