"use server";

import { createClient } from "@/lib/supabase/server";

// Actualiza holding.current_price y sincroniza accounts.balance de la cuenta vinculada
// (si tiene holding_id = holdingId). Atómico vía RPC sync_holding_balance (migración 021).
export async function updateHoldingPrice(
  holdingId: string,
  price: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("sync_holding_balance", {
    p_holding_id: holdingId,
    p_new_price: price,
  });

  if (error) return { error: error.message };
  return {};
}

// Edita quantity + avg_buy_price de un holding ya cargado (Sesión J.1.13, TAREA 4
// — ej. corregir un split de CEDEAR sin borrar y recrear la posición). Atómico
// vía RPC update_holding_position: si hay una cuenta vinculada, recalcula su
// balance con la cantidad nueva (migración 025).
export async function updateHoldingPosition(
  holdingId: string,
  quantity: number,
  avgBuyPrice: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("update_holding_position", {
    p_holding_id: holdingId,
    p_quantity: quantity,
    p_avg_buy_price: avgBuyPrice,
  });

  if (error) return { error: error.message };
  return {};
}

// Elimina una posición de inversión (Sesión J.1.15, TAREA 3). Si el holding está
// vinculado a una cuenta (accounts.holding_id, migración 021 — no confundir con
// holdings.account_id, que es solo el broker/cuenta "dueña" a título informativo),
// no se permite el borrado directo: primero hay que desvincularlo desde /cuentas
// (unlink_holding_from_account) para no dejar la cuenta apuntando a un holding
// inexistente. holding_price_history tiene ON DELETE CASCADE (migración 022) — un
// DELETE simple alcanza, no mueve accounts.balance (lección §35, punto 2: DELETE
// crudo es aceptable para entidades que nunca tocan balance).
export async function deleteHolding(holdingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: linkedAccount } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("holding_id", holdingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (linkedAccount) {
    return {
      error: `Este holding está vinculado a la cuenta "${linkedAccount.name}". Desvinculalo primero desde /cuentas (botón "Desvincular") antes de poder eliminarlo.`,
    };
  }

  const { error } = await supabase
    .from("holdings")
    .delete()
    .eq("id", holdingId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
