"use server";

import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/types";

export async function updateAccountBalance(
  accountId: string,
  balance: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("accounts")
    .update({ balance })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteAccount(
  accountId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function createTransfer(input: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: Currency;
  date: string;
  note: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  if (input.from_account_id === input.to_account_id) {
    return { error: "La cuenta origen y destino no pueden ser la misma" };
  }

  const { error } = await supabase.rpc("execute_account_transfer", {
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_amount: input.amount,
    p_currency: input.currency,
    p_date: input.date,
    p_note: input.note,
  });

  if (error) return { error: error.message };
  return {};
}
