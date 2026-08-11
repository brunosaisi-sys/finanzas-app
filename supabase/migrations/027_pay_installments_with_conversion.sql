-- Migración 027: pagar cuotas de tarjeta en varias monedas con una sola cuenta de
-- origen, convirtiendo al dólar MEP (Sesión J.1.15, TAREA 1)
--
-- Problema: si una tarjeta tiene cuotas pendientes en ARS y en USD en el mismo
-- vencimiento, hoy solo se puede pagar cada moneda con una cuenta de esa misma
-- moneda por separado — pay_installments_batch (migración 013) delega en
-- pay_installment por cada id con la MISMA cuenta elegida para todas, sin ninguna
-- conversión: si la moneda de la cuota no coincide con la de la cuenta, se
-- descontaría el monto crudo (ej. "200" USD descontados como "200" ARS) — un bug
-- de integridad de plata si alguna vez se intentara, no solo una limitación de UX.
--
-- Alcance: esta función es un camino ALTERNATIVO, no reemplaza pay_installment ni
-- pay_installments_batch (que siguen intactas y se siguen usando tal cual cuando el
-- usuario paga cada moneda por separado — ver CuentaActions/BatchPayButton). Cuando
-- la cuota tiene covering_account_id propio (earmark ya reservado en la moneda
-- correcta desde su creación) o cuando la moneda de la cuota ya coincide con la de
-- la cuenta de origen elegida, se delega 100% en pay_installment (ya verificada,
-- no se reimplementa esa lógica — mismo criterio de "más riesgo que valor" de
-- TAREA 2 / lección §32). Solo el caso nuevo (cuota sin cobertura propia, moneda
-- distinta a la cuenta de origen) usa conversión MEP explícita.
--
-- Debitar la cuenta de origen es holding-aware (mismo criterio que
-- adjust_linked_account_balance, migración 026): si la cuenta de origen tiene un
-- holding vinculado, el delta se interpreta como compra/venta de unidades al precio
-- vigente, no un UPDATE directo de balance — para no introducir una instancia nueva
-- del gap documentado en lección §32 en código escrito hoy.
--
-- Atómico: todas las cuotas se marcan pagadas y el balance se descuenta en una sola
-- transacción PL/pgSQL — si cualquiera falla (ej. falta la tasa MEP), rollback total.
--
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION pay_installments_with_conversion(
  p_installment_ids UUID[],
  p_source_account_id UUID,
  p_mep_rate NUMERIC DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_id              UUID;
  v_source_currency TEXT;
  v_source_holding  UUID;
  v_inst_currency   TEXT;
  v_inst_amount     NUMERIC;
  v_covering        UUID;
  v_debit           NUMERIC;
  v_h_price         NUMERIC;
  v_h_qty           NUMERIC;
BEGIN
  SELECT currency, holding_id INTO v_source_currency, v_source_holding
  FROM accounts
  WHERE id = p_source_account_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta de origen no encontrada o sin acceso';
  END IF;

  FOREACH v_id IN ARRAY p_installment_ids LOOP
    SELECT i.amount, e.currency, e.covering_account_id
    INTO v_inst_amount, v_inst_currency, v_covering
    FROM installments i
    JOIN expenses e ON e.id = i.expense_id
    WHERE i.id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cuota % no encontrada o sin acceso', v_id;
    END IF;

    -- Con cuenta cubriente propia, o misma moneda que la cuenta de origen: sin
    -- conversión — delegar 100% en pay_installment (earmarks, marcado de pagada,
    -- todo el comportamiento ya verificado, sin reimplementar nada).
    IF v_covering IS NOT NULL OR v_inst_currency = v_source_currency THEN
      PERFORM pay_installment(v_id, p_source_account_id);
      CONTINUE;
    END IF;

    -- Moneda distinta y sin cobertura propia: convertir al MEP.
    IF p_mep_rate IS NULL OR p_mep_rate <= 0 THEN
      RAISE EXCEPTION 'Falta el tipo de cambio MEP para convertir cuotas en %', v_inst_currency;
    END IF;

    IF v_source_currency = 'ARS' AND v_inst_currency = 'USD' THEN
      v_debit := v_inst_amount * p_mep_rate;
    ELSIF v_source_currency = 'USD' AND v_inst_currency = 'ARS' THEN
      v_debit := v_inst_amount / p_mep_rate;
    ELSE
      RAISE EXCEPTION 'Conversión no soportada: % a %', v_inst_currency, v_source_currency;
    END IF;

    IF v_source_holding IS NOT NULL THEN
      SELECT quantity, current_price INTO v_h_qty, v_h_price
      FROM holdings
      WHERE id = v_source_holding
      FOR UPDATE;

      IF v_h_price IS NULL OR v_h_price <= 0 THEN
        RAISE EXCEPTION 'La cuenta de origen está vinculada a un holding sin precio cargado todavía';
      END IF;

      v_h_qty := v_h_qty - (v_debit / v_h_price);
      IF v_h_qty < 0 THEN
        RAISE EXCEPTION 'Saldo insuficiente en la cuenta de origen vinculada para esta conversión';
      END IF;

      UPDATE holdings SET quantity = v_h_qty WHERE id = v_source_holding;
      UPDATE accounts SET balance = v_h_qty * v_h_price WHERE id = p_source_account_id;
    ELSE
      UPDATE accounts SET balance = balance - v_debit
      WHERE id = p_source_account_id AND user_id = auth.uid();
    END IF;

    UPDATE installments SET paid = true, paid_date = CURRENT_DATE WHERE id = v_id;
  END LOOP;
END;
$$;
