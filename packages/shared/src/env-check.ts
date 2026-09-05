import { logger } from "./logger.js";

/** Avisa en log de lo que falta para tener el sistema completo, sin abortar. */
export function checkEnv(): string[] {
  const warnings: string[] = [];
  const aemetDisabled = process.env.AEMET_ENABLED?.trim().toLowerCase() === "false";
  if (aemetDisabled) {
    warnings.push("AEMET deshabilitado por AEMET_ENABLED=false — predicción/avisos/observación AEMET omitidos (cubiertos por Open-Meteo/Meteoalarm/SAIH)");
  } else if (!process.env.AEMET_API_KEY) {
    warnings.push("AEMET_API_KEY no configurada: predicción municipal y observación AEMET desactivadas (pon AEMET_ENABLED=false si OpenData está retirado)");
  }
  if (!process.env.POSTGRES_PASSWORD && !process.env.DATABASE_URL) {
    warnings.push("POSTGRES_PASSWORD/DATABASE_URL no configurada: usa .env o variable en Dokploy");
  }
  if (!process.env.NTFY_URL) {
    warnings.push("NTFY_URL no configurada: transiciones de semáforo solo se registran, no se notifican por ntfy");
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    warnings.push("VAPID_* no configuradas: Web Push desactivado (ntfy sigue funcionando)");
  }
  for (const w of warnings) logger.warn(w);
  return warnings;
}
