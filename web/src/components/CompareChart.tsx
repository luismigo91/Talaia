import type { Compare } from "@/lib/api";
import { buildScale, colorFor, formatTick, pathOf, type ChartBox } from "@/lib/chart";
import { timeMadrid } from "@/lib/format";

const BOX: ChartBox = {
  width: 900,
  height: 320,
  pad: { top: 16, right: 16, bottom: 34, left: 46 },
};

/** Comparativa entre fuentes en SVG: una línea por fuente, con leyenda nominal. */
export function CompareChart({ data }: { data: Compare }) {
  const scale = buildScale(data.series, data.from, data.to, BOX);
  const baseY = scale.y(0);

  return (
    <>
      <svg
        className="chart"
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Comparativa de ${data.variable} en ${data.station.name}: ${data.series.length} fuentes`}
      >
        {scale.ticks.map((t) => (
          <g key={t.value}>
            <line
              x1={BOX.pad.left}
              x2={BOX.width - BOX.pad.right}
              y1={t.y}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity={0.14}
            />
            <text
              x={BOX.pad.left - 8}
              y={t.y + 4}
              textAnchor="end"
              fontSize="11"
              fill="currentColor"
              opacity={0.65}
            >
              {formatTick(t.value, scale.yMax)}
            </text>
          </g>
        ))}

        {scale.hours.map((h) => (
          <text
            key={h.iso}
            x={h.x}
            y={BOX.height - BOX.pad.bottom + 18}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            opacity={0.65}
          >
            {timeMadrid(h.iso)}
          </text>
        ))}

        <line
          x1={BOX.pad.left}
          x2={BOX.width - BOX.pad.right}
          y1={baseY}
          y2={baseY}
          stroke="currentColor"
          strokeOpacity={0.35}
        />

        {data.series.map((s, i) => (
          <path
            key={s.source}
            d={pathOf(s.points, scale)}
            fill="none"
            stroke={colorFor(i)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <p className="chart-legend">
        {data.series.map((s, i) => (
          <span key={s.source}>
            <span className="swatch" style={{ background: colorFor(i) }} />
            {s.name}
          </span>
        ))}
      </p>
    </>
  );
}
