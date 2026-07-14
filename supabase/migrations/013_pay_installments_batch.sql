-- Migration 013: RPC pay_installments_batch
-- Paga múltiples cuotas en una sola transacción atómica.
-- Si cualquier cuota falla, todas se revierten.

CREATE OR REPLACE FUNCTION pay_installments_batch(
  p_installment_ids UUID[],
  p_account_id      UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_id UUID;
BEGIN
  FOREACH v_id IN ARRAY p_installment_ids LOOP
    PERFORM pay_installment(v_id, p_account_id);
  END LOOP;
END;
$$;
