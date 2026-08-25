import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";

export interface VirtualStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  ine: string | undefined;
  aemetZone: string | undefined;
  primary: boolean;
}

/** Localizaciones objetivo (estaciones virtuales sembradas en `stations`). */
export async function loadVirtualStations(db: Db): Promise<VirtualStation[]> {
  const rows = await db.execute<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    meta: Record<string, unknown>;
  }>(sql`
    select id, name, ST_Y(geom) as lat, ST_X(geom) as lon, meta
    from stations
    where source = 'virtual'
    order by coalesce((meta->>'primary')::boolean, false) desc, id
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    ine: typeof r.meta.ine === "string" ? r.meta.ine : undefined,
    aemetZone: typeof r.meta.aemet_zone === "string" ? r.meta.aemet_zone : undefined,
    primary: r.meta.primary === true,
  }));
}
