-- 0011_rls_lockdown.sql
-- Endurece RLS:
--   - Tabelas legadas *_sg estavam com qual=true (acesso aberto). Restringe a admins.
--   - Substitui email hardcoded por is_admin() nas tabelas principais.
--   - Define quem pode INSERT em resgates (saldo mínimo + dia ≤ 10 BRT).

-- 1) Tabelas legadas *_sg → admin only -----------------------------------------
DROP POLICY IF EXISTS select_embaixadores_sg ON embaixadores_sg;
DROP POLICY IF EXISTS insert_embaixadores_sg ON embaixadores_sg;
DROP POLICY IF EXISTS update_embaixadores_sg ON embaixadores_sg;
DROP POLICY IF EXISTS select_comissoes_sg    ON comissoes_sg;
DROP POLICY IF EXISTS insert_comissoes_sg    ON comissoes_sg;
DROP POLICY IF EXISTS update_comissoes_sg    ON comissoes_sg;
DROP POLICY IF EXISTS select_resgates_sg     ON resgates_sg;
DROP POLICY IF EXISTS insert_resgates_sg     ON resgates_sg;
DROP POLICY IF EXISTS update_resgates_sg     ON resgates_sg;

DROP POLICY IF EXISTS admin_only_embaixadores_sg ON embaixadores_sg;
DROP POLICY IF EXISTS admin_only_comissoes_sg    ON comissoes_sg;
DROP POLICY IF EXISTS admin_only_resgates_sg     ON resgates_sg;

CREATE POLICY admin_only_embaixadores_sg ON embaixadores_sg FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_only_comissoes_sg    ON comissoes_sg    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_only_resgates_sg     ON resgates_sg     FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 2) Tabelas principais → trocar email hardcoded por is_admin() ----------------
DROP POLICY IF EXISTS admin_select_all_embaixadores ON embaixadores;
DROP POLICY IF EXISTS admin_select_all_comissoes    ON comissoes;
DROP POLICY IF EXISTS admin_embaixadores_select     ON embaixadores;
DROP POLICY IF EXISTS admin_embaixadores_update     ON embaixadores;
DROP POLICY IF EXISTS admin_resgates_select         ON resgates;
DROP POLICY IF EXISTS admin_resgates_update         ON resgates;
DROP POLICY IF EXISTS admin_comissoes_select        ON comissoes;
DROP POLICY IF EXISTS admin_comissoes_update        ON comissoes;

DROP POLICY IF EXISTS admin_full_embaixadores ON embaixadores;
DROP POLICY IF EXISTS admin_full_comissoes    ON comissoes;
DROP POLICY IF EXISTS admin_full_resgates     ON resgates;

CREATE POLICY admin_full_embaixadores ON embaixadores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_comissoes    ON comissoes    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_resgates     ON resgates     FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 3) Resgate: regra de janela e mínimo no nível do banco ----------------------
CREATE OR REPLACE FUNCTION can_request_withdrawal(_amount NUMERIC)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT _amount >= 100
     AND extract(day from now() AT TIME ZONE 'America/Sao_Paulo') <= 10;
$$;

DROP POLICY IF EXISTS resgates_insert ON resgates;
CREATE POLICY resgates_insert ON resgates FOR INSERT WITH CHECK (
  embaixador_id IN (SELECT id FROM embaixadores WHERE email = auth.jwt() ->> 'email')
  AND can_request_withdrawal(valor)
);
