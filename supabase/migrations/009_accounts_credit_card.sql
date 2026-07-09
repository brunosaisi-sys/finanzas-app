-- Migration 009: credit card account type + closing/due days
-- Ejecutada en Supabase el 2026-07-09

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closing_day smallint
  CHECK (closing_day BETWEEN 1 AND 28);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day smallint
  CHECK (due_day BETWEEN 1 AND 28);

-- Si existe check constraint en type, actualizar para incluir 'credito':
-- ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
-- ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
--   CHECK (type IN ('banco','efectivo','inversion','usd_reserva','credito'));
