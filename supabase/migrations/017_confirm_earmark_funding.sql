-- Migración 017: RPC confirm_earmark_funding
--
-- Permite completar la transferencia de dinero para un earmark de crédito que fue
-- creado sin funding_account_id (el usuario eligió "confirmar más tarde").
--
-- Qué hace:
--   1. Valida que el earmark pertenece al usuario, está activo (released=false) y
--      tiene expense_id (es de un gasto de crédito).
--   2. Verifica que el gasto todavía no tiene funding_account_id (no se re-transfiere).
--   3. Bloquea si la cuenta origen es la misma que la cuenta de cobertura.
--   4. Bloquea si las monedas no coinciden.
--   5. Mueve el dinero: resta de la cuenta origen, suma a la cuenta de cobertura.
--   6. Actualiza expenses.funding_account_id con la cuenta elegida.
--   Todo en una sola transacción PL/pgSQL SECURITY INVOKER (RLS aplica).
--
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION confirm_earmark_funding(
  p_earmark_id       UUID,
  p_funding_account_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_amount          NUMERIC;
  v_currency        TEXT;
  v_covering_id     UUID;
  v_expense_id      UUID;
  v_covering_currency TEXT;
  v_funding_currency  TEXT;
BEGIN
  -- 1. Obtener y bloquear el earmark (FOR UPDATE previene race conditions)
  SELECT ae.amount, ae.currency, ae.account_id, ae.expense_id
  INTO v_amount, v_currency, v_covering_id, v_expense_id
  FROM account_earmarks ae
  WHERE ae.id = p_earmark_id
    AND ae.user_id = auth.uid()
    AND ae.released = false
    AND ae.expense_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada, ya liberada, o sin gasto asociado';
  END IF;

  -- 2. Verificar que el gasto todavía no tiene funding
  IF EXISTS (
    SELECT 1 FROM expenses
    WHERE id = v_expense_id
      AND user_id = auth.uid()
      AND funding_account_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'La transferencia ya fue confirmada para este gasto';
  END IF;

  -- 3. Bloquear mismo origen = destino
  IF p_funding_account_id = v_covering_id THEN
    RAISE EXCEPTION 'La cuenta origen no puede ser la misma que la cuenta de cobertura';
  END IF;

  -- 4. Verificar y bloquear cuenta de cobertura
  SELECT a.currency INTO v_covering_currency
  FROM accounts a
  WHERE a.id = v_covering_id AND a.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta de cobertura no encontrada';
  END IF;

  -- 5. Verificar y bloquear cuenta de origen
  SELECT a.currency INTO v_funding_currency
  FROM accounts a
  WHERE a.id = p_funding_account_id AND a.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta de origen no encontrada';
  END IF;

  -- 6. Verificar monedas compatibles
  IF v_funding_currency <> v_currency THEN
    RAISE EXCEPTION 'La moneda de la cuenta origen (%) no coincide con la moneda de la reserva (%)',
      v_funding_currency, v_currency;
  END IF;

  -- 7. Mover dinero: debitar origen, acreditar cobertura
  UPDATE accounts
  SET balance = balance - v_amount
  WHERE id = p_funding_account_id AND user_id = auth.uid();

  UPDATE accounts
  SET balance = balance + v_amount
  WHERE id = v_covering_id AND user_id = auth.uid();

  -- 8. Registrar el funding en el gasto
  UPDATE expenses
  SET funding_account_id = p_funding_account_id
  WHERE id = v_expense_id AND user_id = auth.uid();
END;
$$;
