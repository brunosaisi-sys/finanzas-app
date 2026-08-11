-- Migración 028: TAREA 2 pendiente de Sesión J.1.14 — extender la invariante
-- accounts.balance = holdings.quantity × holdings.current_price (migración 021) a
-- los dos caminos que quedaron documentados como pendientes en lección §32: crédito
-- de un ingreso (migración 024) y earmark funding (migración 017). Sesión J.1.15,
-- TAREA 2.
--
-- Problema (lección §32): cualquier UPDATE directo de accounts.balance en una
-- cuenta con holding_id no NULL rompe la invariante silenciosamente — el holding
-- vinculado (y por lo tanto /inversiones) nunca se entera del cambio. La migración
-- 026 centralizó esto SOLO para la edición manual de saldo. Esta migración adopta
-- la ruta centralizada que la lección §32 dejó como pregunta abierta: una única
-- función `apply_balance_delta` que interpreta cualquier delta de balance sobre una
-- cuenta con holding vinculado como compra/venta de unidades al precio vigente, y
-- que TODAS las funciones de esta migración usan en vez de tocar accounts.balance
-- directo. Mismas reglas que adjust_linked_account_balance (migración 026): si el
-- holding no tiene precio cargado, o el delta implicaría cantidad negativa, se
-- rechaza con una excepción explícita en vez de adivinar o romper la invariante.
--
-- Ejecutar en Supabase SQL Editor (requiere rol postgres/service_role — ver
-- docs/lecciones-aprendidas.md §9).

-- ─── 0. apply_balance_delta — helper centralizado, holding-aware ──────────────

CREATE OR REPLACE FUNCTION apply_balance_delta(
  p_account_id UUID,
  p_delta      NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_holding_id UUID;
  v_price      NUMERIC;
  v_qty        NUMERIC;
  v_new_qty    NUMERIC;
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  SELECT holding_id INTO v_holding_id
  FROM accounts
  WHERE id = p_account_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta % no encontrada o sin permisos', p_account_id;
  END IF;

  IF v_holding_id IS NULL THEN
    UPDATE accounts SET balance = balance + p_delta
    WHERE id = p_account_id AND user_id = auth.uid();
    RETURN;
  END IF;

  SELECT quantity, current_price INTO v_qty, v_price
  FROM holdings
  WHERE id = v_holding_id
  FOR UPDATE;

  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'La cuenta % está vinculada a un holding sin precio cargado todavía', p_account_id;
  END IF;

  v_new_qty := v_qty + (p_delta / v_price);

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'El movimiento dejaría una cantidad negativa de unidades en el holding vinculado a la cuenta %', p_account_id;
  END IF;

  UPDATE holdings SET quantity = v_new_qty WHERE id = v_holding_id;
  UPDATE accounts SET balance = v_new_qty * v_price WHERE id = p_account_id;
END;
$$;

-- ─── 1. create_income_with_balance ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_income_with_balance(
  p_amount     NUMERIC,
  p_currency   TEXT,
  p_type       TEXT,
  p_account_id UUID,
  p_date       DATE,
  p_note       TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_income_id UUID;
BEGIN
  INSERT INTO incomes (user_id, amount, currency, type, account_id, date, note, distributed)
  VALUES (auth.uid(), p_amount, p_currency, p_type, p_account_id, p_date, p_note, false)
  RETURNING id INTO v_income_id;

  IF p_account_id IS NOT NULL THEN
    PERFORM apply_balance_delta(p_account_id, p_amount);
  END IF;

  RETURN v_income_id;
END;
$$;

-- ─── 2. update_income_with_balance ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_income_with_balance(
  p_income_id  UUID,
  p_amount     NUMERIC,
  p_currency   TEXT,
  p_type       TEXT,
  p_account_id UUID,
  p_date       DATE,
  p_note       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_old_amount     NUMERIC;
  v_old_account_id UUID;
  v_distributed    BOOLEAN;
BEGIN
  SELECT amount, account_id, distributed
    INTO v_old_amount, v_old_account_id, v_distributed
  FROM incomes
  WHERE id = p_income_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingreso no encontrado o sin permisos';
  END IF;

  IF v_distributed THEN
    UPDATE incomes
    SET type = p_type, account_id = p_account_id, date = p_date, note = p_note
    WHERE id = p_income_id;
  ELSE
    IF v_old_account_id IS NOT NULL THEN
      PERFORM apply_balance_delta(v_old_account_id, -v_old_amount);
    END IF;

    IF p_account_id IS NOT NULL THEN
      PERFORM apply_balance_delta(p_account_id, p_amount);
    END IF;

    UPDATE incomes
    SET amount = p_amount, currency = p_currency, type = p_type,
        account_id = p_account_id, date = p_date, note = p_note
    WHERE id = p_income_id;
  END IF;
END;
$$;

-- ─── 3. confirm_income_distribution — movimiento neutro, holding-aware ─────

CREATE OR REPLACE FUNCTION confirm_income_distribution(
  p_income_id UUID,
  p_lines     JSONB   -- array de {account_id, amount}
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_line          JSONB;
  v_distributed   BOOLEAN;
  v_source_account UUID;
  v_lines_total   NUMERIC := 0;
BEGIN
  SELECT distributed, account_id INTO v_distributed, v_source_account
  FROM incomes
  WHERE id = p_income_id;

  IF v_distributed IS NULL THEN
    RAISE EXCEPTION 'Ingreso no encontrado o sin permisos';
  END IF;

  IF v_distributed THEN
    RAISE EXCEPTION 'Este ingreso ya fue distribuido';
  END IF;

  IF v_source_account IS NOT NULL THEN
    SELECT COALESCE(SUM((value->>'amount')::NUMERIC), 0) INTO v_lines_total
    FROM jsonb_array_elements(p_lines) AS value;

    IF v_lines_total > 0 THEN
      PERFORM apply_balance_delta(v_source_account, -v_lines_total);
    END IF;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS value
  LOOP
    PERFORM apply_balance_delta((v_line->>'account_id')::UUID, (v_line->>'amount')::NUMERIC);
  END LOOP;

  UPDATE incomes SET distributed = true WHERE id = p_income_id;
END;
$$;

-- ─── 4. confirm_distribution_with_contributions — mismo movimiento neutro ──

CREATE OR REPLACE FUNCTION confirm_distribution_with_contributions(
  p_income_id         uuid,
  p_lines             jsonb,    -- [{account_id, amount}] — actualizaciones de balance (Capa 4)
  p_contributions     jsonb,    -- [{asset_id?, goal_id?, amount, currency, dest_account_id?, name}]
  p_emergency_amount  numeric,
  p_emergency_fund_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  line             jsonb;
  contrib          jsonb;
  v_source_account uuid;
  v_lines_total    numeric := 0;
BEGIN
  SELECT account_id INTO v_source_account
  FROM incomes
  WHERE id = p_income_id AND user_id = auth.uid();

  IF v_source_account IS NOT NULL THEN
    SELECT COALESCE(SUM((value->>'amount')::numeric), 0) INTO v_lines_total
    FROM jsonb_array_elements(p_lines) AS value;

    IF v_lines_total > 0 THEN
      PERFORM apply_balance_delta(v_source_account, -v_lines_total);
    END IF;
  END IF;

  -- Capa 4: actualizar balances de cuentas destino
  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    PERFORM apply_balance_delta((line->>'account_id')::uuid, (line->>'amount')::numeric);
  END LOOP;

  -- Capa 2: insertar contributions + earmarks opcionales (no toca accounts.balance)
  FOR contrib IN SELECT * FROM jsonb_array_elements(p_contributions)
  LOOP
    INSERT INTO savings_contributions (
      user_id, asset_id, goal_id, amount, currency, account_id, income_id, date
    ) VALUES (
      auth.uid(),
      CASE WHEN contrib->>'asset_id' IS NOT NULL
           THEN (contrib->>'asset_id')::uuid END,
      CASE WHEN contrib->>'goal_id' IS NOT NULL
           THEN (contrib->>'goal_id')::uuid END,
      (contrib->>'amount')::numeric,
      contrib->>'currency',
      CASE WHEN contrib->>'dest_account_id' IS NOT NULL
           THEN (contrib->>'dest_account_id')::uuid END,
      p_income_id,
      CURRENT_DATE
    );

    IF contrib->>'dest_account_id' IS NOT NULL THEN
      INSERT INTO account_earmarks (
        user_id, account_id, amount, currency, reason, release_date, released
      ) VALUES (
        auth.uid(),
        (contrib->>'dest_account_id')::uuid,
        (contrib->>'amount')::numeric,
        contrib->>'currency',
        contrib->>'name',
        NULL,
        false
      );
    END IF;
  END LOOP;

  -- Capa 3: acreditar fondo de emergencia (funds.current_amount, no accounts.balance
  -- — sin holding vinculado posible, no necesita apply_balance_delta)
  IF p_emergency_amount > 0 AND p_emergency_fund_id IS NOT NULL THEN
    UPDATE funds
    SET current_amount = current_amount + p_emergency_amount
    WHERE id = p_emergency_fund_id
      AND user_id = auth.uid();
  END IF;

  UPDATE incomes
  SET distributed = true
  WHERE id = p_income_id
    AND user_id = auth.uid();
END;
$$;

-- ─── 5. delete_income_with_balance ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_income_with_balance(p_income_id UUID)
RETURNS BOOLEAN  -- true si estaba distribuido
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_amount      NUMERIC;
  v_account_id  UUID;
  v_distributed BOOLEAN;
BEGIN
  SELECT amount, account_id, distributed
    INTO v_amount, v_account_id, v_distributed
  FROM incomes
  WHERE id = p_income_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingreso no encontrado o sin permisos';
  END IF;

  IF v_distributed THEN
    DELETE FROM savings_contributions
    WHERE income_id = p_income_id AND user_id = auth.uid();
  ELSIF v_account_id IS NOT NULL THEN
    PERFORM apply_balance_delta(v_account_id, -v_amount);
  END IF;

  DELETE FROM incomes WHERE id = p_income_id AND user_id = auth.uid();

  RETURN v_distributed;
END;
$$;

-- ─── 6. confirm_earmark_funding — holding-aware ────────────────────────────

CREATE OR REPLACE FUNCTION confirm_earmark_funding(
  p_earmark_id       UUID,
  p_funding_account_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_amount          NUMERIC;
  v_currency        TEXT;
  v_covering_id     UUID;
  v_expense_id      UUID;
  v_covering_currency TEXT;
  v_funding_currency  TEXT;
BEGIN
  SELECT ae.amount, ae.currency, ae.account_id, ae.expense_id
  INTO v_amount, v_currency, v_covering_id, v_expense_id
  FROM account_earmarks ae
  WHERE ae.id = p_earmark_id
    AND ae.user_id = auth.uid()
    AND ae.released = false
    AND ae.expense_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada, ya liberada, o sin gasto asociado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM expenses
    WHERE id = v_expense_id
      AND user_id = auth.uid()
      AND funding_account_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'La transferencia ya fue confirmada para este gasto';
  END IF;

  IF p_funding_account_id = v_covering_id THEN
    RAISE EXCEPTION 'La cuenta origen no puede ser la misma que la cuenta de cobertura';
  END IF;

  SELECT a.currency INTO v_covering_currency
  FROM accounts a
  WHERE a.id = v_covering_id AND a.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta de cobertura no encontrada';
  END IF;

  SELECT a.currency INTO v_funding_currency
  FROM accounts a
  WHERE a.id = p_funding_account_id AND a.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta de origen no encontrada';
  END IF;

  IF v_funding_currency <> v_currency THEN
    RAISE EXCEPTION 'La moneda de la cuenta origen (%) no coincide con la moneda de la reserva (%)',
      v_funding_currency, v_currency;
  END IF;

  -- Mover dinero: debitar origen, acreditar cobertura (holding-aware — TAREA 2,
  -- Sesión J.1.15, ver comentario de cabecera de esta migración)
  PERFORM apply_balance_delta(p_funding_account_id, -v_amount);
  PERFORM apply_balance_delta(v_covering_id, v_amount);

  UPDATE expenses
  SET funding_account_id = p_funding_account_id
  WHERE id = v_expense_id AND user_id = auth.uid();
END;
$$;
