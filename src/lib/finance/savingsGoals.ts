// Capa unificada de metas de ahorro
// Unifica bienes (assets) y objetivos manuales (savings_goals) bajo un modelo común.
// Fuente: docs/01-fundamentos-teoricos.md §0, §1.2, §3.3
//
// DISTINCIÓN CLAVE (§0 fundamentos):
//   Sinking Fund → acumula hacia una meta (va a savings_contributions, tiene progreso)
//   Maintenance  → gasto corriente recurrente (NO acumula, NO tiene meta aquí)

import {
  calcAssetFunds,
  getDefaultsForCategory,
  AssetCategory,
  CarSegment,
} from "./sinkingFund";
import type { Asset, SavingsGoal, SavingsContribution, Currency } from "@/types";

export type SavingsTargetKind = "asset" | "goal";

export interface SavingsTarget {
  kind: SavingsTargetKind;
  id: string;
  name: string;
  currency: Currency;
  targetAmount: number;        // monto total a juntar (C0−CL para bienes, target_amount para metas)
  monthlyContribution: number; // aporte mensual recomendado (sinking fund o recalculo dinámico)
  monthsRemaining: number;
  accumulated: number;         // suma de savings_contributions para esta meta
  progressPct: number;         // accumulated / targetAmount * 100
  accountId: string | null;    // cuenta donde se guarda la plata
}

// ─── buildAssetTarget ─────────────────────────────────────────────────────────

/**
 * Construye un SavingsTarget a partir de un bien (asset).
 *
 * Modo "calculated": targetAmount = C0 − CL del motor; monthlyContribution = sinkingFund.
 * Modo "manual":     targetAmount = savings_goal_amount; monthly = amount / months.
 *
 * Maintenance NO se incluye — es gasto corriente, no acumula (§0 fundamentos).
 */
export function buildAssetTarget(
  asset: Asset,
  contributions: SavingsContribution[],
  today: Date = new Date()
): SavingsTarget {
  const accumulated = contributions
    .filter((c) => c.asset_id === asset.id)
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const isManual =
    asset.savings_goal_mode === "manual" &&
    asset.savings_goal_amount != null &&
    asset.savings_goal_months != null &&
    asset.savings_goal_months > 0;

  let targetAmount: number;
  let monthlyContribution: number;
  let monthsRemaining: number;

  if (isManual) {
    targetAmount = asset.savings_goal_amount!;
    monthsRemaining = asset.savings_goal_months!;
    monthlyContribution = targetAmount / monthsRemaining;
  } else {
    // Resolver defaults de categoría igual que bienes/page.tsx
    const C0 = asset.replacement_cost ?? asset.purchase_price ?? 0;
    const pp = asset.purchase_price ?? C0;
    const pd = asset.purchase_date ?? asset.created_at.split("T")[0];

    let ulm = asset.useful_life_months;
    let rp = asset.residual_pct;
    let mpa = asset.maintenance_pct_annual;

    if (asset.category) {
      const def = getDefaultsForCategory(asset.category as AssetCategory);
      if (ulm == null) ulm = def.useful_life_months;
      if (rp == null) rp = def.residual_pct;
      if (mpa == null) mpa = def.maintenance_pct_annual;
    }

    const result = calcAssetFunds({
      C0,
      purchasePrice: pp,
      purchaseDate: pd,
      useful_life_months: ulm,
      residual_pct: rp,
      maintenance_pct_annual: mpa ?? 0,
      interest_rate_monthly: asset.interest_rate_monthly ?? 0,
      current_value: asset.current_value,
      replacement_horizon_months: asset.replacement_horizon_months,
      car_segment: asset.car_segment as CarSegment | null,
      bought_used: asset.bought_used,
      today,
    });

    targetAmount = result.goalAmount;
    monthlyContribution = result.sinkingFund;
    monthsRemaining = result.monthsRemaining;
  }

  const progressPct =
    targetAmount > 0 ? Math.min(100, (accumulated / targetAmount) * 100) : 0;

  return {
    kind: "asset",
    id: asset.id,
    name: asset.name,
    currency: asset.currency,
    targetAmount,
    monthlyContribution,
    monthsRemaining,
    accumulated,
    progressPct,
    accountId: asset.account_id,
  };
}

// ─── buildGoalTarget ──────────────────────────────────────────────────────────

/**
 * Construye un SavingsTarget a partir de un objetivo manual (savings_goal).
 *
 * monthlyContribution se recalcula dinámicamente: si te atrasaste, sube;
 * si adelantaste, baja. Fórmula: (target − accumulated) / meses_restantes.
 */
export function buildGoalTarget(
  goal: SavingsGoal,
  contributions: SavingsContribution[],
  today: Date = new Date()
): SavingsTarget {
  const accumulated = contributions
    .filter((c) => c.goal_id === goal.id)
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const startDate = new Date(goal.start_date);
  const monthsElapsed =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    (today.getMonth() - startDate.getMonth());
  const monthsRemaining = Math.max(0, goal.target_months - monthsElapsed);

  const remaining = Math.max(0, goal.target_amount - accumulated);
  const monthlyContribution =
    monthsRemaining > 0 ? remaining / monthsRemaining : 0;

  const progressPct =
    goal.target_amount > 0
      ? Math.min(100, (accumulated / goal.target_amount) * 100)
      : 0;

  return {
    kind: "goal",
    id: goal.id,
    name: goal.name,
    currency: goal.currency,
    targetAmount: goal.target_amount,
    monthlyContribution,
    monthsRemaining,
    accumulated,
    progressPct,
    accountId: goal.account_id,
  };
}

// ─── getAllSavingsTargets ──────────────────────────────────────────────────────

/**
 * Combina bienes y objetivos en una lista unificada de metas.
 *
 * Excluye bienes sin sinking fund (vivienda, bienes con vida útil nula y sin modo manual).
 * Ordena por progreso ascendente (las metas más lejos de cumplirse primero).
 */
export function getAllSavingsTargets(
  assets: Asset[],
  goals: SavingsGoal[],
  contributions: SavingsContribution[],
  today: Date = new Date()
): SavingsTarget[] {
  const assetTargets = assets
    .map((a) => buildAssetTarget(a, contributions, today))
    .filter((t) => t.targetAmount > 0 || t.monthlyContribution > 0);

  const goalTargets = goals
    .filter((g) => !g.archived)
    .map((g) => buildGoalTarget(g, contributions, today));

  return [...assetTargets, ...goalTargets].sort(
    (a, b) => a.progressPct - b.progressPct
  );
}
