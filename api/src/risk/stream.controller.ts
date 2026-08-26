import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { ServerResponse } from "node:http";
import { RiskStream } from "./risk.stream.js";

/** Comentario periódico para que ningún proxy dé la conexión por muerta. */
const HEARTBEAT_MS = 25_000;

/** Fastify expone la respuesta de Node en `raw`; no hace falta tipar todo Fastify para esto. */
interface RawReply {
  raw: ServerResponse;
}

@Controller("api/v1/risk/stream")
export class RiskStreamController {
  constructor(@Inject(RiskStream) private readonly risk: RiskStream) {}

  /** Server-Sent Events: un evento `risk` por cada cambio de nivel. */
  @Get()
  subscribe(@Res() reply: RawReply) {
    const res = reply.raw;
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write("retry: 10000\n\n");
    res.write(": conectado\n\n");

    const unsubscribe = this.risk.subscribe((payload) =>
      res.write(`event: risk\ndata: ${payload}\n\n`),
    );
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    };
    res.on("close", close);
    res.on("error", close);
  }
}
