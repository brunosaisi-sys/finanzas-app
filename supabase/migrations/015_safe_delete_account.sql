-- Migración 015: RPC para eliminar una cuenta con validación atómica de dependencias.
-- Verifica que no existan subcuentas ni dependencias antes de borrar.
-- SECURITY INVOKER — RLS aplica normalmente.
-- PENDIENTE de ejecutar en Supabase SQL Editor.
--
-- Esta RPC hace la validación y el borrado en una sola transacción PL/pgSQL,
-- eliminando la ventana de race condition del check-then-delete en JS.

CREATE OR REPLACE FUNCTION safe_delete_account(
  p_account_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_child_count   INTEGER;
  v_exp_count     INTEGER;
  v_ear_count     INTEGER;
  v_inc_count     INTEGER;
  v_goal_count    INTEGER;
  v_deps_msg      TEXT := '';
BEGIN
  -- Verificar propiedad via RLS (FOR UPDATE bloquea contra race conditions)
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = p_account_id AND user_id = auth.uid()
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Cuenta no encontrada o no autorizado';
  END IF;

  -- Verificar que no tiene hijos directos
  SELECT COUNT(*) INTO v_child_count
  FROM accounts
  WHERE parent_id = p_account_id;

  IF v_child_count > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar: tiene % subcuenta% activa%. Eliminá las subcuentas primero.',
      v_child_count,
      CASE WHEN v_child_count = 1 THEN '' ELSE 's' END,
      CASE WHEN v_child_count = 1 THEN '' ELSE 's' END;
  END IF;

  -- Verificar dependencias
  SELECT COUNT(*) INTO v_exp_count
  FROM expenses
  WHERE user_id = auth.uid()
    AND (account_id = p_account_id
         OR covering_account_id = p_account_id
         OR funding_account_id = p_account_id);

  SELECT COUNT(*) INTO v_ear_count
  FROM account_earmarks
  WHERE user_id = auth.uid()
    AND account_id = p_account_id
    AND released = false;

  SELECT COUNT(*) INTO v_inc_count
  FROM incomes
  WHERE user_id = auth.uid()
    AND account_id = p_account_id;

  SELECT COUNT(*) INTO v_goal_count
  FROM savings_goals
  WHERE user_id = auth.uid()
    AND account_id = p_account_id
    AND archived = false;

  IF v_exp_count > 0 THEN
    v_deps_msg := v_deps_msg || v_exp_count || ' gasto' ||
      CASE WHEN v_exp_count > 1 THEN 's' ELSE '' END || ', ';
  END IF;
  IF v_ear_count > 0 THEN
    v_deps_msg := v_deps_msg || v_ear_count || ' reserva' ||
      CASE WHEN v_ear_count > 1 THEN 's activas' ELSE ' activa' END || ', ';
  END IF;
  IF v_inc_count > 0 THEN
    v_deps_msg := v_deps_msg || v_inc_count || ' ingreso' ||
      CASE WHEN v_inc_count > 1 THEN 's' ELSE '' END || ', ';
  END IF;
  IF v_goal_count > 0 THEN
    v_deps_msg := v_deps_msg || v_goal_count || ' meta' ||
      CASE WHEN v_goal_count > 1 THEN 's de ahorro' ELSE ' de ahorro' END || ', ';
  END IF;

  IF v_deps_msg <> '' THEN
    v_deps_msg := rtrim(v_deps_msg, ', ');
    RAISE EXCEPTION 'No se puede eliminar: la cuenta tiene % asociados. Reasigná o eliminá esos registros primero.',
      v_deps_msg;
  END IF;

  -- Eliminar
  DELETE FROM accounts WHERE id = p_account_id AND user_id = auth.uid();
END;
$$;
