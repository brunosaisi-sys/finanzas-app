// Calcula las obligaciones mensuales totales del usuario
// Alimenta la pantalla de distribución de sueldo (próxima sesión)
// Fuente: docs/01-fundamentos-teoricos.md §1.2, §2.1

import {
  calcAssetFunds,
  getDefaultsForCategory,
  AssetCategory,
} from "./sinkingFund";
import type { Asset } from "@/types";

export interface ObligationBreakdownItem {
  label: string;
  type: "sinking" | "maintenance" | "installment";
  amount: number;
  currency: string;
}

export interface MonthlyObligations {
  sinking_total_usd: number;
  sinking_total_ars: number;
  maintenance_total_usd: number;
  maintenance_total_ars: number;
  installments_due: number;
  installments_currency: string;
  total_usd: number;
  total_ars: number;
  // Para Capa 1 del distribuidor (solo mantenimiento + cuotas, sin sinking).
  // Sinking se muestra en Capa 2 como parte de las metas de ahorro.
  maintenance_only_usd: number;
  maintenance_only_ars: number;
  breakdown: ObligationBreakdownItem[];
}

interface InstallmentDue {
  expense_description: string | null;
  amount: number;
  currency: string;
}

/**
 * Calcula el desglose mensual de obligaciones de fondos para el usuario.
 *
 * @param assets        - Lista de bienes del usuario (de la tabla `assets`)
 * @param installments  - Cuotas con due_date en el mes corriente (paid = false)
 * @param today         - Fecha de referencia (default: hoy)
 */
export function calculateMonthlyObligations(
  assets: Asset[],
  installments: InstallmentDue[] = [],
  today: Date = new Date()
): MonthlyObligations {
  const breakdown: ObligationBreakdownItem[] = [];

  let sinkingUSD = 0;
  let sinkingARS = 0;
  let maintUSD = 0;
  let maintARS = 0;

  for (const asset of assets) {
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
      today,
    });

    const cur = asset.currency;

    if (result.sinkingFund > 0) {
      breakdown.push({
        label: `${asset.name} — Sinking Fund`,
        type: "sinking",
        amount: result.sinkingFund,
        currency: cur,
      });
      if (cur === "USD") sinkingUSD += result.sinkingFund;
      else sinkingARS += result.sinkingFund;
    }

    if (result.maintenance > 0) {
      breakdown.push({
        label: `${asset.name} — Mantenimiento`,
        type: "maintenance",
        amount: result.maintenance,
        currency: cur,
      });
      if (cur === "USD") maintUSD += result.maintenance;
      else maintARS += result.maintenance;
    }
  }

  // Cuotas del mes corriente
  let installmentsDue = 0;
  let installmentsCurrency = "ARS";

  for (const inst of installments) {
    breakdown.push({
      label: inst.expense_description ?? "Cuota",
      type: "installment",
      amount: inst.amount,
      currency: inst.currency,
    });
    installmentsDue += inst.amount;
    installmentsCurrency = inst.currency;
  }

  return {
    sinking_total_usd: sinkingUSD,
    sinking_total_ars: sinkingARS,
    maintenance_total_usd: maintUSD,
    maintenance_total_ars: maintARS,
    installments_due: installmentsDue,
    installments_currency: installmentsCurrency,
    total_usd: sinkingUSD + maintUSD,
    total_ars: sinkingARS + maintARS + installmentsDue,
    maintenance_only_usd: maintUSD,
    maintenance_only_ars: maintARS + installmentsDue,
    breakdown,
  };
}
