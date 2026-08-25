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

  it("explica por qué está en ese nivel", () => {
    render(<StationCard risk={risk()} />);
    expect(screen.getByText(/RAMBLA POYO/)).toBeDefined();
    expect(screen.getByText("Caudal")).toBeDefined();
  });

  it("sin datos evaluables lo dice, en vez de aparentar calma", () => {
    render(<StationCard risk={risk({ level: "verde", components: [] })} />);
    expect(screen.getByText(/no significa que no haya riesgo/)).toBeDefined();
  });

  it("las advertencias de frescura se ven, no se esconden", () => {
    render(
      <StationCard
        risk={risk({ warnings: ["dato obsoleto de MC RAMBLA POYO N-III (saih:13873): 45 min"] })}
      />,
    );
    expect(screen.getByText(/dato obsoleto/)).toBeDefined();
    expect(screen.getByText(/frescura de los datos/i)).toBeDefined();
  });

  it("muestra los avisos vigentes de la zona", () => {
    render(
      <StationCard
        risk={risk({
          alerts: [
            {
              id: "x",
              source: "meteoalarm",
              level: "amarillo",
              event: "Aviso de lluvias de nivel amarillo",
              event_code: "PR",
              expires: "2026-08-26T00:00:00Z",
              counts: true,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Aviso de lluvias/)).toBeDefined();
  });

  it("indica la hora de cálculo en local", () => {
    render(<StationCard risk={risk()} />);
    expect(screen.getByText(/Calculado a las 20:00/)).toBeDefined();
  });
});
