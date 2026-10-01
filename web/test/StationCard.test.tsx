import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StationCard } from "../src/components/StationCard.js";
import type { StationRisk } from "../src/lib/api.js";

afterEach(cleanup);

const risk = (over: Partial<StationRisk> = {}): StationRisk => ({
  station: { id: "virtual:albal", name: "Albal", lat: 39.397, lon: -0.415, primary: true },
  level: "naranja",
  components: [
    {
      kind: "flow",
      level: "naranja",
      value: 80,
      unit: "m³/s",
      threshold: 70,
      source: "saih:13873",
      detail: "80 m³/s ≥ 70 m³/s (naranja) en MC RAMBLA POYO N-III",
    },
  ],
  alerts: [],
  upcoming_alerts: [],
  next_change: null,
  warnings: [],
  stale: false,
  computed_at: "2026-08-25T18:00:00Z",
  ...over,
});

describe("StationCard", () => {
  it("el nivel se lee en texto, no solo por color", () => {
    render(<StationCard risk={risk()} />);
    expect(screen.getAllByText("naranja").length).toBeGreaterThan(0);
  });

  it("muestra la señal que manda (el titular)", () => {
    render(<StationCard risk={risk()} />);
    expect(screen.getByText(/RAMBLA POYO/)).toBeDefined();
    // enlace al desglose completo
    expect(screen.getByText(/ver desglose/)).toBeDefined();
  });

  it("sin datos evaluables lo dice, en vez de aparentar calma", () => {
    render(<StationCard risk={risk({ level: "verde", components: [] })} />);
    expect(screen.getByText(/no significa que no haya riesgo/)).toBeDefined();
  });

  it("avisa de datos sin actualizar de forma compacta", () => {
    render(
      <StationCard
        risk={risk({ warnings: ["dato obsoleto de MC RAMBLA POYO N-III (saih:13873): 45 min"] })}
      />,
    );
    expect(screen.getByText(/dato sin actualizar/)).toBeDefined();
  });

  it("solo muestra lo que manda, no todas las señales (el desglose vive en el detalle)", () => {
    render(
      <StationCard
        risk={risk({
          components: [
            {
              kind: "flow",
              level: "naranja",
              value: 80,
              unit: "m³/s",
              threshold: 70,
              source: "saih:13873",
              detail: "80 m³/s ≥ 70 m³/s (naranja) en MC RAMBLA POYO N-III",
            },
            {
              kind: "rain_forecast",
              level: "amarillo",
              value: 40,
              unit: "mm",
              threshold: 20,
              source: "3 fuentes",
              detail: "mediana de 40 mm en 24 h entre 3 fuentes",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/RAMBLA POYO/)).toBeDefined();
    expect(screen.queryByText(/mediana de 40 mm/)).toBeNull();
  });

  it("indica la hora de cálculo en local, en el pie", () => {
    render(<StationCard risk={risk()} />);
    expect(screen.getByText("20:00")).toBeDefined();
  });

  it("muestra el preaviso de escalada con hora local, sin tocar el nivel", () => {
    render(
      <StationCard
        risk={risk({
          next_change: {
            at: "2026-10-01T16:00:00Z",
            level: "rojo",
            direction: "sube",
            reason: "aviso oficial",
          },
        })}
      />,
    );
    expect(screen.getByText(/Próximo/)).toBeDefined();
    expect(screen.getByText(/01\/10 18:00/)).toBeDefined();
  });
});
