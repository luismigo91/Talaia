import { describe, expect, it } from "vitest";
import {
  buildScale,
  colorFor,
  formatTick,
  niceMax,
  pathOf,
  SERIES_COLORS,
  type ChartBox,
} from "../src/lib/chart.js";

const BOX: ChartBox = {
  width: 900,
  height: 320,
  pad: { top: 16, right: 16, bottom: 34, left: 46 },
};
const FROM = "2026-08-25T00:00:00Z";
const TO = "2026-08-26T00:00:00Z";

describe("niceMax", () => {
  it("redondea el techo a una cifra legible", () => {
    expect(niceMax(0.7)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(12)).toBe(20);
    expect(niceMax(190)).toBe(200);
  });

  it("nunca devuelve cero, para no dividir por cero al escalar", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });
});

describe("buildScale", () => {
  const series = [
    {
      points: [
        { ts: FROM, value: 0 },
        { ts: TO, value: 8 },
      ],
    },
  ];
  const scale = buildScale(series, FROM, TO, BOX);

  it("el inicio y el fin de la ventana caen en los bordes del área de dibujo", () => {
    expect(scale.x(FROM)).toBeCloseTo(BOX.pad.left, 5);
    expect(scale.x(TO)).toBeCloseTo(BOX.width - BOX.pad.right, 5);
  });

  it("el cero queda en la base y el máximo en el techo", () => {
    expect(scale.y(0)).toBeCloseTo(BOX.height - BOX.pad.bottom, 5);
    expect(scale.y(scale.yMax)).toBeCloseTo(BOX.pad.top, 5);
  });

  it("el eje vertical empieza en cero: una comparativa de lluvia no se trunca", () => {
    expect(scale.ticks[0]!.value).toBe(0);
    expect(scale.ticks.at(-1)!.value).toBe(scale.yMax);
  });

  it("rotula horas dentro de la ventana", () => {
    expect(scale.hours.length).toBeGreaterThan(2);
    for (const h of scale.hours) {
      expect(h.x).toBeGreaterThanOrEqual(BOX.pad.left - 0.001);
      expect(h.x).toBeLessThanOrEqual(BOX.width - BOX.pad.right + 0.001);
    }
  });

  it("sin datos sigue produciendo una escala usable", () => {
    const s = buildScale([], FROM, TO, BOX);
    expect(s.yMax).toBe(1);
    expect(Number.isFinite(s.y(0))).toBe(true);
  });
});

describe("pathOf", () => {
  const scale = buildScale([{ points: [{ ts: FROM, value: 10 }] }], FROM, TO, BOX);

  it("genera una ruta que empieza con M y encadena L", () => {
    const d = pathOf(
      [
        { ts: FROM, value: 0 },
        { ts: TO, value: 10 },
      ],
      scale,
    );
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("L");
  });

  it("sin puntos devuelve una ruta vacía, no NaN", () => {
    expect(pathOf([], scale)).toBe("");
  });
});

describe("colorFor", () => {
  it("da colores distintos a series distintas y no se queda sin", () => {
    expect(colorFor(0)).not.toBe(colorFor(1));
    expect(colorFor(SERIES_COLORS.length)).toBe(colorFor(0));
    expect(colorFor(99)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});


describe("marcas del eje X según la ventana", () => {
  it("una ventana de 24 h no amontona marcas (<= 9)", () => {
    const scale = buildScale([{ points: [{ ts: FROM, value: 1 }] }], FROM, TO, BOX);
    expect(scale.longSpan).toBe(false);
    expect(scale.hours.length).toBeLessThanOrEqual(9);
  });

  it("una ventana de 7 días pasa a marcas diarias y se rotula por día", () => {
    const to = "2026-09-01T00:00:00Z";
    const scale = buildScale([{ points: [{ ts: FROM, value: 1 }] }], FROM, to, BOX);
    expect(scale.longSpan).toBe(true);
    expect(scale.hours.length).toBeLessThanOrEqual(8);
  });
});

describe("formatTick", () => {
  it("no repite etiquetas cuando el techo es pequeño", () => {
    expect(formatTick(0.1, 1)).toBe("0,10");
    expect(formatTick(0.2, 1)).toBe("0,20");
    expect(formatTick(0.1, 1)).not.toBe(formatTick(0.2, 1));
  });
  it("sin decimales cuando el techo es grande", () => {
    expect(formatTick(50, 100)).toBe("50");
  });
});
