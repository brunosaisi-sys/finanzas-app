import { calcHoldingReturn, type PricePoint } from "./holdingReturn";

const NOW = new Date("2026-08-07");

describe("calcHoldingReturn", () => {
  it("devuelve null con menos de 2 puntos de precio", () => {
    expect(calcHoldingReturn([], 30, NOW)).toBeNull();
    expect(calcHoldingReturn([{ price: 100, recorded_at: "2026-08-01" }], 30, NOW)).toBeNull();
  });

  it("devuelve null si el único punto previo cae fuera de la ventana de N días", () => {
    const history: PricePoint[] = [
      { price: 100, recorded_at: "2026-06-01" }, // 67 días antes — fuera de ventana 30d
      { price: 110, recorded_at: "2026-08-07" },
    ];
    expect(calcHoldingReturn(history, 30, NOW)).toBeNull();
  });

  it("calcula el retorno punto-a-punto contra el precio más antiguo dentro de la ventana", () => {
    const history: PricePoint[] = [
      { price: 100, recorded_at: "2026-07-20" }, // 18 días antes — dentro de ventana 30d
      { price: 110, recorded_at: "2026-08-07" },
    ];
    expect(calcHoldingReturn(history, 30, NOW)).toBeCloseTo(0.10, 6);
  });

  it("usa el precio más antiguo disponible dentro de la ventana, no el más cercano", () => {
    const history: PricePoint[] = [
      { price: 90, recorded_at: "2026-07-15" }, // más antiguo dentro de ventana
      { price: 95, recorded_at: "2026-07-25" },
      { price: 100, recorded_at: "2026-08-07" }, // latest
    ];
    // (100 - 90) / 90, no (100-95)/95
    expect(calcHoldingReturn(history, 30, NOW)).toBeCloseTo((100 - 90) / 90, 6);
  });

  it("ignora puntos fuera de la ventana aunque existan históricos más viejos", () => {
    const history: PricePoint[] = [
      { price: 50, recorded_at: "2026-01-01" }, // muy viejo, fuera de ventana
      { price: 90, recorded_at: "2026-07-15" }, // dentro de ventana
      { price: 100, recorded_at: "2026-08-07" },
    ];
    expect(calcHoldingReturn(history, 30, NOW)).toBeCloseTo((100 - 90) / 90, 6);
  });

  it("devuelve retorno negativo si el precio bajó", () => {
    const history: PricePoint[] = [
      { price: 100, recorded_at: "2026-07-20" },
      { price: 90, recorded_at: "2026-08-07" },
    ];
    expect(calcHoldingReturn(history, 30, NOW)).toBeCloseTo(-0.10, 6);
  });

  it("respeta una ventana custom distinta de 30 días", () => {
    const history: PricePoint[] = [
      { price: 100, recorded_at: "2026-08-01" }, // 6 días antes
      { price: 105, recorded_at: "2026-08-07" },
    ];
    expect(calcHoldingReturn(history, 7, NOW)).toBeCloseTo(0.05, 6);
    expect(calcHoldingReturn(history, 3, NOW)).toBeNull(); // fuera de ventana de 3 días
  });
});
