"use server";

import { createClient } from "@/lib/supabase/server";
import type { AccountType, Currency } from "@/types";

export type DepItem = {
  type: "expense" | "income" | "earmark" | "goal";
  id: string;
  label: string;
  path: string | null;
};

export async function updateAccount(
  accountId: string,
  data: { name: string; balance: number; type: AccountType; earns_yield?: boolean }
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
    ...(data.earns_yield !== undefined ? { earns_yield: data.earns_yield } : {}),
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
  data: { name: string; currency: Currency; balance: number; earns_yield?: boolean }
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
    ...(data.earns_yield !== undefined ? { earns_yield: data.earns_yield } : {}),
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
): Promise<{ error?: string; deps?: DepItem[]; overflowCount?: number }> {
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

  const depLabels: string[] = [];
  if ((expCount ?? 0) > 0)
    depLabels.push(`${expCount} gasto${expCount! > 1 ? "s" : ""}`);
  if ((earCount ?? 0) > 0)
    depLabels.push(`${earCount} reserva${earCount! > 1 ? "s" : ""} activa${earCount! > 1 ? "s" : ""}`);
  if ((incCount ?? 0) > 0)
    depLabels.push(`${incCount} ingreso${incCount! > 1 ? "s" : ""}`);
  if ((goalCount ?? 0) > 0)
    depLabels.push(`${goalCount} meta${goalCount! > 1 ? "s" : ""} de ahorro`);

  if (depLabels.length > 0) {
    const depItems: DepItem[] = [];
    let overflowCount = 0;

    // Fetch first 5 expenses with details for actionable links
    if ((expCount ?? 0) > 0) {
      const { data: expRows } = await supabase
        .from("expenses")
        .select("id, merchant, description, amount, currency, date")
        .or(
          `account_id.eq.${accountId},covering_account_id.eq.${accountId},funding_account_id.eq.${accountId}`
        )
        .order("date", { ascending: false })
        .limit(5);

      for (const e of expRows ?? []) {
        const d = new Date(e.date + "T00:00:00");
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
        const name = e.merchant || e.description || "Gasto";
        depItems.push({
          type: "expense",
          id: e.id,
          label: `${name} · $${Number(e.amount).toLocaleString("es-AR")} (${dateStr})`,
          path: `/gastos/${e.id}/editar`,
        });
      }
      if ((expCount ?? 0) > 5) overflowCount += (expCount ?? 0) - 5;
    }

    // For other dep types, add a summary item without a specific path
    if ((earCount ?? 0) > 0) {
      depItems.push({
        type: "earmark",
        id: "earmark-summary",
        label: `${earCount} reserva${earCount! > 1 ? "s" : ""} activa${earCount! > 1 ? "s" : ""} — liberalas desde la pantalla de cuotas`,
        path: "/cuotas",
      });
    }
    if ((incCount ?? 0) > 0) {
      depItems.push({
        type: "income",
        id: "income-summary",
        label: `${incCount} ingreso${incCount! > 1 ? "s" : ""} asociado${incCount! > 1 ? "s" : ""} — reasignalo${incCount! > 1 ? "s" : ""} editando el ingreso`,
        path: null,
      });
    }
    if ((goalCount ?? 0) > 0) {
      depItems.push({
        type: "goal",
        id: "goal-summary",
        label: `${goalCount} meta${goalCount! > 1 ? "s" : ""} de ahorro — archivala${goalCount! > 1 ? "s" : ""} desde /objetivos`,
        path: "/objetivos",
      });
    }

    return {
      error: `No se puede eliminar: tiene ${depLabels.join(", ")} asociados.`,
      deps: depItems,
      overflowCount: overflowCount > 0 ? overflowCount : undefined,
    };
  }

  // Clean up released earmarks before deletion — FK RESTRICT requires no earmarks remain.
  await supabase
    .from("account_earmarks")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .eq("released", true);

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

// Elimina una cuenta forzadamente, ignorando dependencias:
// - Libera y borra todos sus earmarks
// - NULLea referencias en expenses/incomes/goals/etc
// - NO revierte saldos de cuentas
// Requiere migración 019 ejecutada en Supabase.
export async function forceDeleteAccount(
  accountId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("force_delete_account", {
    p_account_id: accountId,
  });

  if (error) return { error: error.message };
  return {};
}

// ─── Holding link / unlink ────────────────────────────────────────────────────
// Migración 021: vincula/desvincula una cuenta a un holding FCI.
// Al vincular, sincroniza accounts.balance = holding.quantity × current_price (si hay precio).
// Al desvincular, el balance queda sin cambios (el último valor sincronizado).

export async function linkHoldingToAccount(
  accountId: string,
  holdingId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("link_and_sync_holding", {
    p_account_id: accountId,
    p_holding_id: holdingId,
  });

  if (error) return { error: error.message };
  return {};
}

export async function unlinkHoldingFromAccount(
  accountId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("unlink_holding_from_account", {
    p_account_id: accountId,
  });

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
