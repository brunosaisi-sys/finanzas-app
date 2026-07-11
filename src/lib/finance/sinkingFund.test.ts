import {
  calcSinkingFund,
  calcMaintenance,
  calcCurrentValue,
  calcAssetFunds,
  calcCarResidualValue,
  ASSET_DEFAULTS,
  CAR_DEPRECIATION_SEGMENTS,
  getDefaultsForCategory,
} from "./sinkingFund";

// ─── calcSinkingFund ─────────────────────────────────────────────────────────

describe("calcSinkingFund", () => {
  test("i=0: d = (C0-CL)/L exacto", () => {
    // C0=10000, CL=1000, L=120 meses → d = 9000/120 = 75
    expect(calcSinkingFund(10_000, 1_000, 120, 0)).toBeCloseTo(75, 5);
  });

  test("i=0 default: mismo resultado sin pasar i", () => {
    expect(calcSinkingFund(10_000, 1_000, 120)).toBeCloseTo(75, 5);
  });

  test("i>0: d = (C0-CL)×i / ((1+i)^L - 1) verificable a mano", () => {
    // C0=1000, CL=0, L=12, i=0.01 (1% mensual)
    // d = 1000×0.01 / ((1.01)^12 − 1)
    //   = 10 / 0.126825030... = 78.8488...
    expect(calcSinkingFund(1_000, 0, 12, 0.01)).toBeCloseTo(78.849, 2);
  });

  test("L=0 con i=0: retorna 0 sin error", () => {
    expect(calcSinkingFund(10_000, 1_000, 0, 0)).toBe(0);
  });

  test("L=0 con i>0: retorna 0 sin error", () => {
    expect(calcSinkingFund(10_000, 1_000, 0, 0.01)).toBe(0);
  });

  test("L negativo: retorna 0", () => {
    expect(calcSinkingFund(10_000, 1_000, -5, 0)).toBe(0);
  });

  test("C0 = CL (depreciable = 0): retorna 0", () => {
    expect(calcSinkingFund(1_000, 1_000, 12, 0)).toBe(0);
  });

  test("C0 < CL (depreciable negativo): retorna 0", () => {
    expect(calcSinkingFund(800, 1_000, 12, 0)).toBe(0);
  });
});

// ─── calcMaintenance ─────────────────────────────────────────────────────────

describe("calcMaintenance", () => {
  test("1% anual sobre 100.000 → 83,333/mes", () => {
    expect(calcMaintenance(100_000, 0.01)).toBeCloseTo(83.333, 2);
  });

  test("1.5% anual sobre 10.000 → 12,5/mes", () => {
    expect(calcMaintenance(10_000, 0.015)).toBeCloseTo(12.5, 5);
  });

  test("valor actual 0 → retorna 0", () => {
    expect(calcMaintenance(0, 0.01)).toBe(0);
  });
});

// ─── calcCurrentValue ────────────────────────────────────────────────────────

describe("calcCurrentValue", () => {
  const TODAY = new Date("2026-07-01");

  test("comprado hoy → retorna precio de compra sin cambio", () => {
    expect(calcCurrentValue(10_000, "2026-07-01", TODAY)).toBeCloseTo(10_000, 0);
  });

  test("comprado ayer → marginalmente menor que precio de compra", () => {
    const yesterday = new Date("2026-06-30");
    const result = calcCurrentValue(10_000, yesterday, TODAY);
    expect(result).toBeGreaterThan(9_990);
    expect(result).toBeLessThan(10_000);
  });

  test("1 año de uso → ~84% del precio (1 − 0.16)^1", () => {
    // (1 - 0.16)^1 = 0.84 → esperado exacto 8400
    // Diferencia ≤ 5 USD por ajuste de año bisiesto (365 vs 365.25 días)
    const lastYear = new Date("2025-07-01");
    expect(calcCurrentValue(10_000, lastYear, TODAY)).toBeCloseTo(8_400, -1);
  });

  test("2 años de uso → ~70.56% del precio (0.84)^2", () => {
    const twoYearsAgo = new Date("2024-07-01");
    // 0.84^2 = 0.7056 → esperado exacto 7056; tolerancia ±5 por años bisiestos
    expect(calcCurrentValue(10_000, twoYearsAgo, TODAY)).toBeCloseTo(7_056, -1);
  });

  test("fecha futura → retorna precio de compra sin cambio", () => {
    expect(calcCurrentValue(10_000, "2027-01-01", TODAY)).toBe(10_000);
  });
});

// ─── ASSET_DEFAULTS ──────────────────────────────────────────────────────────

describe("ASSET_DEFAULTS", () => {
  test("vivienda: useful_life_months y residual_pct son null", () => {
    expect(ASSET_DEFAULTS.vivienda.useful_life_months).toBeNull();
    expect(ASSET_DEFAULTS.vivienda.residual_pct).toBeNull();
  });

  test("vivienda: tiene maintenance_pct_annual (solo mantenimiento, sin sinking)", () => {
    expect(ASSET_DEFAULTS.vivienda.maintenance_pct_annual).toBeGreaterThan(0);
  });

  test("heladera: 12 años (144 meses), 1% mant, 10% residual, USD", () => {
    const d = ASSET_DEFAULTS.heladera;
    expect(d.useful_life_months).toBe(144);
    expect(d.maintenance_pct_annual).toBe(0.01);
    expect(d.residual_pct).toBe(0.1);
    expect(d.currency_ref).toBe("USD");
  });

  test("smartphone: 3 años (36 meses), 30% residual (AR ajustado)", () => {
    const d = ASSET_DEFAULTS.smartphone;
    expect(d.useful_life_months).toBe(36);
    expect(d.residual_pct).toBe(0.3);
  });

  test("auto: 12 años, 35% residual (AR ajustado)", () => {
    const d = ASSET_DEFAULTS.auto;
    expect(d.useful_life_months).toBe(144);
    expect(d.residual_pct).toBe(0.35);
  });

  test("getDefaultsForCategory retorna el mismo objeto que ASSET_DEFAULTS", () => {
    expect(getDefaultsForCategory("notebook")).toBe(ASSET_DEFAULTS.notebook);
  });
});

// ─── calcAssetFunds ──────────────────────────────────────────────────────────

describe("calcAssetFunds", () => {
  const TODAY = new Date("2026-07-01");

  test("vivienda: sinkingFund=0, maintenance>0 (no se reemplaza)", () => {
    const result = calcAssetFunds({
      C0: 0,
      purchasePrice: 200_000,
      purchaseDate: "2020-01-01",
      useful_life_months: null,
      residual_pct: null,
      maintenance_pct_annual: 0.015,
      today: TODAY,
    });
    expect(result.sinkingFund).toBe(0);
    expect(result.maintenance).toBeGreaterThan(0);
    expect(result.total).toBe(result.maintenance);
  });

  test("smartphone nuevo (i=0): sinkingFund correcto", () => {
    // Comprado hoy, C0=800 USD, 30% residual, 36 meses
    // CL = 800 * 0.30 = 240
    // L = 36 meses (nuevo)
    // d = (800-240)/36 = 560/36 = 15.555...
    const result = calcAssetFunds({
      C0: 800,
      purchasePrice: 800,
      purchaseDate: TODAY.toISOString(),
      useful_life_months: 36,
      residual_pct: 0.30,
      maintenance_pct_annual: 0.005,
      interest_rate_monthly: 0,
      today: TODAY,
    });
    expect(result.sinkingFund).toBeCloseTo(15.556, 2);
    expect(result.monthsRemaining).toBe(36);
  });

  test("bien a mitad de vida: monthsRemaining = la mitad", () => {
    // Heladera comprada hace 72 meses (6 años), vida útil 144 meses
    const purchaseDate = new Date(TODAY);
    purchaseDate.setMonth(purchaseDate.getMonth() - 72);
    const result = calcAssetFunds({
      C0: 500,
      purchasePrice: 500,
      purchaseDate,
      useful_life_months: 144,
      residual_pct: 0.10,
      maintenance_pct_annual: 0.01,
      today: TODAY,
    });
    expect(result.monthsRemaining).toBe(72);
  });

  test("bien amortizado (más viejo que vida útil): sinkingFund=0", () => {
    const oldDate = new Date("2000-01-01"); // hace 26 años, vida útil 12 = ya pasó
    const result = calcAssetFunds({
      C0: 1_000,
      purchasePrice: 1_000,
      purchaseDate: oldDate,
      useful_life_months: 144,
      residual_pct: 0.10,
      maintenance_pct_annual: 0.01,
      today: TODAY,
    });
    expect(result.sinkingFund).toBe(0);
    expect(result.monthsRemaining).toBe(0);
  });

  test("current_value manual override prevalece sobre el calculado", () => {
    const result = calcAssetFunds({
      C0: 1_000,
      purchasePrice: 2_000,
      purchaseDate: "2020-01-01",
      useful_life_months: 120,
      residual_pct: 0.1,
      maintenance_pct_annual: 0.01,
      current_value: 999,  // override manual
      today: TODAY,
    });
    // maintenance debe usar 999, no el calculado
    expect(result.currentValue).toBe(999);
    expect(result.maintenance).toBeCloseTo(999 * 0.01 / 12, 5);
  });
});

// ─── calcCarResidualValue (§3.3) ─────────────────────────────────────────────

describe("calcCarResidualValue", () => {
  test("auto usado popular, 24 meses: 12000 × (0.87)^2 ≈ 9083", () => {
    // §3.3 ejemplo trazado del usuario
    const result = calcCarResidualValue({
      currentValue: 12_000,
      monthsToReplacement: 24,
      segment: "popular",
      boughtUsed: true,
    });
    expect(result).toBeCloseTo(9_082.8, 0);
  });

  test("pickup retiene más: 12000 × (0.90)^2 = 9720", () => {
    // d2 pickup = 0.10
    const result = calcCarResidualValue({
      currentValue: 12_000,
      monthsToReplacement: 24,
      segment: "pickup",
      boughtUsed: true,
    });
    expect(result).toBeCloseTo(9_720, 0);
  });

  test("monthsToReplacement = 0: retorna currentValue sin cambio", () => {
    const result = calcCarResidualValue({
      currentValue: 12_000,
      monthsToReplacement: 0,
      segment: "popular",
      boughtUsed: true,
    });
    expect(result).toBe(12_000);
  });

  test("sanity: retención a 2 años de popular está entre 65% y 90%", () => {
    const result = calcCarResidualValue({
      currentValue: 12_000,
      monthsToReplacement: 24,
      segment: "popular",
      boughtUsed: true,
    });
    const pct = result / 12_000;
    expect(pct).toBeGreaterThan(0.65);
    expect(pct).toBeLessThan(0.90);
  });
});

// ─── calcAssetFunds con modelo de autos ──────────────────────────────────────

describe("calcAssetFunds — modelo auto §3.3", () => {
  const TODAY = new Date("2026-07-01");

  test("auto usado popular, C0=13000, 24 meses: sinking ≈ 163/mes", () => {
    // CL = 12000 × (0.87)^2 ≈ 9083; (13000 − 9083) / 24 ≈ 163
    const result = calcAssetFunds({
      C0: 13_000,
      purchasePrice: 12_000,
      purchaseDate: "2026-03-01",
      useful_life_months: 144,
      residual_pct: 0.35, // ignorado cuando hay car_segment
      maintenance_pct_annual: 0.04,
      car_segment: "popular",
      bought_used: true,
      replacement_horizon_months: 24,
      current_value: 12_000,
      today: TODAY,
    });
    expect(result.sinkingFund).toBeCloseTo(163.2, 0);
  });

  test("auto usado popular, C0=20000 (upgrade), 24 meses: sinking ≈ 455/mes", () => {
    // CL ≈ 9083; (20000 − 9083) / 24 ≈ 454.9
    const result = calcAssetFunds({
      C0: 20_000,
      purchasePrice: 12_000,
      purchaseDate: "2026-03-01",
      useful_life_months: 144,
      residual_pct: 0.35,
      maintenance_pct_annual: 0.04,
      car_segment: "popular",
      bought_used: true,
      replacement_horizon_months: 24,
      current_value: 12_000,
      today: TODAY,
    });
    expect(result.sinkingFund).toBeCloseTo(454.9, 0);
  });

  test("goalAmount = C0 − CL devuelto correctamente", () => {
    const result = calcAssetFunds({
      C0: 13_000,
      purchasePrice: 12_000,
      purchaseDate: "2026-03-01",
      useful_life_months: 144,
      residual_pct: 0.35,
      maintenance_pct_annual: 0.04,
      car_segment: "popular",
      bought_used: true,
      replacement_horizon_months: 24,
      current_value: 12_000,
      today: TODAY,
    });
    // goalAmount = 13000 − 9082.8 ≈ 3917.2
    expect(result.goalAmount).toBeCloseTo(3_917.2, 0);
  });

  test("sin car_segment: usa residual_pct fijo (comportamiento original)", () => {
    // CL = 13000 × 0.35 = 4550; (13000 − 4550) / 24 ≈ 352
    const result = calcAssetFunds({
      C0: 13_000,
      purchasePrice: 12_000,
      purchaseDate: "2026-03-01",
      useful_life_months: 144,
      residual_pct: 0.35,
      maintenance_pct_annual: 0.04,
      replacement_horizon_months: 24,
      current_value: 12_000,
      today: TODAY,
    });
    expect(result.sinkingFund).toBeCloseTo(352.1, 0);
  });

  test("CAR_DEPRECIATION_SEGMENTS: popular tiene d1=0.18, d2=0.13", () => {
    expect(CAR_DEPRECIATION_SEGMENTS.popular.d1).toBe(0.18);
    expect(CAR_DEPRECIATION_SEGMENTS.popular.d2).toBe(0.13);
  });
});
