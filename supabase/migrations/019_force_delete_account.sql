-- Migración 019: RPC force_delete_account
-- Elimina una cuenta incluso si tiene dependencias:
--   - Libera y borra todos sus earmarks (activos y ya liberados).
--   - NULLea referencias en expenses, incomes, savings_goals, savings_contributions,
--     assets, income_distribution_lines (defensivo: algunos FK pueden no estar activos en prod).
--   - Bloquea si la cuenta tiene subcuentas (deben borrarse primero — no forzamos eso).
-- IMPORTANTE: los saldos de cuentas NO se revierten; el usuario acepta esta consecuencia.

CREATE OR REPLACE FUNCTION force_delete_account(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- Verificar propiedad y lockear la fila
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = p_account_id AND user_id = v_user_id
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Cuenta no encontrada o no autorizada';
  END IF;

  -- Bloquear si tiene subcuentas (deben borrarse explícitamente primero)
  IF EXISTS (
    SELECT 1 FROM accounts WHERE parent_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'La cuenta tiene subcuentas. Eliminá las subcuentas primero.';
  END IF;

  -- Borrar todos los earmarks de esta cuenta (activos y liberados)
  -- La FK accounts.account_id en account_earmarks es RESTRICT, hay que limpiarla antes.
  DELETE FROM account_earmarks
  WHERE account_id = p_account_id AND user_id = v_user_id;

  -- NULLear referencias en expenses (defensivo, FK puede no estar activa en prod)
  UPDATE expenses SET account_id = NULL
  WHERE account_id = p_account_id AND user_id = v_user_id;

  UPDATE expenses SET covering_account_id = NULL
  WHERE covering_account_id = p_account_id AND user_id = v_user_id;

  UPDATE expenses SET funding_account_id = NULL
  WHERE funding_account_id = p_account_id AND user_id = v_user_id;

  -- NULLear referencias en incomes
  UPDATE incomes SET account_id = NULL
  WHERE account_id = p_account_id AND user_id = v_user_id;

  -- NULLear referencias en savings_goals
  UPDATE savings_goals SET account_id = NULL
  WHERE account_id = p_account_id AND user_id = v_user_id;

  -- NULLear referencias en savings_contributions
  UPDATE savings_contributions SET account_id = NULL
  WHERE account_id = p_account_id AND user_id = v_user_id;

  -- NULLear referencias en assets
  UPDATE assets SET account_id = NULL
  WHERE account_id = p_account_id AND user_id = v_user_id;

  -- NULLear referencias en income_distribution_lines (reglas de distribución)
  UPDATE income_distribution_lines SET account_id = NULL
  WHERE account_id = p_account_id;

  -- Eliminar la cuenta
  DELETE FROM accounts
  WHERE id = p_account_id AND user_id = v_user_id;
END;
$$;
