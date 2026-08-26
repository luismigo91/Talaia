export interface Sample {
  value: number;
  ts: Date;
}

export interface PlausibleResult {
  /** Última muestra que se considera creíble, o `undefined` si no hay ninguna. */
  sample: Sample | undefined;
  /** Muestras descartadas por implausibles. */
  discarded: number;
}

/**
 * Elige la última lectura creíble de una serie de caudal o nivel.
 *
 * El histórico del SAIH tiene escalones imposibles: el Poyo pasa de 0,1 a 855 m³/s en cinco
 * minutos, se sostiene media hora y vuelve a cero. Físicamente no ocurre —implicaría 1,3 hm³
 * apareciendo y desapareciendo— y la CHJ los marca como buenos, así que el semáforo se los
 * creía: cinco rojos en año y medio sin una gota de lluvia.
 *
 * La regla distingue el artefacto de la crecida por **cómo llega**, no por cuánto vale:
 *
 * - Una crecida real sube por rampa. En la DANA del 29-10-2024, la peor conocida, el Poyo
 *   ganó unos 65 m³/s cada cinco minutos: nunca daría un salto de 250.
 * - Un escalón mayor que `maxJump` se pone en cuarentena. Si se mantiene `sustainedSamples`
 *   seguidas (una hora), se acepta: será un cambio real, brusco pero sostenido —una suelta de
 *   embalse, por ejemplo—. Si vuelve antes, era ruido y no ha contado nunca.
 */
export function lastPlausible(
  samples: Sample[],
  opts: { maxJump: number; sustainedSamples?: number },
): PlausibleResult {
  const sustained = opts.sustainedSamples ?? 12;
  const ordered = [...samples].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  let baseline: Sample | undefined;
  let quarantine: Sample[] = [];
  let discarded = 0;

  for (const sample of ordered) {
    if (!baseline) {
      baseline = sample;
      continue;
    }
    const reference = quarantine.length > 0 ? quarantine[quarantine.length - 1]! : baseline;
    const jumpsFromBaseline = Math.abs(sample.value - baseline.value) > opts.maxJump;
    const closeToQuarantine =
      quarantine.length > 0 && Math.abs(sample.value - reference.value) <= opts.maxJump;

    if (jumpsFromBaseline && (quarantine.length === 0 || closeToQuarantine)) {
      // Sigue lejos de lo último creíble: en cuarentena hasta que se sostenga.
      quarantine.push(sample);
      if (quarantine.length >= sustained) {
        baseline = sample;
        quarantine = [];
      }
      continue;
    }
    // Vuelve a un valor coherente con la referencia creíble: lo que hubiera en cuarentena era ruido.
    discarded += quarantine.length;
    quarantine = [];
    baseline = sample;
  }
  discarded += quarantine.length;
  return { sample: baseline, discarded };
}
