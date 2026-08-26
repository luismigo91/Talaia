import { describe, expect, it, vi } from "vitest";
import { vapidFromEnv } from "../src/webpush.js";

describe("vapidFromEnv", () => {
  it("devuelve las claves cuando están, con subject por defecto", () => {
    const v = vapidFromEnv({
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
    } as NodeJS.ProcessEnv);
    expect(v).toEqual({ publicKey: "pub", privateKey: "priv", subject: "mailto:talaia@localhost" });
  });
  it("respeta VAPID_SUBJECT", () => {
    const v = vapidFromEnv({
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
      VAPID_SUBJECT: "mailto:a@b.c",
    } as NodeJS.ProcessEnv);
    expect(v?.subject).toBe("mailto:a@b.c");
  });
  it("undefined si falta alguna clave", () => {
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "pub" } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(vapidFromEnv({} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});

describe("MultiNotifier", () => {
  it("reparte a todos y un fallo no impide el resto", async () => {
    const { MultiNotifier } = await import("../src/notify.js");
    const a = { send: vi.fn().mockResolvedValue(undefined) };
    const b = { send: vi.fn().mockRejectedValue(new Error("boom")) };
    const c = { send: vi.fn().mockResolvedValue(undefined) };
    const m = new MultiNotifier([a, undefined, b, c]);
    await m.send({
      stationId: "virtual:albal",
      stationName: "Albal",
      level: "rojo",
      previousLevel: "verde",
      direction: "subida",
      reason: null,
    });
    expect(a.send).toHaveBeenCalled();
    expect(b.send).toHaveBeenCalled();
    expect(c.send).toHaveBeenCalled();
  });
});
