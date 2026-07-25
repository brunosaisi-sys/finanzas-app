"use server";

import { createClient } from "@/lib/supabase/server";
import type { AccountType, Currency } from "@/types";

export async function updateAccount(
  accountId: string,
  data: { name: string; balance: number; type: AccountType }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Fetch current type to detect changes
  const { data: current } = await supabase
    .from("accounts")
    .select("type")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  if (!current) return { error: "Cuenta no encontrada" };

  const update: Record<string, unknown> = {
    name: data.name.trim(),
    balance: data.balance,
  };

  // Only apply type change if it actually differs
  if (data.type !== current.type) {
    const [{ count: expCount }, { count: earCount }] = await Promise.all([
      supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .or(
          `account_id.eq.${accountId},covering_account_id.eq.${accountId},funding_account_id.eq.${accountId}`
        ),
      supabase
        .from("account_earmarks")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("released", false),
    ]);
    if ((expCount ?? 0) > 0 || (earCount ?? 0) > 0) {
      return {
        error:
          "No se puede cambiar el tipo: la cuenta tiene gastos o reservas asociadas.",
      };
    }
    update.type = data.type;
  }

  const { error } = await supabase
    .from("accounts")
    .update(update)
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function convertAccountToParent(
  accountId: string,
  bolsilloName: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("convert_account_to_parent", {
    p_account_id: accountId,
    p_bolsillo_name: bolsilloName.trim() || "General",
  });

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
