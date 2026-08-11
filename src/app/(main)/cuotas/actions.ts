"use server";

import { createClient } from "@/lib/supabase/server";

export async function payInstallment(
  installmentId: string,
  accountId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("pay_installment", {
    p_installment_id: installmentId,
    p_account_id: accountId ?? null,
  });

  if (error) return { error: error.message };
  return {};
}

export async function payInstallmentsBatch(
  installmentIds: string[],
  accountId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("pay_installments_batch", {
    p_installment_ids: installmentIds,
    p_account_id: accountId ?? null,
  });

  if (error) return { error: error.message };
  return {};
}

export async function payInstallmentsWithConversion(
  installmentIds: string[],
  sourceAccountId: string,
  mepRate: number | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("pay_installments_with_conversion", {
    p_installment_ids: installmentIds,
    p_source_account_id: sourceAccountId,
    p_mep_rate: mepRate,
  });

  if (error) return { error: error.message };
  return {};
}

export async function confirmEarmarkFunding(
  earmarkId: string,
  fundingAccountId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("confirm_earmark_funding", {
    p_earmark_id: earmarkId,
    p_funding_account_id: fundingAccountId,
  });

  if (error) return { error: error.message };
  return {};
}
