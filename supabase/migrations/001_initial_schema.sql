-- ============================================================
-- Migración 001 — Esquema inicial
-- App de Finanzas Personales
-- ============================================================

-- ============================================================
-- TABLAS
-- ============================================================

-- Cuentas / fuentes de dinero
CREATE TABLE accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  type                    TEXT NOT NULL CHECK (type IN ('banco', 'efectivo', 'inversion', 'usd_reserva')),
  currency                TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  balance                 NUMERIC(18, 2) NOT NULL DEFAULT 0,
  expected_return_annual  NUMERIC(6, 4),          -- rendimiento esperado anual (ej: 0.05 = 5%)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categorías de gasto (soporte para subcategorías via parent_id)
CREATE TABLE categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  icon      TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL
);

-- Gastos
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount       NUMERIC(18, 2) NOT NULL,
  currency     TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  description  TEXT,
  merchant     TEXT,
  date         DATE NOT NULL,
  source       TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'whatsapp', 'ocr')),
  raw_ocr_text TEXT,          -- texto crudo si vino de OCR, para auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingresos
CREATE TABLE incomes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  amount     NUMERIC(18, 2) NOT NULL,
  currency   TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  source     TEXT,
  date       DATE NOT NULL,
  recurring  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bienes (assets) — base para Sinking Funds y Maintenance
CREATE TABLE assets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  category                  TEXT,                    -- mapea a tabla de defaults (ej: 'heladera', 'auto')
  purchase_price            NUMERIC(18, 2),
  purchase_date             DATE,
  currency                  TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('ARS', 'USD')),
  useful_life_months        INTEGER,                 -- override del default por categoría
  residual_pct              NUMERIC(5, 4),           -- override: ej 0.10 = 10% valor residual
  maintenance_pct_annual    NUMERIC(5, 4),           -- override: ej 0.01 = 1% anual
  replacement_horizon_months INTEGER,                -- cuándo el usuario quiere cambiarlo
  interest_rate_monthly     NUMERIC(8, 6) DEFAULT 0, -- i del fondo; default 0 (ajuste Argentina)
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fondos (Sinking, Maintenance, Goal, Emergency)
CREATE TABLE funds (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('sinking', 'maintenance', 'goal', 'emergency')),
  asset_id             UUID REFERENCES assets(id) ON DELETE SET NULL, -- null si no ligado a un bien
  name                 TEXT NOT NULL,
  target_amount        NUMERIC(18, 2),
  current_amount       NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('ARS', 'USD')),
  monthly_contribution NUMERIC(18, 2),               -- calculado por el motor de fondos
  target_date          DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Movimientos de fondos
CREATE TABLE fund_transactions (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  amount  NUMERIC(18, 2) NOT NULL,
  type    TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  date    DATE NOT NULL,
  note    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Cada tabla: RLS activado + política "solo el usuario autenticado ve sus filas"
-- ============================================================

-- accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts: solo el propietario" ON accounts
  FOR ALL USING (auth.uid() = user_id);

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories: solo el propietario" ON categories
  FOR ALL USING (auth.uid() = user_id);

-- expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses: solo el propietario" ON expenses
  FOR ALL USING (auth.uid() = user_id);

-- incomes
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incomes: solo el propietario" ON incomes
  FOR ALL USING (auth.uid() = user_id);

-- assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets: solo el propietario" ON assets
  FOR ALL USING (auth.uid() = user_id);

-- funds
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funds: solo el propietario" ON funds
  FOR ALL USING (auth.uid() = user_id);

-- fund_transactions: el acceso se controla via fund_id (que a su vez tiene RLS)
ALTER TABLE fund_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fund_transactions: solo el propietario del fondo" ON fund_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM funds
      WHERE funds.id = fund_transactions.fund_id
        AND funds.user_id = auth.uid()
    )
  );

-- ============================================================
-- ÍNDICES útiles para queries frecuentes
-- ============================================================
CREATE INDEX ON expenses (user_id, date DESC);
CREATE INDEX ON incomes  (user_id, date DESC);
CREATE INDEX ON funds    (user_id, type);
CREATE INDEX ON fund_transactions (fund_id, date DESC);
