import webpush from "web-push";
import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { logger } from "./logger.js";
import {
  notificationBody,
  notificationTitle,
  type Notifier,
  type RiskNotification,
} from "./notify.js";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Lee las claves VAPID del entorno; sin ellas, no hay Web Push. */
export function vapidFromEnv(env: NodeJS.ProcessEnv = process.env): VapidKeys | undefined {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return undefined;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || "mailto:talaia@localhost" };
}

/**
 * Envía el cambio de nivel por Web Push a todos los navegadores suscritos. Las suscripciones
 * caducadas (410/404) se borran solas: un navegador que ya no existe no debe acumular errores.
 */
export class WebPushNotifier implements Notifier {
  constructor(
    private readonly db: Db,
    keys: VapidKeys,
  ) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  }

  async send(n: RiskNotification): Promise<void> {
    const subs = await this.db.execute<{ endpoint: string; p256dh: string; auth: string }>(
      sql`select endpoint, p256dh, auth from push_subscriptions`,
    );
    if (subs.length === 0) return;
    const payload = JSON.stringify({
      title: notificationTitle(n),
      body: notificationBody(n),
      url: `/l/${encodeURIComponent(n.stationId)}`,
      tag: `talaia-${n.stationId}`,
      level: n.level,
    });
    let sent = 0;
    let gone = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await this.db.execute(sql`delete from push_subscriptions where endpoint = ${s.endpoint}`);
          gone++;
        } else {
          logger.warn({ err: String(err), endpoint: s.endpoint.slice(0, 40) }, "web-push falló");
        }
      }
    }
    logger.info({ sent, gone, total: subs.length }, "web-push: avisos enviados");
  }
}
