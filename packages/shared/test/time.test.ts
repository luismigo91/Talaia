import { describe, expect, it } from "vitest";
import { formatLocal, localToUtc, parseLocalIso, truncToHour } from "../src/time.js";

describe("formatLocal", () => {
  it("convierte a hora de pared de Madrid en verano (UTC+2)", () => {
    expect(formatLocal(new Date("2026-08-24T00:00:00Z"))).toBe("2026-08-24 02:00");
  });

  it("convierte a hora de pared de Madrid en invierno (UTC+1)", () => {
    expect(formatLocal(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16 00:30");
  });

  it("es el inverso de parseLocalIso", () => {
    const iso = "2026-03-15T07:45:00";
    expect(formatLocal(parseLocalIso(iso))).toBe("2026-03-15 07:45");
  });

  it("acepta otras zonas", () => {
    expect(formatLocal(new Date("2026-08-24T00:00:00Z"), "UTC")).toBe("2026-08-24 00:00");
  });

  it("cruza el cambio horario de octubre sin desfase", () => {
    // 25-10-2026 03:00 CEST → 02:00 CET
    const utc = localToUtc(2026, 10, 25, 1, 30, 0);
    expect(formatLocal(utc)).toBe("2026-10-25 01:30");
    expect(formatLocal(truncToHour(utc))).toBe("2026-10-25 01:00");
  });
});
