-- Tabla de transferencias entre cuentas
-- Corrida: manual en Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS account_transfers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts(id),
  to_account_id   UUID NOT NULL REFERENCES accounts(id),
  amount        NUMERIC NOT NULL CHECK (amount > 0),
  currency      TEXT NOT NULL DEFAULT 'ARS',
  date          DATE NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own transfers"
  ON account_transfers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC atómica: mueve el dinero y registra la transferencia en una transacción
CREATE OR REPLACE FUNCTION execute_account_transfer(
  p_from_account_id UUID,
  p_to_account_id   UUID,
  p_amount          NUMERIC,
  p_currency        TEXT,
  p_date            DATE,
  p_note            TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Debitar cuenta origen
  UPDATE accounts
    SET balance = balance - p_amount
    WHERE id = p_from_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta origen no encontrada o sin permisos';
  END IF;

  -- Acreditar cuenta destino
  UPDATE accounts
    SET balance = balance + p_amount
    WHERE id = p_to_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta destino no encontrada o sin permisos';
  END IF;

  -- Registrar la transferencia
  INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, currency, date, note)
  VALUES (auth.uid(), p_from_account_id, p_to_account_id, p_amount, p_currency, p_date, p_note);
END;
$$;
