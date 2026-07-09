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

// ─── redirectToDistribute ─────────────────────────────────────────────────────

export async function redirectToDistribute(incomeId: string): Promise<never> {
  redirect(`/ingresos/distribuir?ingreso_id=${incomeId}`);
}
