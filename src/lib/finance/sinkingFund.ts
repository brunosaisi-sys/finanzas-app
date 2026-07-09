// Motor de cálculo de Sinking Fund y Maintenance Reserve
// Fórmulas: docs/01-fundamentos-teoricos.md §1.2, §2.1, §1.3
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
  auto:         { label: "Auto",             useful_life_months: 144, maintenance_pct_annual: 0.04,  residual_pct: 0.35, currency_ref: "USD", source: "BEA / mercado AR (AR ajustado)" },
  vivienda:     { label: "Vivienda",         useful_life_months: null, maintenance_pct_annual: 0.015, residual_pct: null, currency_ref: "ARS", source: "Regla 1% real estate" },
  muebles:      { label: "Muebles",          useful_life_months: 180, maintenance_pct_annual: 0.005, residual_pct: 0.10, currency_ref: "USD", source: "BEA" },
};

export function getDefaultsForCategory(category: AssetCategory): AssetDefaults {
  return ASSET_DEFAULTS[category];
}

// Tasa de depreciación anual para durables (§1.3 — Cao et al. 2025, JMCB)
// Valor central del rango 0.16–0.17; excluye vivienda.
const DURABLE_DEPRECIATION_ANNUAL = 0.16;

/**
 * Valor actual estimado por depreciación compuesta al 16% anual.
 * Fórmula: purchasePrice × (1 − 0.16)^(años_de_uso)
 * Fuente: §1.3 — Cao et al. (2025).
 *
 * @param today - Fecha de referencia (default: hoy). Útil para tests.
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
 *
 * @param C0 - Costo de reposición (bien nuevo equivalente hoy)
 * @param CL - Valor de salvamento al final de la vida útil
 * @param L  - Meses hasta el reemplazo
 * @param i  - Tasa de rendimiento real mensual (default 0 — ajuste Argentina §3.1)
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
 *
 * @param currentValue  - Valor actual estimado del bien
 * @param pctAnnual     - Porcentaje anual de mantenimiento (ej: 0.01 = 1%)
 */
export function calcMaintenance(
  currentValue: number,
  pctAnnual: number
): number {
  return (currentValue * pctAnnual) / 12;
}

export interface AssetFundResult {
  sinkingFund: number;   // aporte mensual sinking; 0 si la categoría no tiene sinking
  maintenance: number;   // aporte mensual maintenance
  total: number;         // sinkingFund + maintenance
  monthsRemaining: number; // L usado para el cálculo
  currentValue: number;  // valor actual calculado o provisto
}

/**
 * Calcula los aportes mensuales completos (Sinking + Maintenance) para un bien.
 * Punto de entrada principal para la UI.
 */
export function calcAssetFunds(params: {
  C0: number;
  purchasePrice: number;
  purchaseDate: string | Date;
  useful_life_months: number | null;
  residual_pct: number | null;
  maintenance_pct_annual: number;
  interest_rate_monthly?: number;
  current_value?: number | null; // null/undefined → calculado automáticamente
  replacement_horizon_months?: number | null; // override manual de L (§1 IAS 16.51)
  today?: Date;
}): AssetFundResult {
  const today = params.today ?? new Date();
  const i = params.interest_rate_monthly ?? 0;

  const currentValue =
    params.current_value != null
      ? params.current_value
      : calcCurrentValue(params.purchasePrice, params.purchaseDate, today);

  const maintenance = calcMaintenance(currentValue, params.maintenance_pct_annual);

  // Vivienda y categorías sin vida útil definida: solo maintenance
  if (params.useful_life_months === null || params.residual_pct === null) {
    return { sinkingFund: 0, maintenance, total: maintenance, monthsRemaining: 0, currentValue };
  }

  const bought =
    typeof params.purchaseDate === "string"
      ? new Date(params.purchaseDate)
      : params.purchaseDate;
  // Meses exactos de calendario para evitar acumulación de error por años bisiestos
  const monthsUsed = Math.max(
    0,
    (today.getFullYear() - bought.getFullYear()) * 12 +
      (today.getMonth() - bought.getMonth())
  );
  const L_auto = Math.max(0, params.useful_life_months - monthsUsed);
  // El usuario puede fijar cuándo quiere reemplazarlo; su override tiene prioridad (IAS 16.51)
  const L =
    params.replacement_horizon_months != null && params.replacement_horizon_months > 0
      ? params.replacement_horizon_months
      : L_auto;

  const CL = params.C0 * params.residual_pct;
  const sinkingFund = calcSinkingFund(params.C0, CL, L, i);

  return { sinkingFund, maintenance, total: sinkingFund + maintenance, monthsRemaining: L, currentValue };
}
