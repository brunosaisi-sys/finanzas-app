export type AccountType = "banco" | "efectivo" | "inversion" | "usd_reserva" | "credito";
export type Currency = "ARS" | "USD";
export type ExpenseSource = "app" | "whatsapp" | "ocr";
export type AssetType = "accion" | "cedear" | "bono" | "fci" | "crypto" | "otro";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  expected_return_annual: number | null;
  parent_id: string | null;
  closing_day: number | null;
  due_day: number | null;
  // Flag manual: ¿esta cuenta genera rendimiento y puede ser destino de cobertura?
  // undefined antes de migración 018; false por default después.
  earns_yield?: boolean;
  // Vínculo a un holding FCI (migración 021). Cuando está seteado, balance se
  // sincroniza con holding.quantity × holding.current_price vía sync_holding_balance.
  holding_id?: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
}

export type PaymentMethod = "efectivo" | "debito" | "credito" | "transferencia";

export interface Expense {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  currency: Currency;
  description: string | null;
  merchant: string | null;
  date: string;
  source: ExpenseSource;
  raw_ocr_text: string | null;
  created_at: string;
  payment_method: PaymentMethod | null;
  installments_total: number | null;
  installment_amount: number | null;
  covering_account_id: string | null;
  funding_account_id: string | null;
}

export interface Holding {
  id: string;
  user_id: string;
  account_id: string | null;
  ticker: string | null;
  name: string;
  asset_type: AssetType;
  quantity: number;
  avg_buy_price: number;
  currency: Currency;
  current_price: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Installment {
  id: string;
  expense_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface AccountEarmark {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  currency: Currency;
  reason: string | null;
  installment_id: string | null;
  expense_id: string | null;
  release_date: string | null;
  released: boolean;
  released_date: string | null;
  created_at: string;
}

export interface IncomeDistributionRule {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface IncomeDistributionLine {
  id: string;
  rule_id: string;
  account_id: string | null;
  label: string;
  percentage: number;
  created_at: string;
}

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

export type CarSegment = "popular" | "pickup" | "suv_compacta" | "premium" | "compacto_entrada";
export type SavingsGoalMode = "calculated" | "manual";

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  category: AssetCategory | null;
  purchase_price: number | null;
  purchase_date: string | null;
  currency: Currency;
  replacement_cost: number | null;
  useful_life_months: number | null;
  residual_pct: number | null;
  maintenance_pct_annual: number | null;
  replacement_horizon_months: number | null;
  interest_rate_monthly: number;
  current_value: number | null;
  // Modelo dos tasas para autos §3.3
  car_segment: CarSegment | null;
  bought_used: boolean | null;
  // Override manual del objetivo de ahorro
  savings_goal_mode: SavingsGoalMode | null;
  savings_goal_amount: number | null;
  savings_goal_months: number | null;
  // Cuenta donde se guarda el fondo del bien
  account_id: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  currency: Currency;
  target_months: number;
  start_date: string;
  account_id: string | null;
  archived: boolean;
  created_at: string;
}

export interface SavingsContribution {
  id: string;
  user_id: string;
  asset_id: string | null;
  goal_id: string | null;
  amount: number;
  currency: Currency;
  account_id: string | null;
  income_id: string | null;
  date: string;
  note: string | null;
  created_at: string;
}

export type IncomeType = "sueldo" | "freelance" | "otro";

export interface Income {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  currency: Currency;
  source: string | null;
  type: IncomeType | null;
  note: string | null;
  distributed: boolean;
  date: string;
  recurring: boolean;
  created_at: string;
}
