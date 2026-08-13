import { buildPortfolioSeries, type HoldingSnapshot } from "./portfolioSeries";

const START = new Date("2026-08-01");
const NOW = new Date("2026-08-10");

describe("buildPortfolioSeries", () => {
  it("devuelve [] si ningún holding tiene al menos 2 puntos de historial en la ventana", () => {
    const holdings: HoldingSnapshot[] = [
      { id: "a", quantity: 10, fallbackPrice: 100, history: [] },
      {
        id: "b",
        quantity: 5,
        fallbackPrice: 50,
        history: [{ price: 50, recorded_at: "2026-08-05" }],
      },
    ];
    expect(buildPortfolioSeries(holdings, START, NOW)).toEqual([]);
  });

  it("construye la serie con forward-fill por holding y suma quantity*price en cada fecha real", () => {
    const holdings: HoldingSnapshot[] = [
      {
        id: "fci",
        quantity: 10,
        fallbackPrice: 120,
        history: [
          { price: 100, recorded_at: "2026-08-03" },
          { price: 120, recorded_at: "2026-08-08" },
        ],
      },
    ];
    const series = buildPortfolioSeries(holdings, START, NOW);
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.value]));
    // Antes del primer punto real, no hay entrada en 2026-08-03 previa -> el
    // start (08-01) usa fallbackPrice (documentado como aproximación).
    expect(byDate["2026-08-01"]).toBeCloseTo(1200, 6);
    expect(byDate["2026-08-03"]).toBeCloseTo(1000, 6);
    expect(byDate["2026-08-08"]).toBeCloseTo(1200, 6);
    // "now" (08-10) hereda el último precio conocido (forward-fill).
    expect(byDate["2026-08-10"]).toBeCloseTo(1200, 6);
  });

  it("un holding sin historial propio aporta su fallbackPrice constante en todas las fechas", () => {
    const holdings: HoldingSnapshot[] = [
      {
        id: "fci",
        quantity: 1,
        fallbackPrice: 100,
        history: [
          { price: 100, recorded_at: "2026-08-02" },
          { price: 200, recorded_at: "2026-08-06" },
        ],
      },
      { id: "manual", quantity: 2, fallbackPrice: 50, history: [] },
    ];
    const series = buildPortfolioSeries(holdings, START, NOW);
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.value]));
    // manual siempre aporta 2*50=100, sin importar la fecha.
    expect(byDate["2026-08-02"]).toBeCloseTo(100 + 100, 6);
    expect(byDate["2026-08-06"]).toBeCloseTo(200 + 100, 6);
  });

  it("un holding sin fallbackPrice ni historial previo a la fecha no aporta valor (no inventa un precio)", () => {
    const holdings: HoldingSnapshot[] = [
      {
        id: "fci",
        quantity: 1,
        fallbackPrice: 100,
        history: [
          { price: 100, recorded_at: "2026-08-02" },
          { price: 200, recorded_at: "2026-08-06" },
        ],
      },
      { id: "sinprecio", quantity: 10, fallbackPrice: null, history: [] },
    ];
    const series = buildPortfolioSeries(holdings, START, NOW);
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.value]));
    expect(byDate["2026-08-02"]).toBeCloseTo(100, 6);
  });
});
