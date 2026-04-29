/**
 * Tipos TypeScript das tabelas Supabase do projeto Embaixadores.
 * Reflecte o schema atual usado nos arquivos legados.
 */

export type NivelEmbaixador = 'embaixadora' | 'influenciadora' | 'destaque'
export type StatusEmbaixador = 'ativo' | 'inativo' | 'pendente'
export type StatusComissao = 'pendente' | 'confirmada' | 'resgatada' | 'paga' | 'cancelada'
export type StatusResgate = 'pendente' | 'solicitado' | 'aprovado' | 'recusado' | 'rejeitado' | 'pago'
export type TipoResgate = 'pix'
export type StatusPagamento = 'pending' | 'paid' | 'refunded' | 'cancelled' | 'voided' | 'abandoned' | 'authorized'
export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random'

// ─── Embaixador (programa principal) ─────────────────────────────────────────

export interface Embaixador {
  id: string
  nome: string
  email: string
  whatsapp: string
  cpf?: string
  instagram?: string
  tiktok?: string
  cupom: string
  nivel: NivelEmbaixador
  status: StatusEmbaixador
  pix_key?: string
  criado_em: string
  ultima_atividade?: string
}

// ─── Embaixador SG (programa Saint Germain) ───────────────────────────────────

export interface EmbaixadorSG {
  id: string
  nome: string
  email: string
  whatsapp: string
  cpf?: string
  instagram?: string
  tiktok?: string
  cupom: string
  nivel: NivelEmbaixador
  status: StatusEmbaixador
  pix_key?: string
  criado_em: string
  ultima_atividade?: string
}

// ─── Comissão (programa principal) ───────────────────────────────────────────

export interface Comissao {
  id: string
  embaixador_id: string
  pedido_id: string
  valor_pedido: number
  valor_comissao: number
  status: StatusComissao
  payment_status: StatusPagamento
  resgatada: boolean
  criado_em: string
  confirmado_em?: string
  data_pedido?: string
  return_window_ends_at?: string
  confirmed_at?: string
  cancelled_at?: string
  cancelled_reason?: string
  resgate_id?: string | null
  embaixadores?: Pick<Embaixador, 'nome' | 'email' | 'cupom'>
}

// ─── Comissão SG ──────────────────────────────────────────────────────────────

export interface ComissaoSG {
  id: string
  embaixador_id: string
  pedido_id: string
  valor_pedido: number
  valor_comissao: number
  status: StatusComissao
  payment_status: StatusPagamento
  resgatada: boolean
  criado_em: string
  confirmado_em?: string
  embaixadores_sg?: Pick<EmbaixadorSG, 'nome' | 'email' | 'cupom'>
}

// ─── Resgate ──────────────────────────────────────────────────────────────────

export interface Resgate {
  id: string
  embaixador_id: string
  valor: number
  tipo: TipoResgate
  pix_key: string
  pix_key_type?: PixKeyType
  status: StatusResgate
  criado_em: string
  processado_em?: string
  approved_at?: string
  paid_at?: string
  rejected_at?: string
  approved_by?: string
  paid_by?: string
  payment_proof_url?: string
  admin_notes?: string
  embaixadores?: Pick<Embaixador, 'nome' | 'email'>
}

export interface ResgateSG {
  id: string
  embaixador_id: string
  valor: number
  tipo: TipoResgate
  pix_key: string
  status: StatusResgate
  criado_em: string
  processado_em?: string
  embaixadores_sg?: Pick<EmbaixadorSG, 'nome' | 'email'>
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface Config {
  chave: string
  valor: string
}

// ─── Page Views ───────────────────────────────────────────────────────────────

export interface PageView {
  id: string
  session_id: string
  dispositivo?: string
  sistema_operacional?: string
  navegador?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  etapa_saida?: string
  tempo_segundos?: number
  criado_em: string
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export interface MensagemWhatsApp {
  id: string
  telefone: string
  mensagem: string
  de_nos: boolean
  lida: boolean
  criado_em: string
}

export interface AgendamentoDisparo {
  id: string
  template_name: string
  destino: string
  data_hora: string
  status: 'pendente' | 'enviado' | 'cancelado'
  criado_em: string
}

// ─── Pré-estreia ──────────────────────────────────────────────────────────────

export interface PreEstreia {
  id: string
  nome: string
  telefone: string
  disparos?: number
  criado_em: string
}

// ─── Tipo Database para o cliente Supabase tipado ────────────────────────────
// O banco tem colunas extras (comissao_pct, aceite_termos_em, pagina, etc.)
// que não estão em todas as interfaces TS. Usamos Record<string, unknown>
// para Insert/Update para aceitar qualquer campo sem conflito de tipos.

type R = Record<string, unknown>

export interface Database {
  public: {
    Tables: {
      embaixadores: { Row: Embaixador; Insert: R; Update: R }
      embaixadores_sg: { Row: EmbaixadorSG; Insert: R; Update: R }
      comissoes: { Row: Comissao; Insert: R; Update: R }
      comissoes_sg: { Row: ComissaoSG; Insert: R; Update: R }
      resgates: { Row: Resgate; Insert: R; Update: R }
      resgates_sg: { Row: ResgateSG; Insert: R; Update: R }
      config: { Row: Config; Insert: R; Update: R }
      page_views: { Row: PageView; Insert: R; Update: R }
      mensagens_whatsapp: { Row: MensagemWhatsApp; Insert: R; Update: R }
      agendamentos_disparo: { Row: AgendamentoDisparo; Insert: R; Update: R }
      pre_estreia: { Row: PreEstreia; Insert: R; Update: R }
    }
  }
}
