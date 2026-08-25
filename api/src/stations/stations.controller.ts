import { Controller, Get, Inject } from "@nestjs/common";
import { loadVirtualStations, type Db } from "@talaia/shared";
import { DB } from "../db/db.module.js";

@Controller("api/v1/stations")
export class StationsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Localizaciones objetivo (estaciones virtuales). */
  @Get()
  async list() {
    const stations = await loadVirtualStations(this.db);
    return {
      stations: stations.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        ine: s.ine ?? null,
        aemet_zone: s.aemetZone ?? null,
        primary: s.primary,
      })),
    };
  }
}
