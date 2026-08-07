-- Migración 023: RPC atómica para el selector de fondos (Sesión J.1.7, TAREA 2d)
--
-- El nuevo flujo en /cuentas reemplaza "elegir un holding ya creado a mano" por:
-- elegir un fondo del catálogo de la institución + ingresar el monto invertido.
-- Esto requiere crear el holding Y vincularlo a la cuenta (con sync de balance) en
-- una sola operación — dos INSERTs/UPDATEs sueltos desde el cliente dejarían un
-- holding huérfano sin vincular si el segundo paso fallara (mismo riesgo que
-- lección aprendida §14, aplicado aquí a holdings en vez de accounts).
--
-- Reutiliza la misma lógica de link_and_sync_holding (migración 021) pero partiendo
-- de un holding que todavía no existe.
--
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION create_and_link_fci_holding(
  p_account_id     UUID,
  p_name           TEXT,
  p_quantity       NUMERIC,
  p_price          NUMERIC,
  p_currency       TEXT,
  p_purchase_date  DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_holding_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'El precio debe ser mayor a 0';
  END IF;

  PERFORM 1 FROM accounts
   WHERE id = p_account_id
     AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta no encontrada o sin acceso';
  END IF;

  INSERT INTO holdings (
    user_id, account_id, name, ticker, asset_type,
    quantity, avg_buy_price, currency, current_price, purchase_date
  ) VALUES (
    auth.uid(), p_account_id, p_name, NULL, 'fci',
    p_quantity, p_price, p_currency, p_price, p_purchase_date
  )
  RETURNING id INTO v_holding_id;

  UPDATE accounts
     SET holding_id = v_holding_id,
         balance = p_quantity * p_price
   WHERE id = p_account_id
     AND user_id = auth.uid();

  RETURN v_holding_id;
END;
$$;
