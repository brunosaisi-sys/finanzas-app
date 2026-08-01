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
