/**
 * Copy compartilhada entre as landing pages de cadastro de embaixadoras (Saint Germain).
 * Fonte única das promessas/benefícios já validados da marca — qualquer alteração de texto
 * deve ser feita aqui para refletir em todas as páginas que a consomem (Cadastro, CadastroNova).
 */

export const COMISSAO_PCT = Number(import.meta.env['VITE_COMISSAO_PCT'] ?? 0.1)
export const DESCONTO_PCT = Number(import.meta.env['VITE_DESCONTO_PCT'] ?? 0.1)

export const MARQUEE_TEXT = 'SEJA EMBAIXADORA SAINT GERMAIN • SEJA EMBAIXADORA SAINT GERMAIN • '

export interface BenefitItem {
  num: string
  title: string
  desc: string
}

export const BENEFITS: BenefitItem[] = [
  { num: 'I',   title: 'Cupom exclusivo',  desc: `Seu código personalizado que oferece ${(DESCONTO_PCT * 100).toFixed(0)}% de desconto para seus seguidores.` },
  { num: 'II',  title: 'Comissão mensal',   desc: `Ganhe ${(COMISSAO_PCT * 100).toFixed(0)}% de comissão sobre cada venda realizada com seu cupom.` },
  { num: 'III', title: 'Presentinhos VIP',  desc: 'Embaixadoras ativas recebem mimos e lançamentos exclusivos da Saint Germain.' },
  { num: 'IV',  title: 'Visibilidade',      desc: 'Suas fotos e perfil podem ser repostados nos canais oficiais da marca.' },
  { num: 'V',   title: 'Comunidade',        desc: 'Acesso ao grupo exclusivo com outras embaixadoras e novidades em primeira mão.' },
  { num: 'VI',  title: 'Crescimento',       desc: 'Dicas de conteúdo e estratégias para você crescer como influenciadora.' },
]

export interface HowItWorksStep {
  num: string
  title: string
  desc: string
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  { num: '01', title: 'Cadastre-se',      desc: 'Preencha o formulário abaixo com seus dados. O programa é exclusivo para clientes que já compraram na Saint Germain.' },
  { num: '02', title: 'Escolha seu cupom', desc: 'Você cria o seu código personalizado. Ex: SGBSEUINSTAGRAM. Simples e único.' },
  { num: '03', title: 'Divulgue',          desc: 'Compartilhe seu cupom com amigas e seguidoras. Cada compra feita com ele conta para você.' },
  { num: '04', title: 'Receba',            desc: `${(COMISSAO_PCT * 100).toFixed(0)}% de comissão sobre cada pedido pago com seu cupom, depositado diretamente para você. O pagamento dos resgates é realizado todo dia 20 — consulte a política no contrato.` },
]

export interface FaqItem {
  q: string
  a: string
}

export const FAQ_ITEMS: FaqItem[] = [
  { q: 'Preciso ser influenciadora?',              a: 'Não! O programa é para clientes que já amam a Saint Germain. Não importa o número de seguidores. O que vale é o carinho pela marca.' },
  { q: 'Preciso comprar produtos?',                a: 'Não é necessário ter comprado recentemente. Verificamos apenas se você já é cliente. Se ainda não é, faça sua primeira compra e depois se cadastre!' },
  { q: 'Como recebo a comissão?',                  a: 'Após o período de 7 dias de possível devolução, a comissão é contabilizada. Você indica seu PIX no painel e realizamos o pagamento mensalmente.' },
  { q: 'O desconto do cupom vale para mim também?', a: `Sim! Seu cupom também dá ${(DESCONTO_PCT * 100).toFixed(0)}% de desconto para qualquer pessoa que usar, inclusive você mesma em futuras compras.` },
  { q: 'Posso ser embaixadora mesmo sem redes sociais?', a: 'Sim! Você pode indicar para amigas, família ou qualquer pessoa. O cupom funciona para qualquer indicação.' },
]

export interface RuleItem {
  titulo: string
  texto: string
}

export const RULES: RuleItem[] = [
  { titulo: 'Proibido comentários com cupons',          texto: 'É vedado comentar seus cupons em publicações oficiais da nossa marca, ou de nossos seguidores.' },
  { titulo: 'Compartilhamento privado indevido',        texto: 'O envio de cupons por mensagem privada para nossos clientes e seguidores também não é permitido.' },
  { titulo: 'Criação de contas somente para divulgação', texto: 'A criação de contas com o único propósito de divulgar cupons é estritamente proibida.' },
]

/** Linhas de copy da seção de vídeo — usadas na home atual e disponíveis para outras landing pages. */
export const VIDEO_COPY_LINES: string[] = [
  'Você passa a conhecer os lançamentos antes de todo mundo.',
  'Você entra em um grupo seleto de pessoas que, assim como você, escolheram a SG.',
  'Você é vista. Repostada. Reconhecida.',
  'E cada vez que alguém compra pelo seu cupom, você recebe também.',
]
