-- Migration 010: modelo dos tasas autos + override manual objetivo de ahorro
-- Ejecutada en Supabase el 2026-07-11

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS car_segment text
    CHECK (car_segment IN ('popular','pickup','suv_compacta','premium','compacto_entrada')),
  ADD COLUMN IF NOT EXISTS bought_used boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS savings_goal_mode text
    CHECK (savings_goal_mode IN ('calculated','manual')) DEFAULT 'calculated',
  ADD COLUMN IF NOT EXISTS savings_goal_amount numeric,
  ADD COLUMN IF NOT EXISTS savings_goal_months integer;
