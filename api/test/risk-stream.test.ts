import { describe, expect, it, vi } from "vitest";
import { RiskStream } from "../src/risk/risk.stream.js";

describe("RiskStream", () => {
  it("reparte cada cambio a todos los clientes conectados", () => {
    const stream = new RiskStream();
    const a = vi.fn();
    const b = vi.fn();
    stream.subscribe(a);
    stream.subscribe(b);
    stream.emit('{"level":"rojo"}');
    expect(a).toHaveBeenCalledWith('{"level":"rojo"}');
    expect(b).toHaveBeenCalledWith('{"level":"rojo"}');
    expect(stream.clients).toBe(2);
  });

  it("al desuscribirse deja de recibir", () => {
    const stream = new RiskStream();
    const fn = vi.fn();
    const off = stream.subscribe(fn);
    off();
    stream.emit("{}");
    expect(fn).not.toHaveBeenCalled();
    expect(stream.clients).toBe(0);
  });

  it("un cliente que falla no impide que los demás reciban", () => {
    const stream = new RiskStream();
    const roto = vi.fn(() => {
      throw new Error("socket cerrado");
    });
    const sano = vi.fn();
    stream.subscribe(roto);
    stream.subscribe(sano);
    expect(() => stream.emit("{}")).not.toThrow();
    expect(sano).toHaveBeenCalled();
  });
});
