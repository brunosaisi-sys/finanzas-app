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

// Crea un bolsillo hijo en una cuenta que ya tiene hijos (INSERT directo, no RPC).
// Para el primer bolsillo de una cuenta simple, usar convertAccountToParent en su lugar.
export async function createChildAccount(
  parentId: string,
  data: { name: string; currency: Currency; balance: number }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Fetch parent to inherit type and verify ownership
  const { data: parent } = await supabase
    .from("accounts")
    .select("id, type, user_id")
    .eq("id", parentId)
    .eq("user_id", user.id)
    .single();

  if (!parent) return { error: "Cuenta padre no encontrada" };

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: data.name.trim(),
    type: parent.type,
    currency: data.currency,
    balance: data.balance,
    parent_id: parentId,
  });

  if (error) return { error: error.message };
  return {};
}

// Elimina una cuenta con pre-chequeo de seguridad.
// Bloquea si la cuenta tiene:
//   - hijos activos (deben eliminarse primero)
//   - gastos, earmarks, ingresos o metas de ahorro asociadas
export async function deleteAccount(
  accountId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Fetch all user accounts to walk the descendant tree
  const { data: allAccounts } = await supabase
    .from("accounts")
    .select("id, parent_id, name")
    .eq("user_id", user.id);

  if (!allAccounts) return { error: "Error al verificar dependencias" };

  // BFS to collect all descendant IDs (not including the node itself)
  const childIds: string[] = [];
  const queue = allAccounts
    .filter((a) => a.parent_id === accountId)
    .map((a) => a.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    childIds.push(current);
    const grandchildren = allAccounts
      .filter((a) => a.parent_id === current)
      .map((a) => a.id);
    queue.push(...grandchildren);
  }

  if (childIds.length > 0) {
    return {
      error: `No se puede eliminar: tiene ${childIds.length} subcuenta${childIds.length !== 1 ? "s" : ""} activa${childIds.length !== 1 ? "s" : ""}. Eliminá las subcuentas primero.`,
    };
  }

  // Check dependencies on this specific account
  const [
    { count: expCount },
    { count: earCount },
    { count: incCount },
    { count: goalCount },
  ] = await Promise.all([
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
    supabase
      .from("incomes")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId),
    supabase
      .from("savings_goals")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("archived", false),
  ]);

  const deps: string[] = [];
  if ((expCount ?? 0) > 0)
    deps.push(`${expCount} gasto${expCount! > 1 ? "s" : ""}`);
  if ((earCount ?? 0) > 0)
    deps.push(`${earCount} reserva${earCount! > 1 ? "s" : ""} activa${earCount! > 1 ? "s" : ""}`);
  if ((incCount ?? 0) > 0)
    deps.push(`${incCount} ingreso${incCount! > 1 ? "s" : ""}`);
  if ((goalCount ?? 0) > 0)
    deps.push(`${goalCount} meta${goalCount! > 1 ? "s" : ""} de ahorro`);

  if (deps.length > 0) {
    return {
      error: `No se puede eliminar: la cuenta tiene ${deps.join(", ")} asociados. Reasigná o eliminá esos registros primero.`,
    };
  }

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
