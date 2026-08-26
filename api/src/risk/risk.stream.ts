import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { listenRiskChanges } from "@talaia/shared";

export type RiskChangeListener = (payload: string) => void;

/**
 * Reparte a los clientes conectados los cambios de nivel que publica el ciclo de riesgo.
 * Una sola escucha para todo el proceso, por muchos navegadores que haya abiertos.
 */
@Injectable()
export class RiskStream implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RiskStream.name);
  private readonly listeners = new Set<RiskChangeListener>();
  private stop: (() => Promise<void>) | undefined;

  async onModuleInit() {
    try {
      this.stop = await listenRiskChanges((payload) => this.emit(payload));
    } catch (err) {
      // Sin escucha el stream sigue mandando latidos: la página no se rompe, solo deja de
      // enterarse en el acto.
      this.log.error(`no se pudo escuchar los cambios de nivel: ${String(err)}`);
    }
  }

  async onModuleDestroy() {
    this.listeners.clear();
    await this.stop?.();
  }

  subscribe(fn: RiskChangeListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  emit(payload: string) {
    for (const fn of this.listeners) {
      try {
        fn(payload);
      } catch (err) {
        this.log.warn(`cliente descartado: ${String(err)}`);
      }
    }
  }

  get clients(): number {
    return this.listeners.size;
  }
}
