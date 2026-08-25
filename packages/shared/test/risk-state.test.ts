import { describe, expect, it, vi } from "vitest";
import { decideTransition, fallConfirmations, type RiskStateRow } from "../src/risk-state.js";
import {
  NtfyNotifier,
  NullNotifier,
  notificationBody,
  notifierFromEnv,
  PRIORITY,
  type RiskNotification,
} from "../src/notify.js";
import type { RiskLevel } from "../src/risk.js";

const state = (
  level: RiskLevel,
  pendingLevel: RiskLevel | null = null,
  pendingCount = 0,
): RiskStateRow => ({
  level,
  since: new Date("2026-08-25T10:00:00Z"),
  pendingLevel,
  pendingCount,
});

describe("decideTransition", () => {
  it("la primera evaluación en verde no genera evento", () => {
    const r = decideTransition("verde", true, null, 3);
    expect(r.transition.kind).toBe("none");
  });

  it("la primera evaluación por encima de verde sí se registra", () => {
    const r = decideTransition("naranja", true, null, 3);
    expect(r.transition).toMatchObject({
      kind: "change",
      level: "naranja",
      previous: null,
      direction: "subida",
    });
  });

  it("una subida se aplica en el acto", () => {
    const r = decideTransition("rojo", true, state("amarillo"), 3);
    expect(r.transition).toMatchObject({ kind: "change", direction: "subida", level: "rojo" });
  });

  it("el mismo nivel no genera nada", () => {
    expect(decideTransition("naranja", true, state("naranja"), 3).transition.kind).toBe("none");
  });

  it("una bajada necesita confirmarse tres veces", () => {
    const first = decideTransition("verde", true, state("naranja"), 3);
    expect(first.transition).toMatchObject({ kind: "hold", reason: "bajada sin confirmar" });
    expect(first.pendingCount).toBe(1);

    const second = decideTransition("verde", true, state("naranja", "verde", 1), 3);
    expect(second.transition.kind).toBe("hold");
    expect(second.pendingCount).toBe(2);

    const third = decideTransition("verde", true, state("naranja", "verde", 2), 3);
    expect(third.transition).toMatchObject({ kind: "change", direction: "bajada", level: "verde" });
    expect(third.pendingCount).toBe(0);
  });

  it("una bajada interrumpida reinicia el contador", () => {
    const back = decideTransition("naranja", true, state("naranja", "verde", 2), 3);
    expect(back.transition.kind).toBe("none");
    expect(back.pendingCount).toBe(0);
  });

  it("una subida durante una bajada pendiente manda y descarta lo pendiente", () => {
    const r = decideTransition("rojo", true, state("naranja", "verde", 2), 3);
    expect(r.transition).toMatchObject({ kind: "change", direction: "subida", level: "rojo" });
    expect(r.pendingLevel).toBeNull();
  });

  it("sin datos evaluables se conserva el nivel: el silencio no es calma", () => {
    const r = decideTransition("verde", false, state("naranja"), 3);
    expect(r.transition).toMatchObject({ kind: "hold", reason: "sin datos" });
    expect(r.pendingCount).toBe(0);
  });

  it("una bajada de dos escalones también se confirma", () => {
    const r = decideTransition("verde", true, state("rojo", "verde", 2), 3);
    expect(r.transition).toMatchObject({ kind: "change", level: "verde", previous: "rojo" });
  });
});

describe("fallConfirmations", () => {
  it("por defecto 3 y respeta el entorno", () => {
    expect(fallConfirmations({} as NodeJS.ProcessEnv)).toBe(3);
    expect(fallConfirmations({ RISK_FALL_CONFIRMATIONS: "5" } as NodeJS.ProcessEnv)).toBe(5);
    expect(fallConfirmations({ RISK_FALL_CONFIRMATIONS: "0" } as NodeJS.ProcessEnv)).toBe(3);
    expect(fallConfirmations({ RISK_FALL_CONFIRMATIONS: "no" } as NodeJS.ProcessEnv)).toBe(3);
  });
});

const notification: RiskNotification = {
  stationId: "virtual:albal",
  stationName: "Albal",
  level: "naranja",
  previousLevel: "verde",
  direction: "subida",
  reason: "80 m³/s ≥ 70 m³/s (naranja) en MC RAMBLA POYO N-III",
};

describe("notificaciones", () => {
  it("el mensaje dice localidad, niveles y por qué", () => {
    const body = notificationBody(notification);
    expect(body).toContain("Albal");
    expect(body).toContain("NARANJA");
    expect(body).toContain("antes verde");
    expect(body).toContain("RAMBLA POYO");
  });

  it("la prioridad sube con el nivel", () => {
    expect(PRIORITY.rojo).toBe("urgent");
    expect(PRIORITY.naranja).toBe("high");
    expect(PRIORITY.verde).toBe("low");
  });

  it("sin NTFY_URL se usa el notificador nulo y no se hace ninguna petición", async () => {
    const n = notifierFromEnv({} as NodeJS.ProcessEnv);
    expect(n).toBeInstanceOf(NullNotifier);
    await expect(n.send(notification)).resolves.toBeUndefined();
  });

  it("con NTFY_URL se hace un POST con título, prioridad y cuerpo", async () => {
    const f = vi.fn(async () => new Response("ok", { status: 200 }));
    const n = new NtfyNotifier({
      url: "https://ntfy.example/talaia",
      fetch: f as unknown as typeof fetch,
    });
    await n.send(notification);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    expect(url).toBe("https://ntfy.example/talaia");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Title).toBe("Albal: NARANJA");
    expect(headers.Priority).toBe("high");
    expect(String(init.body)).toContain("RAMBLA POYO");
  });

  it("añade el token cuando está configurado", async () => {
    const f = vi.fn(async () => new Response("ok", { status: 200 }));
    const n = new NtfyNotifier({
      url: "https://x/t",
      token: "sec",
      fetch: f as unknown as typeof fetch,
    });
    await n.send(notification);
    const init = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sec");
  });

  it("un canal caído lanza, para que quien llama lo registre", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 }));
    const n = new NtfyNotifier({ url: "https://x/t", fetch: f as unknown as typeof fetch });
    await expect(n.send(notification)).rejects.toThrow(/HTTP 500/);
  });
});
