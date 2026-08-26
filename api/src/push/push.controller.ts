import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { vapidFromEnv, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

type SubBody = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

@Controller("api/v1/push")
export class PushController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Clave pública VAPID para que el navegador pueda suscribirse. 404 si no está configurada. */
  @Get("key")
  key() {
    const vapid = vapidFromEnv();
    if (!vapid)
      throw new BadRequestException("Web Push no está configurado (falta VAPID_PUBLIC_KEY)");
    return { key: vapid.publicKey };
  }

  @Post("subscribe")
  async subscribe(@Body() body: SubBody) {
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
    const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : null;
    const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : null;
    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException("suscripción inválida");
    }
    await this.db.execute(sql`
      insert into push_subscriptions (endpoint, p256dh, auth)
      values (${endpoint}, ${p256dh}, ${auth})
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
    `);
    return { ok: true };
  }

  @Post("unsubscribe")
  async unsubscribe(@Body() body: SubBody) {
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
    if (!endpoint) throw new BadRequestException("falta endpoint");
    await this.db.execute(sql`delete from push_subscriptions where endpoint = ${endpoint}`);
    return { ok: true };
  }
}
