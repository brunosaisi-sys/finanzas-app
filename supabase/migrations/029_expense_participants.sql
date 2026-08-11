-- Migración 029: gastos compartidos (TAREA 8, diseño decidido en Sesión J.1.14,
-- implementado en Sesión J.1.15).
--
-- Modelo: el usuario paga el monto TOTAL del gasto (sin cambios a `expenses` — la
-- plata ya salió completa de su cuenta, como cualquier gasto hoy). Cada fila de
-- `expense_participants` es UNA persona que le debe una parte de ese gasto al
-- usuario — la parte del usuario mismo nunca se guarda como fila (implícita:
-- expense.amount − Σ(participants.amount)). Sin columna `currency` propia — se lee
-- siempre de expenses.currency vía join (un gasto compartido nunca tiene una
-- moneda distinta a la del gasto padre). Sin columna nueva en `expenses` — la
-- existencia de filas en expense_participants ES la señal de "es compartido".
--
-- RLS vía EXISTS a expenses.user_id (mismo patrón que holding_price_history/
-- fund_transactions — no tiene user_id propio).
--
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE expense_participants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id         UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  amount             NUMERIC NOT NULL CHECK (amount > 0),
  paid               BOOLEAN NOT NULL DEFAULT false,
  paid_date          DATE,
  deposit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_participants_expense_id ON expense_participants(expense_id);

ALTER TABLE expense_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own via expense" ON expense_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND e.user_id = auth.uid())
  );

CREATE POLICY "insert own via expense" ON expense_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND e.user_id = auth.uid())
  );

CREATE POLICY "update own via expense" ON expense_participants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND e.user_id = auth.uid())
  );

CREATE POLICY "delete own via expense" ON expense_participants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND e.user_id = auth.uid())
  );

-- Flujo "ya me pagaron" (9d del diseño): acredita la cuenta elegida y marca el
-- participante como pagado, en una sola transacción atómica — mismo patrón que
-- create_income_with_balance (migración 024). Holding-aware vía apply_balance_delta
-- (migración 028), consistente con el resto de los caminos que acreditan cuentas.
CREATE OR REPLACE FUNCTION confirm_participant_payment(
  p_participant_id UUID,
  p_account_id     UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_amt  NUMERIC;
  v_paid BOOLEAN;
BEGIN
  SELECT ep.amount, ep.paid INTO v_amt, v_paid
  FROM expense_participants ep
  JOIN expenses e ON e.id = ep.expense_id
  WHERE ep.id = p_participant_id AND e.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participante no encontrado o sin permisos';
  END IF;

  IF v_paid THEN
    RAISE EXCEPTION 'Este participante ya fue marcado como pagado';
  END IF;

  PERFORM apply_balance_delta(p_account_id, v_amt);

  UPDATE expense_participants
  SET paid = true, paid_date = CURRENT_DATE, deposit_account_id = p_account_id
  WHERE id = p_participant_id;
END;
$$;
