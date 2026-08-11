"use server";

import { createClient } from "@/lib/supabase/server";

// TAREA 8 (Sesión J.1.15): "ya me pagaron" — acredita la cuenta elegida y marca
// el participante como pagado en una sola transacción atómica (RPC
// confirm_participant_payment, migración 029). Mismo patrón que
// create_income_with_balance: mueve plata real, así que va por RPC, no por
// UPDATE suelto (a diferencia del insert de creación, que sí es best-effort
// porque no mueve plata).
export async function confirmParticipantPayment(
  participantId: string,
  accountId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("confirm_participant_payment", {
    p_participant_id: participantId,
    p_account_id: accountId,
  });

  if (error) return { error: error.message };
  return {};
}
