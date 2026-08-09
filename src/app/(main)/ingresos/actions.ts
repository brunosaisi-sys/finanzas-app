"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Currency, IncomeType } from "@/types";

// ─── createIncome ────────────────────────────────────────────────────────────

interface CreateIncomeInput {
  amount: number;
  currency: Currency;
  type: IncomeType;
  account_id: string | null;
  date: string;
  note: string | null;
}

export async function createIncome(
  input: CreateIncomeInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // RPC atómica: inserta el ingreso y, si tiene cuenta destino, acredita su
  // balance en la misma transacción (Sesión J.1.13, TAREA 1 — la plata de un
  // ingreso existe desde que se registra, "distribuir" es solo categorizarla).
  const { data, error } = await supabase.rpc("create_income_with_balance", {
    p_amount: input.amount,
    p_currency: input.currency,
    p_type: input.type,
    p_account_id: input.account_id,
    p_date: input.date,
    p_note: input.note,
  });

  if (error) return { error: error.message };
  return { id: data as string };
}

// ─── confirmDistribution ─────────────────────────────────────────────────────

interface DistributionLine {
  account_id: string;
  amount: number;
  currency: Currency;
}

export async function confirmDistribution(
  incomeId: string,
  lines: DistributionLine[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("confirm_income_distribution", {
    p_income_id: incomeId,
    p_lines: lines.map((l) => ({ account_id: l.account_id, amount: l.amount })),
  });

  if (error) return { error: error.message };
  return {};
}

// ─── updateEmergencyFund ──────────────────────────────────────────────────────
// Suma additionalAmount al current_amount del fondo de emergencia.
// Read-then-write seguro en app single-user sin concurrencia.

export async function updateEmergencyFund(
  fundId: string,
  additionalAmount: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: fund, error: fetchError } = await supabase
    .from("funds")
    .select("current_amount")
    .eq("id", fundId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !fund) return { error: fetchError?.message ?? "Fondo no encontrado" };

  const { error } = await supabase
    .from("funds")
    .update({ current_amount: Number(fund.current_amount) + additionalAmount })
    .eq("id", fundId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

// ─── confirmDistributionWithContributions ─────────────────────────────────────
// Versión extendida del RPC de distribución que también registra aportes a metas
// y crea earmarks, todo en una sola transacción atómica (migración 011).

interface ContributionPayload {
  asset_id?: string | null;
  goal_id?: string | null;
  amount: number;
  currency: string;
  dest_account_id?: string | null;
  name: string;
}

export async function confirmDistributionWithContributions(
  incomeId: string,
  lines: DistributionLine[],
  contributions: ContributionPayload[],
  emergencyAmount: number,
  emergencyFundId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("confirm_distribution_with_contributions", {
    p_income_id: incomeId,
    p_lines: lines.map((l) => ({ account_id: l.account_id, amount: l.amount })),
    p_contributions: contributions,
    p_emergency_amount: emergencyAmount,
    p_emergency_fund_id: emergencyFundId,
  });

  if (error) return { error: error.message };
  return {};
}

// ─── redirectToDistribute ─────────────────────────────────────────────────────

export async function redirectToDistribute(incomeId: string): Promise<never> {
  redirect(`/ingresos/distribuir?ingreso_id=${incomeId}`);
}

// ─── updateIncome ─────────────────────────────────────────────────────────────

interface UpdateIncomeInput {
  amount?: number;
  currency?: Currency;
  type?: IncomeType;
  account_id?: string | null;
  date?: string;
  note?: string | null;
}

export async function updateIncome(
  incomeId: string,
  data: UpdateIncomeInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Campos financieros (amount/currency) llegan bloqueados desde la UI cuando
  // el ingreso ya fue distribuido — el RPC necesita valores concretos para los
  // 7 parámetros, así que se completan con los actuales de la fila en ese caso
  // (el RPC de todas formas no toca balance si distributed=true).
  let amount = data.amount;
  let currency = data.currency;
  if (amount === undefined || currency === undefined) {
    const { data: current, error: fetchError } = await supabase
      .from("incomes")
      .select("amount, currency")
      .eq("id", incomeId)
      .eq("user_id", user.id)
      .single();
    if (fetchError || !current) return { error: fetchError?.message ?? "Ingreso no encontrado" };
    amount = amount ?? current.amount;
    currency = currency ?? current.currency;
  }

  // RPC atómica: revierte el crédito viejo y aplica el nuevo si el ingreso NO
  // fue distribuido; si ya fue distribuido, solo actualiza metadata sin tocar
  // balances (la plata ya se movió vía la distribución) — Sesión J.1.13, TAREA 1.
  const { error } = await supabase.rpc("update_income_with_balance", {
    p_income_id: incomeId,
    p_amount: amount,
    p_currency: currency,
    p_type: data.type,
    p_account_id: "account_id" in data ? data.account_id : null,
    p_date: data.date,
    p_note: "note" in data ? data.note : null,
  });

  if (error) return { error: error.message };
  return {};
}

// ─── deleteIncome ─────────────────────────────────────────────────────────────
// No distribuido: revierte el crédito de account_id (Sesión J.1.13, TAREA 1).
// Distribuido: borra las savings_contributions asociadas (para que el progreso
// de metas no quede inflado) pero NO revierte los saldos de las cuentas destino
// de la distribución (irreversible: no hay registro de qué cuentas recibieron qué).

export async function deleteIncome(
  incomeId: string
): Promise<{ error?: string; wasDistributed?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // RPC atómica: si no fue distribuido, revierte el crédito de account_id
  // (consecuencia directa del fix de TAREA 1 — Sesión J.1.13); si fue
  // distribuido, borra las savings_contributions asociadas sin tocar balances.
  const { data, error } = await supabase.rpc("delete_income_with_balance", {
    p_income_id: incomeId,
  });

  if (error) return { error: error.message };
  return { wasDistributed: Boolean(data) };
}

// ─── setEmergencyFundAmount ───────────────────────────────────────────────────
// Permite setear (no sumar) el saldo actual del fondo de emergencia.
// Usado para cargar manualmente cuánto ya existe en el fondo.

export async function setEmergencyFundAmount(
  fundId: string,
  newAmount: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("funds")
    .update({ current_amount: newAmount })
    .eq("id", fundId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
