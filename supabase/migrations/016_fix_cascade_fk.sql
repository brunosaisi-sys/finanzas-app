-- Migración 016: Cambiar FKs de CASCADE a RESTRICT en accounts y account_earmarks.
--
-- Justificación:
--   La app NUNCA borra una cuenta con hijos o earmarks activos — deleteAccount y
--   safe_delete_account verifican esto en la capa de aplicación antes del DELETE.
--   Cambiar a RESTRICT agrega una red de seguridad para borrados externos (SQL directo):
--   Postgres rechaza la operación con error explícito en vez de borrar en cascada y
--   perder datos silenciosamente.
--
--   Nota sobre earmarks liberados (released=true): la app ahora los limpia
--   explícitamente antes del DELETE (ver safe_delete_account actualizado abajo,
--   y deleteAccount en cuentas/actions.ts). Con CASCADE, esto ocurría automáticamente;
--   con RESTRICT, el limpiado previo es obligatorio.
--
-- Ejecutar en Supabase SQL Editor.

-- ── 1. accounts.parent_id ──────────────────────────────────────────────────────

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_parent_id_fkey;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE RESTRICT;

-- ── 2. account_earmarks.account_id ────────────────────────────────────────────

ALTER TABLE account_earmarks DROP CONSTRAINT IF EXISTS account_earmarks_account_id_fkey;

ALTER TABLE account_earmarks
  ADD CONSTRAINT account_earmarks_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

-- ── 3. safe_delete_account actualizado ────────────────────────────────────────
-- Limpia earmarks liberados antes del DELETE para que RESTRICT no bloquee.

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

  -- Verificar dependencias (solo earmarks NO liberados bloquean el delete)
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

  -- Limpiar earmarks ya liberados (released=true) antes del DELETE.
  -- Con FK RESTRICT, cualquier earmark (liberado o no) bloquea el borrado.
  -- Los liberados ya no son útiles para la cuenta a eliminar.
  DELETE FROM account_earmarks
  WHERE account_id = p_account_id
    AND user_id = auth.uid()
    AND released = true;

  -- Eliminar la cuenta
  DELETE FROM accounts WHERE id = p_account_id AND user_id = auth.uid();
END;
$$;
