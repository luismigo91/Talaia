import { describe, expect, it } from "vitest";
import { nextAlertChange, type AlertWindow } from "../src/risk-eval.js";

const NOW = new Date("2026-10-01T12:00:00Z");
const ahead = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const win = (level: AlertWindow["level"], onsetH: number, expiresH: number): AlertWindow => ({
  level,
  onset: onsetH < 0 ? ago(-onsetH) : ahead(onsetH),
  expires: ahead(expiresH),
});

describe("nextAlertChange", () => {
  it("anuncia la subida cuando un rojo futuro supera el nivel actual", () => {
    const r = nextAlertChange("amarillo", "verde", [win("rojo", 4, 10)], NOW);
    expect(r).toMatchObject({ level: "rojo", direction: "sube", at: ahead(4) });
  });

  it("anuncia la bajada cuando el rojo vence y queda un naranja vigente", () => {
    const r = nextAlertChange("rojo", "verde", [win("rojo", -2, 2), win("naranja", -1, 10)], NOW);
    expect(r).toMatchObject({ level: "naranja", direction: "baja", at: ahead(2) });
  });

  it("coge el primer cambio aunque después venga otro mayor", () => {
    const r = nextAlertChange(
      "amarillo",
      "verde",
      [win("naranja", 2, 10), win("rojo", 4, 10)],
      NOW,
    );
    expect(r).toMatchObject({ level: "naranja", direction: "sube", at: ahead(2) });
  });

  it("un aviso futuro por debajo del nivel actual no preavisa nada", () => {
    // El naranja vigente dura más allá del horizonte: ni su fin ni el amarillo
    // futuro (que nunca supera al naranja) cambian el nivel a la vista.
    const eterno: AlertWindow = { level: "naranja", onset: ago(1), expires: ahead(100) };
    const r = nextAlertChange("naranja", "verde", [eterno, win("amarillo", 2, 10)], NOW);
    expect(r).toBeNull();
  });

  it("respeta el suelo sin avisos: si el agua ya está en naranja, vencer el amarillo no es cambio", () => {
    const r = nextAlertChange("naranja", "naranja", [win("amarillo", -1, 2)], NOW);
    expect(r).toBeNull();
  });

  it("ignora lo que queda más allá del horizonte", () => {
    expect(nextAlertChange("verde", "verde", [win("rojo", 80, 90)], NOW, 72)).toBeNull();
    expect(nextAlertChange("verde", "verde", [win("rojo", 80, 90)], NOW, 96)).not.toBeNull();
  });

  it("sin ventanas no hay preaviso", () => {
    expect(nextAlertChange("verde", "verde", [], NOW)).toBeNull();
  });
});
