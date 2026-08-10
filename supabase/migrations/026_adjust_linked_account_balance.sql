-- Migración 026: ajuste de balance para cuentas vinculadas a un holding (Sesión J.1.14, TAREA 2)
--
-- Problema: accounts.balance = quantity × current_price es una invariante mantenida
-- SOLO cuando el cambio viene desde el holding (sync_holding_balance, migración 021,
-- y update_holding_position, migración 025). Pero el balance de una cuenta con
-- holding_id también podía editarse a mano (CuentaActions → updateAccount) con un
-- UPDATE directo — eso rompe la invariante: el holding vinculado (y por lo tanto
-- /inversiones) nunca se entera del cambio.
--
-- Alcance de esta migración (decisión de diseño documentada en CLAUDE.md, TAREA 2):
-- se centraliza SOLO el camino de edición manual de saldo (el bug reportado por el
-- usuario). Los otros caminos que pueden mover balance de una cuenta vinculada
-- (crédito de un ingreso — migración 024, earmark funding — migración 017) quedan
-- documentados como pendientes para la próxima sesión, no tocados acá: son RPCs de
-- movimiento de dinero ya verificadas en sesiones anteriores y modificarlas de forma
-- apurada en la misma sesión que otras 7 tareas es más riesgo que valor. Ver
-- docs/lecciones-aprendidas.md §32.
--
-- Diseño (TAREA 2a del brief): un incremento de balance en una cuenta con holding
-- vinculado se interpreta como "compra" de más unidades al precio actual
-- (delta_balance / current_price = unidades nuevas); un decremento, simétricamente,
-- resta unidades. Si no hay precio cargado en el holding, no hay forma segura de
-- convertir plata en unidades — se rechaza la edición con un mensaje explícito en
-- vez de romper la invariante o adivinar un precio.
--
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION adjust_linked_account_balance(
  p_account_id  UUID,
  p_new_balance NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_balance     NUMERIC;
  v_holding_id  UUID;
  v_delta       NUMERIC;
  v_price       NUMERIC;
  v_quantity    NUMERIC;
  v_new_qty     NUMERIC;
BEGIN
  SELECT balance, holding_id INTO v_balance, v_holding_id
  FROM accounts
  WHERE id = p_account_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta no encontrada o sin acceso';
  END IF;

  v_delta := p_new_balance - v_balance;

  -- Sin holding vinculado, o sin cambio real: comportamiento simple de siempre.
  IF v_holding_id IS NULL OR v_delta = 0 THEN
    UPDATE accounts SET balance = p_new_balance WHERE id = p_account_id;
    RETURN;
  END IF;

  SELECT quantity, current_price INTO v_quantity, v_price
  FROM holdings
  WHERE id = v_holding_id
  FOR UPDATE;

  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'Esta cuenta está vinculada a un holding sin precio cargado todavía. Cargá el precio en /inversiones antes de editar el saldo a mano.';
  END IF;

  v_new_qty := v_quantity + (v_delta / v_price);

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'El saldo nuevo implicaría una cantidad negativa de unidades del holding vinculado. Ajustá la cantidad directamente en /inversiones.';
  END IF;

  UPDATE holdings SET quantity = v_new_qty WHERE id = v_holding_id;
  -- balance derivado de la cantidad nueva × precio (no p_new_balance directamente)
  -- para que quede exactamente alineado con la invariante quantity × current_price,
  -- igual que sync_holding_balance / update_holding_position.
  UPDATE accounts SET balance = v_new_qty * v_price WHERE id = p_account_id;
END;
$$;
