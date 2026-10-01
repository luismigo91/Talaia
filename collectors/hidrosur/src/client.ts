/** Cliente del visor SAIH Hidrosur (Junta de Andalucía): HTML sin clave ni cuota. */
export const BASE_URL = "https://www.redhidrosurmedioambiente.es/saih";

export class HidrosurClient {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;

  constructor(opts: { fetch?: typeof fetch; base?: string } = {}) {
    this.fetchFn = opts.fetch ?? fetch;
    this.base = opts.base ?? BASE_URL;
  }

  private async get(path: string): Promise<string> {
    const res = await this.fetchFn(this.base + path);
    if (!res.ok) throw new Error(`hidrosur: ${path} devolvió ${res.status}`);
    return res.text();
  }

  /** Tabla de última hora de ríos (nivel + caudal) con enlaces a cada gráfica. */
  resumenRios(): Promise<string> {
    return this.get("/resumen/rios");
  }

  /** Tabla de última hora de embalses (% + hm³) con enlaces a cada gráfica. */
  resumenEmbalses(): Promise<string> {
    return this.get("/resumen/embalses");
  }

  /** Histórico horario de 48 h de una estación (`038R03`, `022P01`, `020E01`…). */
  grafica(code: string): Promise<string> {
    return this.get(`/mapa/tiempo/real/grafica/${code}`);
  }
}
