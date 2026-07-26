-- Migración 018: columna earns_yield en accounts
--
-- Flag manual (el usuario lo activa explícitamente) que indica si una cuenta
-- genera rendimiento y puede ser destino de cobertura de gastos en crédito.
--
-- Ejemplos: Cocos Capital = true, Mercado Pago con caja de ahorro = true,
--            Efectivo = false, Cuenta vista = false.
--
-- NO se infiere por tipo de institución — es una decisión del usuario.
-- Aplica a toda cuenta excepto type='credito' (las tarjetas nunca son destino de cobertura).
--
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS earns_yield BOOLEAN NOT NULL DEFAULT false;
