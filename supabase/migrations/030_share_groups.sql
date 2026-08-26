-- Migración 030: grupos de personas para gastos compartidos
-- (Familiares, Amigos, Trabajo, etc.)
--
-- No mueve plata: solo catálogo de nombres reutilizable al marcar
-- "¿Es compartido?" en un gasto (efectivo/débito/crédito+cuotas).
-- Los miembros son otras personas (vos no figurás en la lista):
-- al elegir un grupo de N miembros, el split es N+1 (incluyéndote).
--
-- RLS por user_id en share_groups; members vía EXISTS al grupo padre.
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE share_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT share_groups_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_share_groups_user_id ON share_groups(user_id);

CREATE TABLE share_group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES share_groups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT share_group_members_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_share_group_members_group_id ON share_group_members(group_id);

ALTER TABLE share_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_groups: solo el propietario" ON share_groups
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "share_group_members: via grupo propio" ON share_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM share_groups g
      WHERE g.id = share_group_members.group_id
        AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM share_groups g
      WHERE g.id = share_group_members.group_id
        AND g.user_id = auth.uid()
    )
  );
