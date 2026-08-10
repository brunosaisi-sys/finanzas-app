import { matchFCIRate, type FciRateEntry } from "./fciRates";

describe("matchFCIRate", () => {
  const rates = new Map<string, FciRateEntry>([
    ["cocos rendimiento - clase a", { vcp: 1234.5, fecha: "2026-08-01" }],
  ]);

  it("matches by exact name (case-insensitive)", () => {
    const holding = { name: "Cocos Rendimiento - Clase A", asset_type: "fci" };
    expect(matchFCIRate(holding, rates)).toEqual({ vcp: 1234.5, fecha: "2026-08-01" });
  });

  it("matches by fuzzy word match when name is not exact", () => {
    const holding = { name: "Cocos Rendimiento Clase A FCI", asset_type: "fci" };
    expect(matchFCIRate(holding, rates)?.vcp).toBe(1234.5);
  });

  it("never uses a ticker field to match — regression for Sesión J.1.14 TAREA 1", () => {
    // A holding whose only chance of matching would be via `ticker` (unrelated free
    // text the user typed) must not match — the feed has no ticker field, only `fondo`
    // (name). Root cause of holding_price_history staying at 0 rows in producción.
    const holding = { name: "Cocos Rendimiento - Clase A", ticker: "COCO1", asset_type: "fci" } as {
      name: string;
      asset_type: string;
    };
    expect(matchFCIRate(holding, rates)?.vcp).toBe(1234.5);
  });

  it("returns null for non-fci asset types", () => {
    const holding = { name: "Cocos Rendimiento - Clase A", asset_type: "cedear" };
    expect(matchFCIRate(holding, rates)).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const holding = { name: "Fondo Inexistente XYZ", asset_type: "fci" };
    expect(matchFCIRate(holding, rates)).toBeNull();
  });
});
