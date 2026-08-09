-- Migración 025: editar cantidad y precio de compra de un holding ya cargado
-- Sesión J.1.13, TAREA 4.
--
-- Caso real: split de CEDEAR (SPY, BYMA 20:1→60:1) — el usuario necesita corregir
-- quantity/avg_buy_price sin borrar y recrear la posición. Hasta ahora solo se
-- podía editar current_price (updateHoldingPrice / sync_holding_balance).
--
-- accounts.balance = holding.quantity × holding.current_price para toda cuenta
-- vinculada (holding_id), invariante establecida en la migración 021. Cambiar
-- quantity por fuera de un RPC atómico dejaría ese balance desincronizado hasta
-- el próximo cambio de precio — por eso, igual que sync_holding_balance, esto
-- va en una RPC SECURITY INVOKER.
--
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION update_holding_position(
  p_holding_id     UUID,
  p_quantity       NUMERIC,
  p_avg_buy_price  NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_price NUMERIC;
BEGIN
  SELECT current_price INTO v_current_price
    FROM holdings
   WHERE id = p_holding_id
     AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holding no encontrado o sin acceso';
  END IF;

  UPDATE holdings
     SET quantity = p_quantity,
         avg_buy_price = p_avg_buy_price
   WHERE id = p_holding_id
     AND user_id = auth.uid();

  -- Recalcular balance de la cuenta vinculada (si hay) con la cantidad nueva.
  -- avg_buy_price no afecta balance (es costo de compra, no valor de mercado).
  IF v_current_price IS NOT NULL THEN
    UPDATE accounts
       SET balance = p_quantity * v_current_price
     WHERE holding_id = p_holding_id
       AND user_id = auth.uid();
  END IF;
END;
$$;
