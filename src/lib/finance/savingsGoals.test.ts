import { buildAssetTarget, buildGoalTarget, getAllSavingsTargets } from "./savingsGoals";
import type { Asset, SavingsGoal, SavingsContribution } from "@/types";

const TODAY = new Date("2026-07-11");

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    user_id: "u1",
    name: "Test bien",
    category: "notebook",
    purchase_price: 1000,
    purchase_date: "2025-07-11",  // 12 meses de antigüedad
    currency: "USD",
    replacement_cost: 1200,
    useful_life_months: 60,
    residual_pct: 0.15,
    maintenance_pct_annual: 0.01,
    replacement_horizon_months: null,
    interest_rate_monthly: 0,
    current_value: null,
    car_segment: null,
    bought_used: null,
    savings_goal_mode: null,
    savings_goal_amount: null,
    savings_goal_months: null,
    account_id: null,
    created_at: "2025-07-11T00:00:00Z",
    ...overrides,
  };
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "goal-1",
    user_id: "u1",
    name: "Viaje a Europa",
    target_amount: 3000,
    currency: "USD",
    target_months: 12,
    start_date: "2026-04-11",   // 3 meses atrás de TODAY (2026-07-11)
    account_id: null,
    archived: false,
    created_at: "2026-04-11T00:00:00Z",
    ...overrides,
  };
}

function makeContrib(overrides: Partial<SavingsContribution>): SavingsContribution {
  return {
    id: "c-1",
    user_id: "u1",
    asset_id: null,
    goal_id: null,
    amount: 100,
    currency: "USD",
    account_id: null,
    income_id: null,
    date: "2026-07-01",
    note: null,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

// ─── buildAssetTarget — modo calculado ────────────────────────────────────────

describe("buildAssetTarget — calculated mode", () => {
  it("usa goalAmount y sinkingFund del motor", () => {
    // Auto popular, comprado usado, C0=20000, horizonte manual 24m
    // CL = calcCarResidualValue(current~20000, 24m, popular) = 20000 * 0.87^2 ≈ 15138
    // goalAmount = 20000 - 15138 ≈ 4862 (aproximado)
    // Verificamos la estructura, no el valor exacto del auto aquí
    const asset = makeAsset({
      id: "asset-auto",
      name: "Auto",
      category: "auto",
      purchase_price: 20000,
      replacement_cost: 20000,
      purchase_date: "2025-07-11",
      useful_life_months: 144,
      residual_pct: 0.35,
      car_segment: "popular",
      bought_used: true,
      replacement_horizon_months: 24,
    });
    const target = buildAssetTarget(asset, [], TODAY);
    expect(target.kind).toBe("asset");
    expect(target.targetAmount).toBeGreaterThan(0);
    expect(target.monthlyContribution).toBeCloseTo(target.targetAmount / 24, 1);
    expect(target.accumulated).toBe(0);
    expect(target.progressPct).toBe(0);
  });

  it("bien calculado C0=13000 CL≈9083 L=24 → monthly≈163", () => {
    // Caso del doc §3.3: auto popular usado en 12000, horizonte 24m,
    // con current_value=12000, C0=13000 (reposición)
    const asset = makeAsset({
      category: "auto",
      purchase_price: 12000,
      replacement_cost: 13000,
      current_value: 12000,
      car_segment: "popular",
      bought_used: true,
      replacement_horizon_months: 24,
    });
    const target = buildAssetTarget(asset, [], TODAY);
    // CL = 12000 * (1-0.13)^2 = 12000 * 0.7569 = 9082.8
    // goalAmount = 13000 - 9082.8 = 3917.2
    // sinkingFund = 3917.2 / 24 ≈ 163.2
    expect(target.targetAmount).toBeCloseTo(3917.2, 0);
    expect(target.monthlyContribution).toBeCloseTo(163.2, 0);
  });

  it("cuenta accumulated de las contributions del mismo asset", () => {
    const asset = makeAsset();
    const contribs = [
      makeContrib({ asset_id: "asset-1", amount: 200 }),
      makeContrib({ asset_id: "asset-1", amount: 150 }),
      makeContrib({ asset_id: "otro-asset", amount: 999 }),  // no cuenta
    ];
    const target = buildAssetTarget(asset, contribs, TODAY);
    expect(target.accumulated).toBe(350);
    expect(target.progressPct).toBeGreaterThan(0);
  });
});

// ─── buildAssetTarget — modo manual ───────────────────────────────────────────

describe("buildAssetTarget — manual mode", () => {
  it("5000 USD en 18 meses → monthly = 277.78", () => {
    const asset = makeAsset({
      savings_goal_mode: "manual",
      savings_goal_amount: 5000,
      savings_goal_months: 18,
    });
    const target = buildAssetTarget(asset, [], TODAY);
    expect(target.targetAmount).toBe(5000);
    expect(target.monthlyContribution).toBeCloseTo(277.78, 1);
    expect(target.monthsRemaining).toBe(18);
  });

  it("con accumulated: progressPct = 750/5000 = 15%", () => {
    const asset = makeAsset({
      savings_goal_mode: "manual",
      savings_goal_amount: 5000,
      savings_goal_months: 18,
    });
    const contribs = [makeContrib({ asset_id: "asset-1", amount: 750 })];
    const target = buildAssetTarget(asset, contribs, TODAY);
    expect(target.accumulated).toBe(750);
    expect(target.progressPct).toBeCloseTo(15, 1);
  });
});

// ─── buildGoalTarget ──────────────────────────────────────────────────────────

describe("buildGoalTarget", () => {
  it("3000 USD 12m, start=3m atrás, acumulado=750 → progress 25%, monthly=250", () => {
    const goal = makeGoal(); // start_date 3 meses atrás
    const contribs = [makeContrib({ goal_id: "goal-1", amount: 750 })];
    const target = buildGoalTarget(goal, contribs, TODAY);
    // monthsRemaining = 12 - 3 = 9
    // monthly = (3000-750)/9 = 250
    expect(target.monthsRemaining).toBe(9);
    expect(target.monthlyContribution).toBeCloseTo(250, 1);
    expect(target.progressPct).toBeCloseTo(25, 1);
    expect(target.accumulated).toBe(750);
  });

  it("atrasado: acumulado=500 → monthly sube a ≈277.78", () => {
    const goal = makeGoal();
    const contribs = [makeContrib({ goal_id: "goal-1", amount: 500 })];
    const target = buildGoalTarget(goal, contribs, TODAY);
    // (3000-500)/9 ≈ 277.78
    expect(target.monthlyContribution).toBeCloseTo(277.78, 1);
  });

  it("objetivo completado (accumulated >= target) → monthly=0, progress=100", () => {
    const goal = makeGoal();
    const contribs = [makeContrib({ goal_id: "goal-1", amount: 3500 })];
    const target = buildGoalTarget(goal, contribs, TODAY);
    expect(target.monthlyContribution).toBe(0);
    expect(target.progressPct).toBe(100);
  });

  it("objetivo vencido (sin meses restantes) → monthly=0", () => {
    const goal = makeGoal({ target_months: 2, start_date: "2026-01-01" }); // vencido hace 2m
    const target = buildGoalTarget(goal, [], TODAY);
    expect(target.monthsRemaining).toBe(0);
    expect(target.monthlyContribution).toBe(0);
  });

  it("sin contributions → accumulated=0, progressPct=0", () => {
    const goal = makeGoal();
    const target = buildGoalTarget(goal, [], TODAY);
    expect(target.accumulated).toBe(0);
    expect(target.progressPct).toBe(0);
    expect(target.kind).toBe("goal");
  });
});

// ─── getAllSavingsTargets ──────────────────────────────────────────────────────

describe("getAllSavingsTargets", () => {
  it("excluye bienes tipo vivienda (sin sinking fund, sin modo manual)", () => {
    const vivienda = makeAsset({
      id: "asset-vivienda",
      category: "vivienda",
      replacement_cost: 100000,
      useful_life_months: null,
      residual_pct: null,
    });
    const targets = getAllSavingsTargets([vivienda], [], [], TODAY);
    expect(targets).toHaveLength(0);
  });

  it("ordena por progressPct ascendente", () => {
    const goal1 = makeGoal({ id: "g1", name: "Meta 50%", target_amount: 100 });
    const goal2 = makeGoal({ id: "g2", name: "Meta 10%", target_amount: 100 });
    const contribs = [
      makeContrib({ goal_id: "g1", amount: 50 }),
      makeContrib({ goal_id: "g2", amount: 10 }),
    ];
    const targets = getAllSavingsTargets([], [goal1, goal2], contribs, TODAY);
    expect(targets[0].name).toBe("Meta 10%");
    expect(targets[1].name).toBe("Meta 50%");
  });

  it("NO incluye maintenance como meta (solo sinking)", () => {
    const asset = makeAsset({
      maintenance_pct_annual: 0.05,  // mantenimiento alto
      replacement_horizon_months: 24,
    });
    const target = buildAssetTarget(asset, [], TODAY);
    // monthlyContribution solo es sinking, no incluye maintenance
    const result = require("./sinkingFund").calcAssetFunds({
      C0: 1200,
      purchasePrice: 1000,
      purchaseDate: "2025-07-11",
      useful_life_months: 60,
      residual_pct: 0.15,
      maintenance_pct_annual: 0.05,
      replacement_horizon_months: 24,
      today: TODAY,
    });
    expect(target.monthlyContribution).toBeCloseTo(result.sinkingFund, 1);
    expect(target.monthlyContribution).toBeLessThan(result.total); // maintenance no incluida
  });
});
