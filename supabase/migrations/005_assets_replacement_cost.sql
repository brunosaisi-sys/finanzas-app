-- Migración 005: campo replacement_cost en assets
-- C0 = costo de reposición del bien nuevo equivalente hoy (en moneda del bien)
-- Es el input principal del Sinking Fund: d = (C0 - CL) × i / ((1+i)^L - 1)
-- Fuente: docs/01-fundamentos-teoricos.md §1.2

ALTER TABLE assets
  ADD COLUMN replacement_cost NUMERIC(18, 2) NULL;
