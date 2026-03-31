-- ============================================================================
-- RLS (Row Level Security) — Embaixadores Saint Germain
-- Execute este script no SQL Editor do Supabase Dashboard.
-- Ele habilita RLS em TODAS as tabelas e cria políticas seguras.
-- ============================================================================

-- ─── Função auxiliar: verifica se o usuário é admin ─────────────────────────
-- Usa a tabela config para armazenar e-mails admin (chave 'admin_emails')
-- Isso substitui o VITE_ADMIN_EMAILS do frontend.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.config
    WHERE chave = 'admin_emails'
    AND auth.email() = ANY(string_to_array(valor, ','))
  );
$$;

-- ─── Função auxiliar: pega o embaixador do usuário logado ───────────────────
CREATE OR REPLACE FUNCTION public.my_embaixador_id(tabela text DEFAULT 'embaixadores')
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  eid uuid;
BEGIN
  IF tabela = 'embaixadores_sg' THEN
    SELECT id INTO eid FROM public.embaixadores_sg WHERE email = auth.email() LIMIT 1;
  ELSE
    SELECT id INTO eid FROM public.embaixadores WHERE email = auth.email() LIMIT 1;
  END IF;
  RETURN eid;
END;
$$;


-- ============================================================================
-- EMBAIXADORES (programa principal)
-- ============================================================================
ALTER TABLE public.embaixadores ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY "admin_full_embaixadores" ON public.embaixadores
  FOR ALL USING (public.is_admin());

-- Embaixador vê apenas seu próprio registro
CREATE POLICY "own_select_embaixadores" ON public.embaixadores
  FOR SELECT USING (auth.email() = email);

-- Embaixador atualiza apenas seu próprio registro (campos seguros)
CREATE POLICY "own_update_embaixadores" ON public.embaixadores
  FOR UPDATE USING (auth.email() = email)
  WITH CHECK (auth.email() = email);

-- Insert só via admin ou durante cadastro (service_role na Edge Function)
CREATE POLICY "insert_embaixadores" ON public.embaixadores
  FOR INSERT WITH CHECK (public.is_admin() OR auth.email() = email);


-- ============================================================================
-- EMBAIXADORES_SG (programa Saint Germain)
-- ============================================================================
ALTER TABLE public.embaixadores_sg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_embaixadores_sg" ON public.embaixadores_sg
  FOR ALL USING (public.is_admin());

CREATE POLICY "own_select_embaixadores_sg" ON public.embaixadores_sg
  FOR SELECT USING (auth.email() = email);

CREATE POLICY "own_update_embaixadores_sg" ON public.embaixadores_sg
  FOR UPDATE USING (auth.email() = email)
  WITH CHECK (auth.email() = email);

CREATE POLICY "insert_embaixadores_sg" ON public.embaixadores_sg
  FOR INSERT WITH CHECK (public.is_admin() OR auth.email() = email);


-- ============================================================================
-- COMISSOES (programa principal)
-- ============================================================================
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_comissoes" ON public.comissoes
  FOR ALL USING (public.is_admin());

-- Embaixador vê apenas suas comissões
CREATE POLICY "own_select_comissoes" ON public.comissoes
  FOR SELECT USING (embaixador_id = public.my_embaixador_id('embaixadores'));

-- Insert apenas via admin ou service_role (sync)
CREATE POLICY "insert_comissoes" ON public.comissoes
  FOR INSERT WITH CHECK (public.is_admin());


-- ============================================================================
-- COMISSOES_SG
-- ============================================================================
ALTER TABLE public.comissoes_sg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_comissoes_sg" ON public.comissoes_sg
  FOR ALL USING (public.is_admin());

CREATE POLICY "own_select_comissoes_sg" ON public.comissoes_sg
  FOR SELECT USING (embaixador_id = public.my_embaixador_id('embaixadores_sg'));

CREATE POLICY "insert_comissoes_sg" ON public.comissoes_sg
  FOR INSERT WITH CHECK (public.is_admin());


-- ============================================================================
-- RESGATES (programa principal)
-- ============================================================================
ALTER TABLE public.resgates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_resgates" ON public.resgates
  FOR ALL USING (public.is_admin());

-- Embaixador vê seus próprios resgates
CREATE POLICY "own_select_resgates" ON public.resgates
  FOR SELECT USING (embaixador_id = public.my_embaixador_id('embaixadores'));

-- Embaixador pode criar resgate (apenas para si)
CREATE POLICY "own_insert_resgates" ON public.resgates
  FOR INSERT WITH CHECK (embaixador_id = public.my_embaixador_id('embaixadores'));


-- ============================================================================
-- RESGATES_SG
-- ============================================================================
ALTER TABLE public.resgates_sg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_resgates_sg" ON public.resgates_sg
  FOR ALL USING (public.is_admin());

CREATE POLICY "own_select_resgates_sg" ON public.resgates_sg
  FOR SELECT USING (embaixador_id = public.my_embaixador_id('embaixadores_sg'));

CREATE POLICY "own_insert_resgates_sg" ON public.resgates_sg
  FOR INSERT WITH CHECK (embaixador_id = public.my_embaixador_id('embaixadores_sg'));


-- ============================================================================
-- CONFIG (apenas admin pode ler/escrever)
-- ============================================================================
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_config" ON public.config
  FOR ALL USING (public.is_admin());

-- Leitura pública apenas de chaves específicas (banners, links)
CREATE POLICY "public_read_config" ON public.config
  FOR SELECT USING (
    chave IN (
      'banner_url', 'banner_ativo', 'banner_caption', 'banner_altura',
      'banner_sg_url', 'banner_sg_ativo', 'banner_sg_caption', 'banner_sg_altura',
      'link_grupo_vip', 'link_grupo_vip_sg'
    )
  );


-- ============================================================================
-- PAGE_VIEWS (analytics — qualquer um pode inserir, só admin lê)
-- ============================================================================
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_page_views" ON public.page_views
  FOR SELECT USING (public.is_admin());

-- Qualquer visitante pode registrar page view (anon insert)
CREATE POLICY "anon_insert_page_views" ON public.page_views
  FOR INSERT WITH CHECK (true);


-- ============================================================================
-- MENSAGENS_WHATSAPP (apenas admin)
-- ============================================================================
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_mensagens" ON public.mensagens_whatsapp
  FOR ALL USING (public.is_admin());


-- ============================================================================
-- AGENDAMENTOS_DISPARO (apenas admin)
-- ============================================================================
ALTER TABLE public.agendamentos_disparo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_agendamentos" ON public.agendamentos_disparo
  FOR ALL USING (public.is_admin());


-- ============================================================================
-- PRE_ESTREIA (qualquer um insere, só admin lê/gerencia)
-- ============================================================================
ALTER TABLE public.pre_estreia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_pre_estreia" ON public.pre_estreia
  FOR ALL USING (public.is_admin());

CREATE POLICY "anon_insert_pre_estreia" ON public.pre_estreia
  FOR INSERT WITH CHECK (true);


-- ============================================================================
-- IMPORTANTE: Adicione os e-mails admin na tabela config
-- ============================================================================
-- Execute isto para cadastrar seus admins:
INSERT INTO public.config (chave, valor)
VALUES ('admin_emails', 'adminsg@saintgermain.com.br')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- Para adicionar mais admins, separe por vírgula:
-- UPDATE public.config SET valor = 'admin1@email.com,admin2@email.com' WHERE chave = 'admin_emails';
