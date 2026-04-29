# Setup do Backend — Programa Embaixadoras Saint Germain

Guia de operações para aplicar as mudanças desta branch em produção. Ordem importa.

## 1) Aplicar migrations SQL

No painel Supabase → SQL Editor, rodar **na ordem**:

1. `supabase/migrations/0010_fluxo_completo.sql`
2. `supabase/migrations/0011_rls_lockdown.sql`

Ambas são idempotentes (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` etc.) e podem ser re-rodadas com segurança.

Verificações pós-migration:

```sql
-- Confere colunas novas em comissoes
\d+ comissoes

-- Confere colunas novas em resgates
\d+ resgates

-- Helper is_admin() existe
SELECT is_admin();  -- false se logado como anon, true se logado como admin

-- Default de comissão corrigido
SELECT comissao_pct, count(*) FROM embaixadores GROUP BY comissao_pct;
```

## 2) Configurar secrets das Edge Functions

No painel Supabase → **Edge Functions → Secrets**, adicionar:

| Nome | Valor |
|---|---|
| `NUVEMSHOP_TOKEN` | Token de acesso da app Nuvemshop (não confundir com client_id/secret) |
| `NUVEMSHOP_STORE_ID` | ID numérico da loja na Nuvemshop |
| `NUVEMSHOP_USER_AGENT` | `SG Embaixadoras (suporte@saintgermainbrand.com.br)` |
| `JANELA_DEVOLUCAO` | `7` (opcional — default é 7) |

Os secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já vêm preenchidos automaticamente pelo Supabase.

## 3) Deploy das Edge Functions

Com a CLI do Supabase instalada (`npm i -g supabase`) e autenticada (`supabase login`):

```bash
supabase link --project-ref fsfqnshkfwnfeswwdmxg
supabase functions deploy nuvemshop-orders-by-email
supabase functions deploy nuvemshop-coupons
supabase functions deploy sync-orders
supabase functions deploy confirm-commissions
supabase functions deploy request-withdrawal
supabase functions deploy approve-withdrawal
supabase functions deploy mark-withdrawal-paid
supabase functions deploy reject-withdrawal
```

A função `bright-api` antiga **continua existindo** (não foi deletada), mas não é mais usada pelas páginas novas. Pode ser removida quando confirmarmos que nada chama ela:

```bash
supabase functions delete bright-api  # apenas após validação
```

## 4) Configurar `pg_cron` para os jobs recorrentes

No SQL editor:

```sql
-- Habilita extensões (uma vez)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Token de service role para o cron chamar as functions
-- (substitua pelo SERVICE_ROLE da sua instância)
ALTER DATABASE postgres SET app.cron_token = 'SEU_SERVICE_ROLE_KEY_AQUI';

-- Sync de pedidos — todo hora cheia
SELECT cron.schedule('sync-orders-hourly', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://fsfqnshkfwnfeswwdmxg.supabase.co/functions/v1/sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_token')
    )
  );
$$);

-- Fechamento de janela de devolução — todo dia às 06:00 UTC (≈03:00 BRT)
SELECT cron.schedule('confirm-commissions-daily', '0 6 * * *', $$
  SELECT net.http_post(
    url := 'https://fsfqnshkfwnfeswwdmxg.supabase.co/functions/v1/confirm-commissions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_token')
    )
  );
$$);

-- Para ver schedules ativos:
SELECT jobid, schedule, command FROM cron.job;
```

## 5) Backfill de comissões antigas (cobre B3)

Pedidos com cupom feitos antes do deploy não têm comissão registrada. Disparar uma chamada manual:

```bash
curl -X POST \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  "https://fsfqnshkfwnfeswwdmxg.supabase.co/functions/v1/sync-orders?since=2025-01-01"
```

A função é idempotente (UNIQUE em `pedido_id`), então pode ser rodada múltiplas vezes sem duplicar.

## 6) Storage bucket `comprovantes`

No painel Supabase → **Storage**:

1. Create bucket → `comprovantes` → **Private** (não public)
2. Em **Policies**, adicionar:

```sql
CREATE POLICY "admin_read_proofs" ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes' AND is_admin());

CREATE POLICY "admin_write_proofs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprovantes' AND is_admin());

CREATE POLICY "admin_update_proofs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'comprovantes' AND is_admin());
```

## 7) SMTP custom (Resolve B5)

O SMTP padrão do Supabase tem rate limit de 3-4 emails/hora e é frequentemente bloqueado por provedores — por isso o "esqueci minha senha" não chega.

**Recomendação: Resend** (3.000 emails/mês grátis).

### Setup Resend:

1. Criar conta em https://resend.com
2. Adicionar domínio `saintgermainbrand.com.br` e configurar DNS (SPF + DKIM, registros mostrados pelo Resend)
3. Aguardar verificação (~5 min)
4. Em **API Keys**, criar chave `Sending`

### Setup no Supabase:

Painel Supabase → **Authentication → Email Settings → Custom SMTP**:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` |
| User | `resend` |
| Pass | sua API key do Resend |
| Sender email | `nao-responda@saintgermainbrand.com.br` |
| Sender name | `Saint Germain` |
| Min interval | `5` (segundos) |

Em **Email Templates**, customizar pelo menos:
- **Reset Password** (importante — é o que está quebrado hoje)
- **Confirm signup**
- **Magic Link**

Cada template aceita HTML — recomendo aplicar a identidade SG (logo + tipografia Cormorant Garamond por imagem ou fontes do sistema).

### Smoke test:

1. Logar em `embaixadores.saintgermainbrand.com.br/login`
2. Clicar "Esqueci minha senha"
3. Email deve chegar em <1 min

## 8) Cadastrar admins adicionais (opcional)

A migration faz seed do admin atual (`adminsg@saintgermain.com.br`). Para adicionar mais:

```sql
INSERT INTO admins (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'novo-admin@saintgermainbrand.com.br';
```

O usuário precisa **já ter feito signup** no Supabase Auth — o INSERT busca por email em `auth.users`.

## 9) Smoke tests pós-deploy

Em ordem:

1. **Cadastro com email não-cliente** → deve mostrar "Não encontramos pedidos válidos com esse e-mail" (era o B1).
2. **Cadastro com email comprador** → ofertar 4 cupons disponíveis (era o B2 — antes apareciam todos como indisponíveis).
3. **Admin com filtro embaixadoras** → carrega <2s mesmo com 1.500+ registros (B4).
4. **Reset de senha** → email chega em <1min (B5).
5. **Sync manual** → POST em `/sync-orders?since=2025-01-01`, conferir linhas em `comissoes` (B3).
6. **Confirmação manual** → forçar 1 comissão com `return_window_ends_at < now()` e disparar `/confirm-commissions` → vira `confirmada`.
7. **Resgate** → embaixadora com saldo confirmado ≥ R$100 em dia ≤ 10 → solicita → aparece no admin.
8. **Aprovação + pagamento** → admin aprova → marca pago com upload de PDF → comissões viram `paga`.
