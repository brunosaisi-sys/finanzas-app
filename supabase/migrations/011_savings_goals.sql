-- Migración 011: Módulo de metas de ahorro
-- Agrega savings_goals, savings_contributions y account_id en assets.
-- Ejecutar en Supabase SQL Editor.

-- ─── 1. Tabla savings_goals — objetivos manuales del usuario ──────────────────

CREATE TABLE IF NOT EXISTS savings_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  currency      text NOT NULL CHECK (currency IN ('ARS','USD')),
  target_months integer NOT NULL CHECK (target_months > 0),
  start_date    date NOT NULL DEFAULT CURRENT_DATE,
  account_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,  -- dónde se guarda la plata
  archived      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_goals: solo el propietario"
  ON savings_goals FOR ALL USING (auth.uid() = user_id);

-- ─── 2. Tabla savings_contributions — aportes a bienes u objetivos ────────────

CREATE TABLE IF NOT EXISTS savings_contributions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id     uuid REFERENCES assets(id) ON DELETE CASCADE,
  goal_id      uuid REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount       numeric NOT NULL CHECK (amount > 0),
  currency     text NOT NULL CHECK (currency IN ('ARS','USD')),
  account_id   uuid REFERENCES accounts(id) ON DELETE SET NULL,  -- de dónde salió la plata
  income_id    uuid REFERENCES incomes(id) ON DELETE SET NULL,   -- si vino de una distribución
  date         date NOT NULL DEFAULT CURRENT_DATE,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- exactamente uno de asset_id / goal_id debe estar seteado
  CHECK ((asset_id IS NOT NULL AND goal_id IS NULL)
      OR (asset_id IS NULL  AND goal_id IS NOT NULL))
);

ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_contributions: solo el propietario"
  ON savings_contributions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contrib_asset ON savings_contributions (asset_id);
CREATE INDEX IF NOT EXISTS idx_contrib_goal  ON savings_contributions (goal_id);

-- ─── 3. account_id en assets — dónde se guarda el fondo del bien ─────────────

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- ─── 4. RPC confirm_distribution_with_contributions ───────────────────────────
-- Extiende confirm_income_distribution para también registrar aportes a metas
-- y crear earmarks en la misma transacción atómica.

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
  line   jsonb;
  contrib jsonb;
BEGIN
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

    -- Earmark en la cuenta destino de la meta (si tiene account_id asignada).
    -- release_date = NULL: los earmarks de metas se liberan manualmente cuando el usuario
    -- realiza la compra o cumple el objetivo. A diferencia de los earmarks de cuotas de
    -- tarjeta (que tienen fecha fija de vencimiento), no hay fecha de liberación automática.
    IF contrib->>'dest_account_id' IS NOT NULL THEN
      INSERT INTO account_earmarks (
        user_id, account_id, amount, currency, reason, release_date, released
      ) VALUES (
        auth.uid(),
        (contrib->>'dest_account_id')::uuid,
        (contrib->>'amount')::numeric,
        contrib->>'currency',
        contrib->>'name',
        NULL,   -- liberación manual, no por fecha (ver comentario arriba)
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
