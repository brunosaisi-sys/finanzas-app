-- Migración 021: Vincular cuentas a holdings FCI (Opción B-sync)
--
-- El balance de accounts.balance sigue siendo el campo almacenado y la fuente de
-- verdad para todos los RPCs de earmark. La novedad es:
--   1. accounts.holding_id FK opcional → holdings(id)
--   2. Cuando se actualiza holding.current_price → accounts.balance se sincroniza
--      atómicamente vía sync_holding_balance (no cambia earmark RPCs existentes)
--
-- Ejecutar en Supabase SQL Editor.

-- ─── Columna holding_id en accounts ──────────────────────────────────────────

ALTER TABLE accounts
  ADD COLUMN holding_id UUID REFERENCES holdings(id) ON DELETE SET NULL;

-- Índice para lookup inverso: "¿qué cuenta está vinculada a este holding?"
CREATE INDEX idx_accounts_holding_id
  ON accounts(holding_id)
  WHERE holding_id IS NOT NULL;

-- ─── RPC: sync_holding_balance ────────────────────────────────────────────────
-- Actualiza holding.current_price y, si hay una cuenta vinculada, sincroniza
-- accounts.balance = holding.quantity × new_price en una sola transacción.
-- Reemplaza el UPDATE directo que hacía inversiones/actions.ts:updateHoldingPrice.

CREATE OR REPLACE FUNCTION sync_holding_balance(
  p_holding_id UUID,
  p_new_price   NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_quantity NUMERIC;
BEGIN
  SELECT quantity INTO v_quantity
    FROM holdings
   WHERE id = p_holding_id
     AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holding no encontrado o sin acceso';
  END IF;

  UPDATE holdings
     SET current_price = p_new_price
   WHERE id = p_holding_id
     AND user_id = auth.uid();

  -- Sync linked account balance if any account points to this holding
  UPDATE accounts
     SET balance = v_quantity * p_new_price
   WHERE holding_id = p_holding_id
     AND user_id = auth.uid();
END;
$$;

-- ─── RPC: link_and_sync_holding ──────────────────────────────────────────────
-- Vincula una cuenta a un holding y sincroniza el balance si el holding tiene precio.
-- Idempotente: se puede llamar varias veces con el mismo par (account, holding).

CREATE OR REPLACE FUNCTION link_and_sync_holding(
  p_account_id UUID,
  p_holding_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_quantity NUMERIC;
  v_price    NUMERIC;
BEGIN
  SELECT quantity, current_price INTO v_quantity, v_price
    FROM holdings
   WHERE id = p_holding_id
     AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holding no encontrado o sin acceso';
  END IF;

  UPDATE accounts
     SET holding_id = p_holding_id
   WHERE id = p_account_id
     AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta no encontrada o sin acceso';
  END IF;

  IF v_price IS NOT NULL THEN
    UPDATE accounts
       SET balance = v_quantity * v_price
     WHERE id = p_account_id
       AND user_id = auth.uid();
  END IF;
END;
$$;

-- ─── RPC: unlink_holding_from_account ────────────────────────────────────────
-- Desvincula la cuenta del holding. El balance queda como el último valor
-- sincronizado (no se resetea).

CREATE OR REPLACE FUNCTION unlink_holding_from_account(
  p_account_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE accounts
     SET holding_id = NULL
   WHERE id = p_account_id
     AND user_id = auth.uid();
END;
$$;
