-- Migración 024: crédito atómico de ingresos a su cuenta destino
-- Sesión J.1.13, TAREA 1 (crítico).
--
-- Bug: incomes.account_id era puramente informativo — createIncome/updateIncome
-- solo hacían INSERT/UPDATE directo, sin tocar accounts.balance. La plata de un
-- sueldo existe en el banco desde que se cobra, "distribuir" es decidir cómo
-- categorizarla, no si existe (docs/01-fundamentos-teoricos.md — el ingreso ya
-- es dinero real antes de distribuirlo, igual que un gasto ya es dinero real
-- antes de pagarlo). Fix: crédito atómico al crear/editar, y "movimiento neutro"
-- (débito del origen + crédito del destino) al distribuir, para no duplicar plata.
--
-- Ejecutar en Supabase SQL Editor (requiere rol postgres/service_role — ver
-- docs/lecciones-aprendidas.md §9).

-- ─── 1. create_income_with_balance ─────────────────────────────────────────
-- Inserta el ingreso y, si tiene cuenta destino, acredita su balance en la
-- misma transacción atómica.

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
    UPDATE accounts
    SET balance = balance + p_amount
    WHERE id = p_account_id AND user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cuenta destino no encontrada o sin permisos';
    END IF;
  END IF;

  RETURN v_income_id;
END;
$$;

-- ─── 2. update_income_with_balance ─────────────────────────────────────────
-- Si el ingreso YA fue distribuido, la plata que estaba en account_id ya se
-- movió a las cuentas destino de la distribución — editar account_id/amount acá
-- es puramente informativo (histórico), nunca vuelve a tocar balances.
-- Si NO fue distribuido, revierte el crédito viejo (si había cuenta) y aplica
-- el nuevo (si hay cuenta nueva) — cubre cambio de monto, cambio de cuenta,
-- cuenta agregada o quitada, sin duplicar ni perder plata.

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
    -- Monto/moneda ya están bloqueados en la UI para ingresos distribuidos;
    -- no se toca ningún balance, solo metadata (tipo, cuenta como referencia,
    -- fecha, nota).
    UPDATE incomes
    SET type = p_type, account_id = p_account_id, date = p_date, note = p_note
    WHERE id = p_income_id;
  ELSE
    IF v_old_account_id IS NOT NULL THEN
      UPDATE accounts
      SET balance = balance - v_old_amount
      WHERE id = v_old_account_id AND user_id = auth.uid();
    END IF;

    IF p_account_id IS NOT NULL THEN
      UPDATE accounts
      SET balance = balance + p_amount
      WHERE id = p_account_id AND user_id = auth.uid();

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta destino no encontrada o sin permisos';
      END IF;
    END IF;

    UPDATE incomes
    SET amount = p_amount, currency = p_currency, type = p_type,
        account_id = p_account_id, date = p_date, note = p_note
    WHERE id = p_income_id;
  END IF;
END;
$$;

-- ─── 3. confirm_income_distribution — movimiento neutro ────────────────────
-- Antes de aplicar las líneas de distribución, débita de la cuenta de origen
-- del ingreso (account_id) la suma exacta de lo que las líneas van a acreditar
-- en las cuentas destino. Lo que el usuario deja "sin asignar" (sinAsignar > 0
-- en la UI) NUNCA se débita — queda en la cuenta de origen, tal como indica el
-- texto de /ingresos/distribuir ("queda en tus cuentas de origen").

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
  -- 1. Verificar ownership + estado (RLS de incomes filtra por auth.uid())
  SELECT distributed, account_id INTO v_distributed, v_source_account
  FROM incomes
  WHERE id = p_income_id;

  IF v_distributed IS NULL THEN
    RAISE EXCEPTION 'Ingreso no encontrado o sin permisos';
  END IF;

  IF v_distributed THEN
    RAISE EXCEPTION 'Este ingreso ya fue distribuido';
  END IF;

  -- 2. Débito neutro de la cuenta de origen (movimiento, no plata nueva)
  IF v_source_account IS NOT NULL THEN
    SELECT COALESCE(SUM((value->>'amount')::NUMERIC), 0) INTO v_lines_total
    FROM jsonb_array_elements(p_lines) AS value;

    IF v_lines_total > 0 THEN
      UPDATE accounts
      SET balance = balance - v_lines_total
      WHERE id = v_source_account;
    END IF;
  END IF;

  -- 3. Actualizar cada balance destino (RLS de accounts filtra por auth.uid())
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS value
  LOOP
    UPDATE accounts
    SET balance = balance + (v_line->>'amount')::NUMERIC
    WHERE id = (v_line->>'account_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cuenta % no encontrada', (v_line->>'account_id');
    END IF;
  END LOOP;

  -- 4. Marcar como distribuido — solo llega acá si todo lo anterior fue OK
  UPDATE incomes SET distributed = true WHERE id = p_income_id;
END;
$$;

-- ─── 4. confirm_distribution_with_contributions — mismo movimiento neutro ──
-- Misma lógica de débito del origen que el punto 3, aplicada antes de las 4
-- capas. Las capas 2 (metas) y 3 (fondo emergencia) no tocan accounts.balance
-- (earmarks y funds.current_amount son mecanismos aparte, ya existentes) —
-- solo la capa 4 (p_lines) mueve balance real entre cuentas, así que solo esa
-- suma se débita del origen.

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
  -- Débito neutro de la cuenta de origen del ingreso, por lo que la Capa 4 va a acreditar.
  SELECT account_id INTO v_source_account
  FROM incomes
  WHERE id = p_income_id AND user_id = auth.uid();

  IF v_source_account IS NOT NULL THEN
    SELECT COALESCE(SUM((value->>'amount')::numeric), 0) INTO v_lines_total
    FROM jsonb_array_elements(p_lines) AS value;

    IF v_lines_total > 0 THEN
      UPDATE accounts
      SET balance = balance - v_lines_total
      WHERE id = v_source_account AND user_id = auth.uid();
    END IF;
  END IF;

  -- Capa 4: actualizar balances de cuentas destino
  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    UPDATE accounts
    SET balance = balance + (line->>'amount')::numeric
    WHERE id = (line->>'account_id')::uuid
      AND user_id = auth.uid();
  END LOOP;

  -- Capa 2: insertar contributions + earmarks opcionales
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

  -- Capa 3: acreditar fondo de emergencia
  IF p_emergency_amount > 0 AND p_emergency_fund_id IS NOT NULL THEN
    UPDATE funds
    SET current_amount = current_amount + p_emergency_amount
    WHERE id = p_emergency_fund_id
      AND user_id = auth.uid();
  END IF;

  -- Marcar ingreso como distribuido
  UPDATE incomes
  SET distributed = true
  WHERE id = p_income_id
    AND user_id = auth.uid();
END;
$$;

-- ─── 5. delete_income_with_balance ─────────────────────────────────────────
-- Consecuencia directa del fix de TAREA 1: si account_id ahora acredita plata
-- real al crear el ingreso, borrarlo sin revertir dejaría esa plata huérfana
-- para siempre. Si NO fue distribuido, revierte el crédito de account_id (si
-- había). Si SÍ fue distribuido, la plata ya se movió a otras cuentas — mismo
-- comportamiento que antes (no revierte balances, borra las savings_contributions
-- asociadas para no inflar progreso de metas).

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
    UPDATE accounts
    SET balance = balance - v_amount
    WHERE id = v_account_id AND user_id = auth.uid();
  END IF;

  DELETE FROM incomes WHERE id = p_income_id AND user_id = auth.uid();

  RETURN v_distributed;
END;
$$;
