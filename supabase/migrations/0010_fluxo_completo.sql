-- 0010_fluxo_completo.sql
-- Adiciona campos para janela de devolução, fluxo completo de resgates,
-- tabela admins e helper is_admin(). Corrige default de comissão para 10%.

-- 1) Janela de devolução em comissões -----------------------------------------
ALTER TABLE comissoes
  ADD COLUMN IF NOT EXISTS data_pedido            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_window_ends_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason       TEXT,
  ADD COLUMN IF NOT EXISTS resgate_id             UUID;

-- Idempotência da sync (1 comissão por pedido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_comissoes_pedido ON comissoes(pedido_id);

-- Backfill da janela de devolução para registros existentes
UPDATE comissoes
   SET data_pedido           = COALESCE(data_pedido, criado_em),
       return_window_ends_at = COALESCE(return_window_ends_at, criado_em + interval '7 days')
 WHERE return_window_ends_at IS NULL;

-- 2) Fluxo completo de resgates -----------------------------------------------
ALTER TABLE resgates
  ADD COLUMN IF NOT EXISTS pix_key_type      TEXT,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS paid_by           UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes       TEXT;

-- Constraint de valor mínimo (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resgates_amount_min'
  ) THEN
    ALTER TABLE resgates ADD CONSTRAINT resgates_amount_min CHECK (valor >= 100);
  END IF;
END$$;

-- FK comissoes → resgates (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comissoes_resgate'
  ) THEN
    ALTER TABLE comissoes
      ADD CONSTRAINT fk_comissoes_resgate
      FOREIGN KEY (resgate_id) REFERENCES resgates(id);
  END IF;
END$$;

-- 3) Tabela admins (substitui email hardcoded em RLS) -------------------------
CREATE TABLE IF NOT EXISTS admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_self_read ON admins;
CREATE POLICY admin_self_read ON admins FOR SELECT
  USING (user_id = auth.uid());

-- Helper SECURITY DEFINER usado em RLS de outras tabelas
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
$$;

-- Seed do admin atual (idempotente). O user_id é resolvido a partir do email
-- existente em auth.users, então só funciona depois que o usuário fez signup.
INSERT INTO admins (user_id, email)
SELECT id, email FROM auth.users
 WHERE email = 'adminsg@saintgermain.com.br'
ON CONFLICT (email) DO NOTHING;

-- 4) Default de comissão 10% (correção do 0.15 antigo) ------------------------
ALTER TABLE embaixadores ALTER COLUMN comissao_pct SET DEFAULT 0.10;
UPDATE embaixadores SET comissao_pct = 0.10 WHERE comissao_pct = 0.15;

-- 5) Storage de cursores de sync (idempotente) --------------------------------
-- Usado por sync-orders para avançar created_at_min entre execuções.
INSERT INTO config (chave, valor)
VALUES ('sync_orders_cursor', NULL)
ON CONFLICT (chave) DO NOTHING;
