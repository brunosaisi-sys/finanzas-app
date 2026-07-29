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

  const { data, error } = await supabase
    .from("incomes")
    .insert({
      user_id: user.id,
      amount: input.amount,
      currency: input.currency,
      type: input.type,
      account_id: input.account_id,
      date: input.date,
      note: input.note,
      distributed: false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
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

  const update: Record<string, unknown> = {};
  if (data.amount !== undefined) update.amount = data.amount;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.type !== undefined) update.type = data.type;
  if ("account_id" in data) update.account_id = data.account_id;
  if (data.date !== undefined) update.date = data.date;
  if ("note" in data) update.note = data.note;

  const { error } = await supabase
    .from("incomes")
    .update(update)
    .eq("id", incomeId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

// ─── deleteIncome ─────────────────────────────────────────────────────────────
// Para ingresos distribuidos: borra las savings_contributions asociadas (para que el
// progreso de metas no quede inflado) pero NO revierte los saldos de cuentas
// (irreversible: no hay registro de qué cuentas recibieron qué).

export async function deleteIncome(
  incomeId: string
): Promise<{ error?: string; wasDistributed?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: income } = await supabase
    .from("incomes")
    .select("id, distributed")
    .eq("id", incomeId)
    .eq("user_id", user.id)
    .single();

  if (!income) return { error: "Ingreso no encontrado" };

  const wasDistributed = Boolean(income.distributed);

  if (wasDistributed) {
    // Borrar contributions asociadas para que no queden como progreso de metas
    await supabase
      .from("savings_contributions")
      .delete()
      .eq("income_id", incomeId)
      .eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("incomes")
    .delete()
    .eq("id", incomeId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { wasDistributed };
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
