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
