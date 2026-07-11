// Motor de cálculo de Sinking Fund y Maintenance Reserve
// Fórmulas: docs/01-fundamentos-teoricos.md §1.2, §2.1, §1.3, §3.3
// NUNCA modificar fórmulas sin actualizar el documento fuente.

export type AssetCategory =
  | "heladera"
  | "lavarropas"
  | "lavavajillas"
  | "secarropas"
  | "microondas"
  | "horno"
  | "tv"
  | "notebook"
  | "smartphone"
  | "auto"
  | "vivienda"
  | "muebles";

export interface AssetDefaults {
  label: string;
  useful_life_months: number | null; // null = no se reemplaza (ej: vivienda)
  maintenance_pct_annual: number;
  residual_pct: number | null;       // null = sin valor residual (ej: vivienda)
  currency_ref: "ARS" | "USD";
  source: string;
}

// Tabla §4 de docs/01-fundamentos-teoricos.md
// Valores ajustados para Argentina (§3.1): residuales al alza, moneda USD para importados
export const ASSET_DEFAULTS: Record<AssetCategory, AssetDefaults> = {
  heladera:     { label: "Heladera/Freezer", useful_life_months: 144, maintenance_pct_annual: 0.01,  residual_pct: 0.10, currency_ref: "USD", source: "OCU / BEA" },
  lavarropas:   { label: "Lavarropas",       useful_life_months: 120, maintenance_pct_annual: 0.015, residual_pct: 0.08, currency_ref: "USD", source: "OCU" },
  lavavajillas: { label: "Lavavajillas",     useful_life_months: 108, maintenance_pct_annual: 0.015, residual_pct: 0.08, currency_ref: "USD", source: "OCU" },
  secarropas:   { label: "Secarropas",       useful_life_months: 132, maintenance_pct_annual: 0.015, residual_pct: 0.08, currency_ref: "USD", source: "OCU" },
  microondas:   { label: "Microondas",       useful_life_months: 96,  maintenance_pct_annual: 0.01,  residual_pct: 0.05, currency_ref: "USD", source: "OCU" },
  horno:        { label: "Horno/Cocina",     useful_life_months: 144, maintenance_pct_annual: 0.01,  residual_pct: 0.08, currency_ref: "USD", source: "OCU" },
  tv:           { label: "TV",               useful_life_months: 96,  maintenance_pct_annual: 0.005, residual_pct: 0.10, currency_ref: "USD", source: "Mercado" },
  notebook:     { label: "Notebook/PC",      useful_life_months: 60,  maintenance_pct_annual: 0.01,  residual_pct: 0.15, currency_ref: "USD", source: "Mercado" },
  smartphone:   { label: "Smartphone",       useful_life_months: 36,  maintenance_pct_annual: 0.005, residual_pct: 0.30, currency_ref: "USD", source: "Mercado/SellCell (AR ajustado)" },
  // Auto: residual_pct es null porque se usa el modelo de dos tasas (§3.3) cuando hay car_segment.
  // El 0.35 queda como fallback si no hay segmento definido.
  auto:         { label: "Auto",             useful_life_months: 144, maintenance_pct_annual: 0.04,  residual_pct: 0.35, currency_ref: "USD", source: "BEA / mercado AR (AR ajustado)" },
  vivienda:     { label: "Vivienda",         useful_life_months: null, maintenance_pct_annual: 0.015, residual_pct: null, currency_ref: "ARS", source: "Regla 1% real estate" },
  muebles:      { label: "Muebles",          useful_life_months: 180, maintenance_pct_annual: 0.005, residual_pct: 0.10, currency_ref: "USD", source: "BEA" },
};

export function getDefaultsForCategory(category: AssetCategory): AssetDefaults {
  return ASSET_DEFAULTS[category];
}

// ─── Modelo de dos tasas para autos §3.3 ─────────────────────────────────────

export type CarSegment = "popular" | "pickup" | "suv_compacta" | "premium" | "compacto_entrada";

export const CAR_DEPRECIATION_SEGMENTS: Record<CarSegment, {
  label: string;
  d1: number;
  d2: number;
  source: string;
}> = {
  popular:          { label: "Auto popular / medio",             d1: 0.18, d2: 0.13, source: "ACARA/LA NACION, Autozoom" },
  pickup:           { label: "Pickup",                           d1: 0.12, d2: 0.10, source: "CCA, Ámbito, MercadoLibre" },
  suv_compacta:     { label: "SUV compacta",                     d1: 0.15, d2: 0.13, source: "Autozoom" },
  premium:          { label: "Premium",                          d1: 0.22, d2: 0.19, source: "Autozoom" },
  compacto_entrada: { label: "Compacto de entrada",              d1: 0.20, d2: 0.16, source: "comparaencasa" },
};

/**
 * Valor de reventa estimado de un auto según el modelo de dos tasas (§3.3).
 *
 * boughtUsed = true:  V = currentValue × (1 − d2)^(M/12)
 * boughtUsed = false: V = currentValue × (1 − d2)^(M/12)
 *   (para nuevo comprado hace menos de 1 año, d1 ya aplicó sobre el precio de compra
 *    en la depreciación del valor actual; la proyección solo usa d2)
 *
 * Fuente: §3.3 — ACARA, CCA, Autozoom, comparaencasa.
 */
export function calcCarResidualValue(params: {
  currentValue: number;
  monthsToReplacement: number;
  segment: CarSegment;
  boughtUsed: boolean;
}): number {
  const { currentValue, monthsToReplacement, segment } = params;
  if (monthsToReplacement <= 0) return currentValue;
  const { d2 } = CAR_DEPRECIATION_SEGMENTS[segment];
  // Para el valor FUTURO siempre se aplica d2 desde el valor actual,
  // independientemente de si fue comprado nuevo o usado (§3.3 regla especial).
  return currentValue * Math.pow(1 - d2, monthsToReplacement / 12);
}

// ─── Depreciación general de durables §1.3 ───────────────────────────────────

// Tasa de depreciación anual para durables (§1.3 — Cao et al. 2025, JMCB)
const DURABLE_DEPRECIATION_ANNUAL = 0.16;

/**
 * Valor actual estimado por depreciación compuesta al 16% anual.
 * Fórmula: purchasePrice × (1 − 0.16)^(años_de_uso)
 * Fuente: §1.3 — Cao et al. (2025).
 */
export function calcCurrentValue(
  purchasePrice: number,
  purchaseDate: string | Date,
  today: Date = new Date()
): number {
  const bought =
    typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  const years = (today.getTime() - bought.getTime()) / MS_PER_YEAR;
  if (years <= 0) return purchasePrice;
  return purchasePrice * Math.pow(1 - DURABLE_DEPRECIATION_ANNUAL, years);
}

/**
 * Aporte mensual al Sinking Fund (fondo de reposición).
 * Fuente: §1.2 — Sinking Fund Method (NPTEL / ingeniería económica).
 *
 * Con interés:  d = (C0 − CL) × i / ((1 + i)^L − 1)
 * Sin interés:  d = (C0 − CL) / L
 */
export function calcSinkingFund(
  C0: number,
  CL: number,
  L: number,
  i: number = 0
): number {
  if (L <= 0) return 0;
  const depreciable = C0 - CL;
  if (depreciable <= 0) return 0;
  if (i === 0) {
    return depreciable / L;
  }
  return (depreciable * i) / (Math.pow(1 + i, L) - 1);
}

/**
 * Aporte mensual a la Maintenance Reserve (fondo de mantenimiento).
 * Fuente: §2.1 — Regla del 1%, aplicada al valor actual del bien.
 *
 * Fórmula: currentValue × (pctAnnual / 12)
 */
export function calcMaintenance(
  currentValue: number,
  pctAnnual: number
): number {
  return (currentValue * pctAnnual) / 12;
}

export interface AssetFundResult {
  sinkingFund: number;    // aporte mensual sinking; 0 si la categoría no tiene sinking
  maintenance: number;    // aporte mensual maintenance
  total: number;          // sinkingFund + maintenance
  monthsRemaining: number; // L usado para el cálculo
  currentValue: number;   // valor actual calculado o provisto
  goalAmount: number;     // C0 − CL (monto a juntar); 0 si no aplica sinking
  residualValue: number;  // CL estimado
}

/**
 * Calcula los aportes mensuales completos (Sinking + Maintenance) para un bien.
 * Punto de entrada principal para la UI.
 *
 * Para categoría "auto" con car_segment definido, usa el modelo de dos tasas (§3.3)
 * para calcular CL en lugar del residual_pct fijo.
 * Para todos los demás bienes, usa residual_pct de la tabla §4.
 */
export function calcAssetFunds(params: {
  C0: number;
  purchasePrice: number;
  purchaseDate: string | Date;
  useful_life_months: number | null;
  residual_pct: number | null;
  maintenance_pct_annual: number;
  interest_rate_monthly?: number;
  current_value?: number | null;
  replacement_horizon_months?: number | null;
  // Campos para modelo de autos §3.3
  car_segment?: CarSegment | null;
  bought_used?: boolean | null;
  today?: Date;
}): AssetFundResult {
  const today = params.today ?? new Date();
  const i = params.interest_rate_monthly ?? 0;

  const currentValue =
    params.current_value != null
      ? params.current_value
      : calcCurrentValue(params.purchasePrice, params.purchaseDate, today);

  const maintenance = calcMaintenance(currentValue, params.maintenance_pct_annual);

  if (params.useful_life_months === null || params.residual_pct === null) {
    return { sinkingFund: 0, maintenance, total: maintenance, monthsRemaining: 0, currentValue, goalAmount: 0, residualValue: 0 };
  }

  const bought =
    typeof params.purchaseDate === "string"
      ? new Date(params.purchaseDate)
      : params.purchaseDate;
  const monthsUsed = Math.max(
    0,
    (today.getFullYear() - bought.getFullYear()) * 12 +
      (today.getMonth() - bought.getMonth())
  );
  const L_auto = Math.max(0, params.useful_life_months - monthsUsed);
  const L =
    params.replacement_horizon_months != null && params.replacement_horizon_months > 0
      ? params.replacement_horizon_months
      : L_auto;

  // CL: si es auto con segmento definido, usa modelo de dos tasas §3.3
  // en cualquier otro caso usa residual_pct fijo
  let CL: number;
  if (params.car_segment) {
    CL = calcCarResidualValue({
      currentValue,
      monthsToReplacement: L,
      segment: params.car_segment,
      boughtUsed: params.bought_used ?? true,
    });
  } else {
    CL = params.C0 * params.residual_pct;
  }

  const goalAmount = Math.max(0, params.C0 - CL);
  const sinkingFund = calcSinkingFund(params.C0, CL, L, i);

  return { sinkingFund, maintenance, total: sinkingFund + maintenance, monthsRemaining: L, currentValue, goalAmount, residualValue: CL };
}
