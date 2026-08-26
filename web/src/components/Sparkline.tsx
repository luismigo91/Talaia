import { buildScale, pathOf, type ChartBox } from "@/lib/chart";
import type { ObservationSeries } from "@/lib/api";
import { formatValue, timeMadrid } from "@/lib/format";

const BOX: ChartBox = {
  width: 620,
  height: 130,
  pad: { top: 10, right: 10, bottom: 22, left: 44 },
};

const THRESHOLD_COLOR: Record<string, string> = {
  low: "#c9a227",
  mid: "#d1741f",
  high: "#c0392b",
};

/**
 * Serie observada de un sensor con sus umbrales dibujados: el valor solo dice poco;
 * lo que importa es cuánto le falta para el siguiente escalón.
 */
export function Sparkline({ series }: { series: ObservationSeries }) {
  const points = series.points
    .filter((p): p is { ts: string; value: number; quality: number | null } => p.value !== null)
    .map((p) => ({ ts: p.ts, value: p.value }));
  if (points.length === 0) {
    return <p className="empty">Sin datos en las últimas {series.hours} h.</p>;
  }
  const to = points.at(-1)!.ts;
  const thresholds = Object.entries(series.sensor.thresholds).filter(
    (t): t is [string, number] => typeof t[1] === "number",
  );
  // El eje tiene que llegar al primer umbral aunque el dato esté muy por debajo: si no,
  // una curva plana en el 5 % del umbral parecería alarmante.
  const reference = thresholds.length ? Math.min(...thresholds.map(([, v]) => v)) : 0;
  const scale = buildScale(
    [{ points: [...points, { ts: to, value: reference }] }],
    series.from,
    to,
    BOX,
    3,
  );

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Serie de ${series.sensor.station.name}: último valor ${formatValue(series.summary.last, series.sensor.unit)}`}
    >
      {scale.ticks.map((t) => (
        <g key={t.value}>
          <line
            x1={BOX.pad.left}
            x2={BOX.width - BOX.pad.right}
            y1={t.y}
            y2={t.y}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
          <text
            x={BOX.pad.left - 6}
            y={t.y + 4}
            textAnchor="end"
            fontSize="10"
            fill="currentColor"
            opacity={0.6}
          >
            {t.value.toFixed(t.value < 10 ? 1 : 0).replace(".", ",")}
          </text>
        </g>
      ))}

      {thresholds.map(([key, value]) =>
        value <= scale.yMax ? (
          <line
            key={key}
            x1={BOX.pad.left}
            x2={BOX.width - BOX.pad.right}
            y1={scale.y(value)}
            y2={scale.y(value)}
            stroke={THRESHOLD_COLOR[key]}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        ) : null,
      )}

      {scale.hours.map((h) => (
        <text
          key={h.iso}
          x={h.x}
          y={BOX.height - BOX.pad.bottom + 15}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          opacity={0.6}
        >
          {timeMadrid(h.iso)}
        </text>
      ))}

      <path
        d={pathOf(points, scale)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
