"use server";

import { createClient } from "@/lib/supabase/server";

interface AssetInput {
  name: string;
  category: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency: "ARS" | "USD";
  replacement_cost: number | null;
  current_value: number | null;
  useful_life_months: number | null;
  residual_pct: number | null;
  maintenance_pct_annual: number | null;
  interest_rate_monthly: number;
  replacement_horizon_months?: number | null;
  car_segment?: string | null;
  bought_used?: boolean | null;
  savings_goal_mode?: string | null;
  savings_goal_amount?: number | null;
  savings_goal_months?: number | null;
}

export async function createAsset(
  input: AssetInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("assets").insert({
    user_id: user.id,
    ...input,
  });

  if (error) return { error: error.message };
  return {};
}

export async function updateAsset(
  id: string,
  input: AssetInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("assets")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteAsset(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
