import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { OpenMeteoClient } from "../src/client.js";

const body = readFileSync(new URL("../fixtures/forecast-2loc.json", import.meta.url), "utf8");

function fakeFetch(text: string, status = 200) {
  return vi.fn(async () => new Response(text, { status })) as unknown as typeof fetch;
}

describe("OpenMeteoClient", () => {
  it("construye una única petición multi-localización y multi-modelo", async () => {
    const f = fakeFetch(body);
    const c = new OpenMeteoClient({ fetch: f });
    const r = await c.forecast([
      { lat: 39.397, lon: -0.415 },
      { lat: 39.4227, lon: -0.3969 },
    ]);
    expect(f).toHaveBeenCalledTimes(1);
    const url = new URL((f as unknown as { mock: { calls: [string][] } }).mock.calls[0]![0]);
    expect(url.searchParams.get("latitude")).toBe("39.397,39.4227");
    expect(url.searchParams.get("models")).toContain("meteofrance_arome_france_hd");
    expect(url.searchParams.get("wind_speed_unit")).toBe("ms");
    expect(url.searchParams.get("timezone")).toBe("UTC");
    expect(r.data).toHaveLength(2);
  });

  it("falla si el número de localizaciones no coincide", async () => {
    const c = new OpenMeteoClient({ fetch: fakeFetch(body) });
    await expect(c.forecast([{ lat: 1, lon: 1 }])).rejects.toThrow(/se esperaban 1/);
  });

  it("propaga errores HTTP", async () => {
    const c = new OpenMeteoClient({ fetch: fakeFetch("nope", 500) });
    await expect(c.modelMeta("dwd_icon_eu")).rejects.toThrow(/HTTP 500/);
  });
});
