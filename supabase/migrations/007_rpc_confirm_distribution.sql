-- Migración 007: función RPC para distribuir ingreso de forma atómica
-- Todos los updates de balance ocurren en una sola transacción PL/pgSQL.
-- Si cualquier step falla, PostgreSQL hace rollback automático.
-- SECURITY INVOKER: corre como el usuario autenticado; RLS aplica normalmente.

CREATE OR REPLACE FUNCTION confirm_income_distribution(
  p_income_id UUID,
  p_lines     JSONB   -- array de {account_id, amount}
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_line        JSONB;
  v_distributed BOOLEAN;
BEGIN
  -- 1. Verificar ownership + estado (RLS de incomes filtra por auth.uid())
  SELECT distributed INTO v_distributed
  FROM incomes
  WHERE id = p_income_id;

  IF v_distributed IS NULL THEN
    RAISE EXCEPTION 'Ingreso no encontrado o sin permisos';
  END IF;

  IF v_distributed THEN
    RAISE EXCEPTION 'Este ingreso ya fue distribuido';
  END IF;

  -- 2. Actualizar cada balance (RLS de accounts filtra por auth.uid())
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS value
  LOOP
    UPDATE accounts
    SET balance = balance + (v_line->>'amount')::NUMERIC
    WHERE id = (v_line->>'account_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cuenta % no encontrada', (v_line->>'account_id');
    END IF;
  END LOOP;

  -- 3. Marcar como distribuido — solo llega acá si todo lo anterior fue OK
  UPDATE incomes SET distributed = true WHERE id = p_income_id;
END;
$$;
