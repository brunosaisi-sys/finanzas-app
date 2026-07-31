-- Migración 020: RPC atómica para crear una cuenta padre con hijos en una sola transacción.
-- Reemplaza la secuencia de dos INSERTs sueltos usada anteriormente en el wizard
-- (handleSubmitFromBankConfig, handleSubmitBolsillos, AccountsOnboarding).
--
-- Si el INSERT de cualquier hijo falla (constraint, RLS, etc.), toda la transacción
-- hace rollback automáticamente: no puede quedar un padre huérfano sin hijos.
--
-- SECURITY INVOKER — RLS aplica normalmente (auth.uid() filtra user_id).
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION create_account_with_children(
  p_parent   JSONB,
  p_children JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_parent_id UUID;
  v_child     JSONB;
BEGIN
  -- Insertar cuenta padre
  INSERT INTO accounts (
    user_id,
    name,
    type,
    currency,
    balance,
    earns_yield
  ) VALUES (
    auth.uid(),
    p_parent->>'name',
    p_parent->>'type',
    p_parent->>'currency',
    COALESCE((p_parent->>'balance')::numeric, 0),
    COALESCE((p_parent->>'earns_yield')::boolean, false)
  )
  RETURNING id INTO v_parent_id;

  -- Insertar cada hijo con parent_id apuntando al padre recién creado
  FOR v_child IN SELECT value FROM jsonb_array_elements(p_children)
  LOOP
    INSERT INTO accounts (
      user_id,
      name,
      type,
      currency,
      balance,
      parent_id,
      earns_yield,
      closing_day,
      due_day
    ) VALUES (
      auth.uid(),
      v_child->>'name',
      v_child->>'type',
      v_child->>'currency',
      COALESCE((v_child->>'balance')::numeric, 0),
      v_parent_id,
      COALESCE((v_child->>'earns_yield')::boolean, false),
      NULLIF(v_child->>'closing_day', '')::smallint,
      NULLIF(v_child->>'due_day', '')::smallint
    );
  END LOOP;

  RETURN v_parent_id;
END;
$$;
