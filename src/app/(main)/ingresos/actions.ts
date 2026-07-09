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

// ─── saveDistributionRule ─────────────────────────────────────────────────────

interface RuleLine {
  account_id: string | null;
  label: string;
  percentage: number;
}

export async function saveDistributionRule(
  lines: RuleLine[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Desactivar regla anterior
  await supabase
    .from("income_distribution_rules")
    .update({ active: false })
    .eq("user_id", user.id)
    .eq("active", true);

  // Insertar nueva regla
  const { data: rule, error: ruleError } = await supabase
    .from("income_distribution_rules")
    .insert({ user_id: user.id, name: "Principal", active: true })
    .select("id")
    .single();

  if (ruleError) return { error: ruleError.message };

  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from("income_distribution_lines")
      .insert(
        lines.map((l) => ({
          rule_id: rule.id,
          account_id: l.account_id,
          label: l.label,
          percentage: l.percentage,
        }))
      );
    if (linesError) return { error: linesError.message };
  }

  return {};
}

// ─── redirectToDistribute ─────────────────────────────────────────────────────
// Server Action auxiliar: solo se puede llamar desde un Server Component.
// Redirige al flujo de distribución con el ingreso_id recién creado.

export async function redirectToDistribute(incomeId: string): Promise<never> {
  redirect(`/ingresos/distribuir?ingreso_id=${incomeId}`);
}
