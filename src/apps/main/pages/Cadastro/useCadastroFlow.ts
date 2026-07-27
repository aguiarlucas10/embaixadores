import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@shared/services/supabase'
import { ordersByEmail, checkCoupon, createCoupon } from '@shared/services/nuvemshop'
import { gerarCupomBase } from '@shared/utils/coupon'
import { validarNome, validarEmail, validarCPF, validarWhatsApp, sanitizeObject } from '@shared/utils/validators'
import { DESCONTO_PCT } from './content'

export type Etapa = 'form' | 'cupom' | 'sucesso'

export interface CadastroFormData {
  nome: string; email: string; cpf: string
  whatsapp: string; instagram: string; tiktok: string
}

function getDeviceInfo() {
  const ua = navigator.userAgent
  const dispositivo = /Mobi|Android|iPhone|iPad/i.test(ua)
    ? (/iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile')
    : 'desktop'
  const so = /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux' : 'outro'
  const nav = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'outro'
  const params = new URLSearchParams(window.location.search)
  return {
    dispositivo, sistema_operacional: so, navegador: nav,
    largura_tela: window.screen.width,
    referrer: document.referrer || null,
    url_completa: window.location.href,
    utm_source:   params.get('utm_source')   || null,
    utm_medium:   params.get('utm_medium')   || null,
    utm_campaign: params.get('utm_campaign') || null,
    utm_content:  params.get('utm_content')  || null,
    utm_term:     params.get('utm_term')     || null,
  }
}

function gerarOpcoes(nome: string): string[] {
  const base = gerarCupomBase(nome)
  const partes = nome.trim().toUpperCase()
    .normalize('NFD').replace(/[^A-Z0-9 ]/g, '')
    .split(' ').filter(Boolean)
  const primeiro = partes[0] ?? ''
  const ultimo = partes[partes.length - 1] ?? ''
  const opcoes = new Set<string>()
  opcoes.add(base)
  if (primeiro) opcoes.add(('SGB' + primeiro).slice(0, 12))
  if (ultimo && ultimo !== primeiro) opcoes.add(('SGB' + ultimo).slice(0, 12))
  if (primeiro && ultimo && primeiro !== ultimo) opcoes.add(('SGB' + primeiro + ultimo).slice(0, 12))
  if (primeiro) opcoes.add(('SGB' + primeiro + new Date().getFullYear().toString().slice(2)).slice(0, 12))
  return [...opcoes].slice(0, 4)
}

interface UseCadastroFlowOptions {
  /**
   * Identificador da página de origem, gravado em `page_views.pagina`.
   * Permite comparar conversão entre landing pages distintas que reaproveitam este hook
   * (ex: 'cadastro' para a home atual, 'cadastro_nova' para variantes de teste A/B).
   */
  pagina: string
}

/**
 * Toda a lógica de negócio do fluxo de cadastro de embaixadoras: validação de campos,
 * verificação de cliente na Nuvemshop, geração/escolha de cupom, gravação no Supabase,
 * criação de conta e analytics de page view. Compartilhado entre todas as landing pages
 * de captação de embaixadoras — extrair mudanças de fluxo aqui, não em cada página.
 */
export function useCadastroFlow({ pagina }: UseCadastroFlowOptions) {
  const navigate = useNavigate()
  const [f, setF] = useState<CadastroFormData>({ nome: '', email: '', cpf: '', whatsapp: '', instagram: '', tiktok: '' })
  const [aceite, setAceite] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>('form')
  const [opcoesCupom, setOpcoesCupom] = useState<string[]>([])
  const [cupomEscolhido, setCupomEscolhido] = useState('')
  const [cupomFinal, setCupomFinal] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingFinalizar, setLoadingFinalizar] = useState(false)
  const [loadingAcesso, setLoadingAcesso] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: keyof CadastroFormData, v: string) => setF((p) => ({ ...p, [k]: v }))

  // Page view tracking
  const sessionIdRef = useRef<string | null>(null)
  const entradaRef = useRef(Date.now())
  const etapaRef = useRef<Etapa>('form')

  useEffect(() => {
    const info = getDeviceInfo()
    supabase.from('page_views').insert({
      pagina, etapa_entrada: 'form', etapa_saida: null,
      tempo_segundos: null, ...info, criado_em: new Date().toISOString(),
    }).select('id').single().then(({ data }) => {
      if (data?.id) sessionIdRef.current = data.id as string
    })
  }, [pagina])

  useEffect(() => { etapaRef.current = etapa }, [etapa])

  useEffect(() => {
    function salvarSaida() {
      if (!sessionIdRef.current) return
      const tempo = Math.round((Date.now() - entradaRef.current) / 1000)
      supabase.from('page_views').update({ etapa_saida: etapaRef.current, tempo_segundos: tempo })
        .eq('id', sessionIdRef.current).then(() => {})
    }
    window.addEventListener('beforeunload', salvarSaida)
    return () => window.removeEventListener('beforeunload', salvarSaida)
  }, [])

  async function avancarParaCupom() {
    setErr('')
    if (!f.nome || !f.email || !f.cpf || !f.whatsapp) { setErr('Preencha todos os campos obrigatórios.'); return }

    const erroNome = validarNome(f.nome)
    if (erroNome) { setErr(erroNome); return }
    const erroEmail = validarEmail(f.email)
    if (erroEmail) { setErr(erroEmail); return }
    const erroCPF = validarCPF(f.cpf)
    if (erroCPF) { setErr(erroCPF); return }
    const erroWhats = validarWhatsApp(f.whatsapp)
    if (erroWhats) { setErr(erroWhats); return }

    if (!aceite) { setErr('Aceite os termos para continuar.'); return }
    setLoading(true)
    try {
      const { data: ex } = await supabase.from('embaixadores').select('id').eq('email', f.email).maybeSingle()
      if (ex) { setErr('Este e-mail já está cadastrado. Acesse seu painel pelo login.'); setLoading(false); return }

      const ordersResult = await ordersByEmail(f.email)
      if (!ordersResult.ok) {
        if (ordersResult.errorKind === 'auth') {
          setErr('Erro de configuração no sistema (autenticação Nuvemshop). Avise a equipe.')
        } else {
          setErr('Não conseguimos consultar a base de pedidos agora. Tente novamente em alguns minutos.')
        }
        setLoading(false); return
      }
      if (!ordersResult.found) {
        setErr('Que pena! Não encontramos pedidos válidos com esse e-mail. Esse programa é exclusivo para clientes da Saint Germain.')
        setLoading(false); return
      }

      const opcoes = gerarOpcoes(f.nome)
      const checks = await Promise.all(opcoes.map((cod) => checkCoupon(cod)))
      const authError = checks.find((c) => c.state === 'error_auth')
      if (authError) {
        setErr('Erro de configuração no sistema (autenticação Nuvemshop). Avise a equipe.')
        setLoading(false); return
      }
      const otherError = checks.find((c) => !c.ok && c.state === 'error_other')
      if (otherError) {
        setErr('Não conseguimos verificar disponibilidade dos cupons agora. Tente novamente em alguns minutos.')
        setLoading(false); return
      }
      const disponiveis = opcoes.filter((_, i) => checks[i]!.state === 'available')
      if (!disponiveis.length) {
        setErr('Todas as variações do seu cupom já estão em uso. Entre em contato com a Saint Germain.')
        setLoading(false); return
      }

      setOpcoesCupom(disponiveis)
      setCupomEscolhido(disponiveis[0] ?? '')
      setEtapa('cupom')
    } catch (e) { setErr('Erro inesperado: ' + String(e)) }
    setLoading(false)
  }

  async function finalizar() {
    setErr(''); setLoadingFinalizar(true)
    try {
      let cod = cupomEscolhido
      const pct = DESCONTO_PCT * 100
      let criado = await createCoupon(cod, pct)
      if (!criado.ok && criado.state === 'taken') {
        for (let i = 2; i <= 9; i++) {
          cod = cupomEscolhido.slice(0, 10) + i
          criado = await createCoupon(cod, pct)
          if (criado.ok) break
          if (criado.state !== 'taken') break
        }
      }
      if (!criado.ok) {
        if (criado.state === 'error_auth') setErr('Erro de configuração (autenticação Nuvemshop). Avise a equipe.')
        else if (criado.state === 'taken') setErr('Este cupom já está em uso. Escolha outra opção.')
        else setErr('Erro ao criar cupom: ' + (criado.message ?? 'tente novamente'))
        setLoadingFinalizar(false); return
      }

      const safe = sanitizeObject(f as unknown as Record<string, unknown>) as unknown as typeof f
      const { error: dbErr } = await supabase.from('embaixadores').insert({
        nome: safe.nome, email: safe.email, cpf: safe.cpf, whatsapp: safe.whatsapp,
        instagram: safe.instagram || null, tiktok: safe.tiktok || null,
        cupom: cod, status: 'ativo', nivel: 'embaixadora',
      })
      if (dbErr) { setErr('Erro ao salvar cadastro: ' + dbErr.message); setLoadingFinalizar(false); return }
      setCupomFinal(cod)
      setEtapa('sucesso')
    } catch (e) { setErr('Erro inesperado: ' + String(e)) }
    setLoadingFinalizar(false)
  }

  async function criarContaEAcessar() {
    setErr('')
    if (!senha || senha.length < 6) { setErr('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== senhaConfirm) { setErr('As senhas não conferem.'); return }
    setLoadingAcesso(true)
    try {
      const { error: signUpErr } = await supabase.auth.signUp({ email: f.email, password: senha })
      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already') || signUpErr.status === 400) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: f.email, password: senha })
          if (signInErr) { setErr('Usuário já cadastrado. Acesse seu painel pelo login.'); setLoadingAcesso(false); return }
          navigate('/painel'); return
        }
        setErr('Erro ao criar acesso: ' + signUpErr.message)
        setLoadingAcesso(false); return
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: f.email, password: senha })
      if (signInErr) { setErr('Conta criada! Acesse pelo login com seu e-mail e senha.'); setLoadingAcesso(false); return }
      navigate('/painel')
    } catch (e) { setErr('Erro inesperado: ' + String(e)) }
    setLoadingAcesso(false)
  }

  return {
    f, set, aceite, setAceite, etapa, setEtapa,
    opcoesCupom, cupomEscolhido, setCupomEscolhido, cupomFinal,
    senha, setSenha, senhaConfirm, setSenhaConfirm,
    loading, loadingFinalizar, loadingAcesso, err, setErr,
    avancarParaCupom, finalizar, criarContaEAcessar,
  }
}
