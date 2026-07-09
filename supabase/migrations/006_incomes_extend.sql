-- Migración 006: extiende tabla incomes para el flujo de distribución de sueldo
-- type: clasifica el ingreso (sueldo activa la pantalla de distribución)
-- note: nota libre del usuario
-- distributed: true cuando el usuario confirmó la distribución en /ingresos/distribuir

ALTER TABLE incomes
  ADD COLUMN type        TEXT CHECK (type IN ('sueldo', 'freelance', 'otro')),
  ADD COLUMN note        TEXT,
  ADD COLUMN distributed BOOLEAN NOT NULL DEFAULT false;
