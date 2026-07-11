"use server";

import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/types";

// ─── createGoal ───────────────────────────────────────────────────────────────

interface CreateGoalInput {
  name: string;
  target_amount: number;
  currency: Currency;
  target_months: number;
  account_id: string | null;
}

export async function createGoal(
  input: CreateGoalInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("savings_goals").insert({
    user_id: user.id,
    ...input,
    start_date: new Date().toISOString().split("T")[0],
  });

  if (error) return { error: error.message };
  return {};
}

// ─── addContribution ──────────────────────────────────────────────────────────

interface AddContributionInput {
  targetKind: "asset" | "goal";
  targetId: string;
  targetName: string;       // para el reason del earmark
  amount: number;
  currency: Currency;
  fromAccountId: string | null;   // de dónde sale la plata (account_id de la contribution)
  destAccountId: string | null;   // cuenta de la meta (para el earmark)
  date: string;
  note: string | null;
}

export async function addContribution(
  input: AddContributionInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // 1. Insertar contribution
  const { error: contribError } = await supabase
    .from("savings_contributions")
    .insert({
      user_id: user.id,
      asset_id: input.targetKind === "asset" ? input.targetId : null,
      goal_id: input.targetKind === "goal" ? input.targetId : null,
      amount: input.amount,
      currency: input.currency,
      account_id: input.fromAccountId,
      income_id: null,
      date: input.date,
      note: input.note,
    });

  if (contribError) return { error: contribError.message };

  // 2. Earmark en la cuenta destino de la meta si tiene account_id.
  // release_date = NULL: los earmarks de metas se liberan manualmente.
  if (input.destAccountId) {
    const { error: earmarkError } = await supabase
      .from("account_earmarks")
      .insert({
        user_id: user.id,
        account_id: input.destAccountId,
        amount: input.amount,
        currency: input.currency,
        reason: input.targetName,
        release_date: null,
        released: false,
      });

    if (earmarkError) return { error: earmarkError.message };
  }

  return {};
}

// ─── deleteGoal ───────────────────────────────────────────────────────────────

export async function deleteGoal(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("savings_goals")
    .update({ archived: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
