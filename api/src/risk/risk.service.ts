import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { evaluateRisk, type Db, type StationRisk } from "@talaia/shared";
import { DB } from "../db/db.module.js";

/**
 * Envoltorio delgado sobre `evaluateRisk` del paquete compartido: el cálculo vive en un solo
 * sitio para que el scheduler (que notifica) y la API (que muestra) no puedan divergir.
 */
@Injectable()
export class RiskService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async risk(opts: { station?: string; now?: Date } = {}): Promise<StationRisk[]> {
    const stations = await evaluateRisk(this.db, opts);
    if (stations.length === 0) {
      throw new NotFoundException(`estación desconocida: ${opts.station ?? "(ninguna)"}`);
    }
    return stations;
  }
}
