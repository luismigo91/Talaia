export interface Point {
  ts: string;
  value: number;
}

export interface Scale {
  x: (iso: string) => number;
  y: (value: number) => number;
  yMax: number;
  ticks: { y: number; value: number }[];
  hours: { x: number; iso: string }[];
}

export interface ChartBox {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

/** Redondea el techo del eje a un valor "de cifra bonita" para que los rótulos se lean. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= base * step) return base * step;
  }
  return base * 10;
}

/**
 * Escalas del gráfico. Se calculan aquí (y no en el componente) para poder probarlas:
 * un eje mal escalado hace mentir a la comparativa entera.
 */
export function buildScale(
  series: { points: Point[] }[],
  from: string,
  to: string,
  box: ChartBox,
  tickCount = 4,
): Scale {
  const t0 = new Date(from).getTime();
  const t1 = new Date(to).getTime();
  const span = Math.max(t1 - t0, 1);
  const innerW = box.width - box.pad.left - box.pad.right;
  const innerH = box.height - box.pad.top - box.pad.bottom;

  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const yMax = niceMax(values.length ? Math.max(...values) : 1);

  const x = (iso: string) => box.pad.left + ((new Date(iso).getTime() - t0) / span) * innerW;
  const y = (value: number) => box.pad.top + innerH - (value / yMax) * innerH;

  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = (yMax / tickCount) * i;
    return { value, y: y(value) };
  });

  const hours: { x: number; iso: string }[] = [];
  const stepH = span / 3.6e6 > 12 ? 6 : 3;
  for (let t = ceilToHour(t0, stepH); t <= t1; t += stepH * 3.6e6) {
    hours.push({ x: x(new Date(t).toISOString()), iso: new Date(t).toISOString() });
  }
  return { x, y, yMax, ticks, hours };
}

function ceilToHour(t: number, stepH: number): number {
  const step = stepH * 3.6e6;
  return Math.ceil(t / step) * step;
}

/** Ruta SVG de una serie; devuelve "" si no hay puntos. */
export function pathOf(points: Point[], scale: Scale): string {
  if (points.length === 0) return "";
  return points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${scale.x(p.ts).toFixed(1)},${scale.y(p.value).toFixed(1)}`,
    )
    .join(" ");
}

/**
 * Paleta categórica de la comparativa. Colores distinguibles entre sí y sobre ambos temas;
 * el gráfico lleva además leyenda con el nombre de cada fuente, no solo color.
 */
export const SERIES_COLORS = [
  "#1d6fa5",
  "#d1741f",
  "#2f8f4e",
  "#8e44ad",
  "#c0392b",
  "#0e8b8b",
  "#7f8c3a",
  "#b03a72",
];

export const colorFor = (index: number) => SERIES_COLORS[index % SERIES_COLORS.length]!;
