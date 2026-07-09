"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateHoldingPrice(
  holdingId: string,
  price: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("holdings")
    .update({ current_price: price })
    .eq("id", holdingId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
