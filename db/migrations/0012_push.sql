-- Suscripciones de Web Push (navegadores que han activado los avisos del semáforo).
-- La clave es el endpoint que da el navegador; p256dh/auth cifran el mensaje.
create table push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  last_error  text
);
