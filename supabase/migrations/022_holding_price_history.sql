-- Migración 022: Histórico de precios de holdings (aditivo, no reemplaza current_price)
--
-- Objetivo: guardar una serie temporal de precios por holding en vez de pisar un
-- solo current_price. Insumo para el cálculo de rendimiento propio (Sesión J.1.7,
-- TAREA 1d) y, más adelante, para TWR (§8 fundamentos, Sesión J.2).
--
-- holdings.current_price sigue siendo el valor "actual" para cálculos rápidos de
-- balance (sync_holding_balance, migración 021) — esta tabla es historia adicional.
--
-- Un solo registro por (holding_id, recorded_at): si ya se sincronizó hoy (o para la
-- fecha del feed), se actualiza el precio en vez de duplicar la fila.
--
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE holding_price_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id  UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  price       NUMERIC NOT NULL,
  recorded_at DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (holding_id, recorded_at)
);

CREATE INDEX idx_holding_price_history_holding_date
  ON holding_price_history (holding_id, recorded_at DESC);

-- RLS: no tiene user_id propio — el acceso se controla vía holding_id (mismo patrón
-- que fund_transactions en migración 001).
ALTER TABLE holding_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holding_price_history: solo el propietario del holding" ON holding_price_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM holdings
      WHERE holdings.id = holding_price_history.holding_id
        AND holdings.user_id = auth.uid()
    )
  );
