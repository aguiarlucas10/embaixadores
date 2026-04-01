import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@shared/services/supabase'
import { NS } from '@shared/services/nuvemshopApi'
import { gerarCupomBase } from '@shared/utils/coupon'
import { validarNome, validarEmail, validarCPF, validarWhatsApp, sanitizeObject } from '@shared/utils/validators'
import styles from './Cadastro.module.css'

const COMISSAO_PCT = Number(import.meta.env['VITE_COMISSAO_PCT'] ?? 0.1)
const DESCONTO_PCT = Number(import.meta.env['VITE_DESCONTO_PCT'] ?? 0.1)

// ─── LP sub-components ────────────────────────────────────────────────────────

function LPMarquee() {
  const text = 'SEJA EMBAIXADORA SAINT GERMAIN • SEJA EMBAIXADORA SAINT GERMAIN • '
  const full = text.repeat(8)
  return (
    <div className={styles.marqueeWrap}>
      <div className={styles.marqueeTrack}>{full}{full}</div>
    </div>
  )
}

function LPBenefits() {
  const items = [
    { num: 'I',   title: 'Cupom exclusivo',  desc: `Seu código personalizado que oferece ${(DESCONTO_PCT * 100).toFixed(0)}% de desconto para seus seguidores.` },
    { num: 'II',  title: 'Comissão mensal',   desc: `Ganhe ${(COMISSAO_PCT * 100).toFixed(0)}% de comissão sobre cada venda realizada com seu cupom.` },
    { num: 'III', title: 'Presentinhos VIP',  desc: 'Embaixadoras ativas recebem mimos e lançamentos exclusivos da Saint Germain.' },
    { num: 'IV',  title: 'Visibilidade',      desc: 'Suas fotos e perfil podem ser repostados nos canais oficiais da marca.' },
    { num: 'V',   title: 'Comunidade',        desc: 'Acesso ao grupo exclusivo com outras embaixadoras e novidades em primeira mão.' },
    { num: 'VI',  title: 'Crescimento',       desc: 'Dicas de conteúdo e estratégias para você crescer como influenciadora.' },
  ]
  return (
    <section className={styles.benefitsSection}>
      <div className={styles.sectionInner}>
        <p className={styles.sectionTag}>Por que ser embaixadora</p>
        <h2 className={styles.sectionTitle}>O que você <em>ganha?</em></h2>
        <div className={styles.benefitsGrid}>
          {items.map((it, i) => (
            <div key={i} className={styles.benefitCard}>
              <div className={styles.benefitNum}>{it.num}</div>
              <h3 className={styles.benefitTitle}>{it.title}</h3>
              <p className={styles.benefitDesc}>{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LPHowItWorks() {
  const steps = [
    { num: '01', title: 'Cadastre-se',      desc: 'Preencha o formulário abaixo com seus dados. O programa é exclusivo para clientes que já compraram na Saint Germain.' },
    { num: '02', title: 'Escolha seu cupom', desc: 'Você cria o seu código personalizado. Ex: SGBSEUINSTAGRAM. Simples e único.' },
    { num: '03', title: 'Divulgue',          desc: 'Compartilhe seu cupom com amigas e seguidoras. Cada compra feita com ele conta para você.' },
    { num: '04', title: 'Receba',            desc: `${(COMISSAO_PCT * 100).toFixed(0)}% de comissão sobre cada pedido pago com seu cupom, depositado diretamente para você. O pagamento dos resgates é realizado todo dia 20 — consulte a política no contrato.` },
  ]
  return (
    <section className={styles.howSection}>
      <div className={styles.sectionInner}>
        <p className={styles.sectionTag}>Simples assim</p>
        <h2 className={styles.sectionTitle}>Como <em>funciona?</em></h2>
        <div className={styles.stepsGrid}>
          {steps.map((s, i) => (
            <div key={i} className={`${styles.stepItem} ${i > 0 ? styles.stepBorderLeft : ''}`}>
              <div className={styles.stepNum}>{s.num}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LPFAQ() {
  const items = [
    { q: 'Preciso ser influenciadora?',              a: 'Não! O programa é para clientes que já amam a Saint Germain. Não importa o número de seguidores. O que vale é o carinho pela marca.' },
    { q: 'Preciso comprar produtos?',                a: 'Não é necessário ter comprado recentemente. Verificamos apenas se você já é cliente. Se ainda não é, faça sua primeira compra e depois se cadastre!' },
    { q: 'Como recebo a comissão?',                  a: 'Após o período de 7 dias de possível devolução, a comissão é contabilizada. Você indica seu PIX no painel e realizamos o pagamento mensalmente.' },
    { q: 'O desconto do cupom vale para mim também?', a: `Sim! Seu cupom também dá ${(DESCONTO_PCT * 100).toFixed(0)}% de desconto para qualquer pessoa que usar, inclusive você mesma em futuras compras.` },
    { q: 'Posso ser embaixadora mesmo sem redes sociais?', a: 'Sim! Você pode indicar para amigas, família ou qualquer pessoa. O cupom funciona para qualquer indicação.' },
  ]
  return (
    <section className={styles.faqSection}>
      <div className={styles.faqInner}>
        <p className={styles.sectionTag}>Dúvidas frequentes</p>
        <h2 className={styles.sectionTitle}>FAQ</h2>
        <div className={styles.faqList}>
          {items.map((it, i) => (
            <details key={i} className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                <span className={styles.faqQ}>{it.q}</span>
                <span className={styles.faqPlus}>+</span>
              </summary>
              <p className={styles.faqA}>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Analytics helper ─────────────────────────────────────────────────────────

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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, '')
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

// ─── Main component ───────────────────────────────────────────────────────────

type Etapa = 'form' | 'cupom' | 'sucesso'

interface FormData {
  nome: string; email: string; cpf: string
  whatsapp: string; instagram: string; tiktok: string
}

export function PageCadastro() {
  const navigate = useNavigate()
  const [f, setF] = useState<FormData>({ nome: '', email: '', cpf: '', whatsapp: '', instagram: '', tiktok: '' })
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

  const set = (k: keyof FormData, v: string) => setF((p) => ({ ...p, [k]: v }))

  // Page view tracking
  const sessionIdRef = useRef<string | null>(null)
  const entradaRef = useRef(Date.now())
  const etapaRef = useRef<Etapa>('form')

  useEffect(() => {
    const info = getDeviceInfo()
    supabase.from('page_views').insert({
      pagina: 'cadastro', etapa_entrada: 'form', etapa_saida: null,
      tempo_segundos: null, ...info, criado_em: new Date().toISOString(),
    }).select('id').single().then(({ data }) => {
      if (data?.id) sessionIdRef.current = data.id as string
    })
  }, [])

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

      const opcoesTentativas = gerarOpcoes(f.nome)
      for (const cod of opcoesTentativas) {
        const chkJson = await NS.checkCoupon(cod)
        if (chkJson.exists) {
          setErr('Já existe um cupom cadastrado para esse perfil. Entre em contato com a Saint Germain.')
          setLoading(false); return
        }
      }

      const pedidos = await NS.ordersByEmail(f.email)
      const statusValidos = ['paid', 'authorized', 'pending']
      const pedidosPagos = (pedidos ?? []).filter((p) => statusValidos.includes(p.payment_status))
      if (!pedidosPagos.length) {
        setErr('Que pena! Não encontramos pedidos válidos com esse e-mail. Esse programa é exclusivo para clientes da Saint Germain.')
        setLoading(false); return
      }

      const opcoes = gerarOpcoes(f.nome)
      setOpcoesCupom(opcoes)
      setCupomEscolhido(opcoes[0] ?? '')
      setEtapa('cupom')
    } catch { setErr('Erro inesperado. Tente novamente.') }
    setLoading(false)
  }

  async function finalizar() {
    setErr(''); setLoadingFinalizar(true)
    try {
      let cod = cupomEscolhido
      let criado = await NS.createCoupon(cod)
      if (!criado.ok && criado.duplicate) {
        for (let i = 2; i <= 9; i++) {
          cod = cupomEscolhido.slice(0, 10) + i
          criado = await NS.createCoupon(cod)
          if (criado.ok) break
          if (!criado.duplicate) break
        }
      }
      if (!criado.ok) { setErr('Este cupom já está em uso. Escolha outra opção.'); setLoadingFinalizar(false); return }

      const safe = sanitizeObject(f as unknown as Record<string, unknown>) as unknown as typeof f
      const { error: dbErr } = await supabase.from('embaixadores').insert({
        nome: safe.nome, email: safe.email, cpf: safe.cpf, whatsapp: safe.whatsapp,
        instagram: safe.instagram || null, tiktok: safe.tiktok || null,
        cupom: cod, status: 'ativo', nivel: 'embaixadora',
      })
      if (dbErr) { setErr('Erro ao salvar cadastro: ' + dbErr.message); setLoadingFinalizar(false); return }
      setCupomFinal(cod)
      setEtapa('sucesso')
    } catch { setErr('Erro inesperado. Tente novamente.') }
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

  // ── Tela: sucesso ──────────────────────────────────────────────────────────
  if (etapa === 'sucesso') return (
    <div className={styles.darkPage}>
      <header className={styles.darkHeader}>
        <span className={styles.darkBrand}>Saint Germain</span>
      </header>
      <div className={styles.darkContent}>
        <p className={styles.darkTag}>Bem-vindo ao time</p>
        <h1 className={styles.successTitle}>
          Você agora é<br />Embaixadora<br /><em>Saint Germain.</em>
        </h1>
        <div className={styles.cupomBox}>
          <span className={styles.cupomBoxLabel}>Seu cupom exclusivo</span>
          <span className={styles.cupomBoxCode}>{cupomFinal}</span>
          <span className={styles.cupomBoxSub}>
            {(DESCONTO_PCT * 100).toFixed(0)}% desconto — {(COMISSAO_PCT * 100).toFixed(0)}% comissão por venda
          </span>
        </div>
        <div className={styles.senhaSection}>
          <p className={styles.darkSubtag}>Crie sua senha de acesso</p>
          <div className={styles.darkFields}>
            <div className={styles.darkField}>
              <label className={styles.darkLabel}>Senha *</label>
              <input className={styles.darkInput} type="password" value={senha}
                placeholder="Mínimo 6 caracteres" onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className={styles.darkField}>
              <label className={styles.darkLabel}>Confirmar senha *</label>
              <input className={styles.darkInput} type="password" value={senhaConfirm}
                placeholder="" onChange={(e) => setSenhaConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') criarContaEAcessar() }} />
            </div>
          </div>
          {err && <div className={styles.errBox}><p className={styles.errText}>{err}</p></div>}
          <button className={styles.btnWhite} onClick={criarContaEAcessar} disabled={loadingAcesso}>
            {loadingAcesso ? <span className={styles.spinnerDark} /> : 'Acessar meu painel'}
          </button>
        </div>
        <p className={styles.darkNote}>Em breve você receberá uma mensagem com os detalhes do programa e acesso ao grupo exclusivo.</p>
      </div>
    </div>
  )

  // ── Tela: escolha do cupom ─────────────────────────────────────────────────
  if (etapa === 'cupom') return (
    <div className={styles.darkPage}>
      <header className={styles.darkHeader}>
        <span className={styles.darkBrand}>Saint Germain</span>
      </header>
      <div className={styles.darkContent}>
        <p className={styles.darkTag}>Quase lá</p>
        <h1 className={styles.cupomTitle}>Escolha seu<br /><em>cupom exclusivo.</em></h1>
        <p className={styles.cupomIntro}>
          Este será o código que seus seguidores usam para ganhar desconto — e você ganha comissão em cada venda.
        </p>
        <div className={styles.cupomOptions}>
          {opcoesCupom.map((op) => (
            <button key={op}
              className={`${styles.cupomOption} ${cupomEscolhido === op ? styles.cupomOptionActive : ''}`}
              onClick={() => setCupomEscolhido(op)}>
              <span>{op}</span>
              {cupomEscolhido === op && <span className={styles.cupomSelectedTag}>SELECIONADO</span>}
            </button>
          ))}
        </div>
        {err && <div className={styles.errBox}><p className={styles.errText}>{err}</p></div>}
        <button className={styles.btnWhite} onClick={finalizar} disabled={loadingFinalizar}>
          {loadingFinalizar ? <span className={styles.spinnerDark} /> : 'Confirmar e entrar no programa'}
        </button>
        <button className={styles.btnBack} onClick={() => { setEtapa('form'); setErr('') }}>
          Voltar
        </button>
      </div>
    </div>
  )

  // ── Landing page + formulário ─────────────────────────────────────────────
  return (
    <div className={styles.lpRoot}>
      {/* Header */}
      <header className={styles.lpHeader}>
        <span className={styles.lpBrand}>Saint Germain</span>
        <div className={styles.lpHeaderActions}>
          <button className={styles.lpHeaderCta}
            onClick={() => document.getElementById('sg-form-section')?.scrollIntoView({ behavior: 'smooth' })}>
            Cadastre-se
          </button>
          <button className={styles.lpHeaderLogin} onClick={() => navigate('/login')}>
            Entrar
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroTag}>Programa Exclusivo</p>
          <h1 className={styles.heroTitle}>
            Clientes<br /><em>Embaixadores</em><br />Saint Germain.
          </h1>
          <p className={styles.heroSub}>
            Transforme seu amor pela marca em recompensas reais. Cupom exclusivo, comissões mensais e benefícios para quem já faz parte da história da Saint Germain.
          </p>
          <div className={styles.heroBtns}>
            <button className={styles.heroBtnPrimary}
              onClick={() => document.getElementById('sg-form-section')?.scrollIntoView({ behavior: 'smooth' })}>
              Quero ser embaixadora
            </button>
            <button className={styles.heroBtnSecondary}
              onClick={() => document.getElementById('sg-como-funciona')?.scrollIntoView({ behavior: 'smooth' })}>
              Como funciona
            </button>
          </div>
        </div>
      </section>

      <LPMarquee />

      {/* Video + copy */}
      <section className={styles.videoSection}>
        <div className={styles.videoInner}>
          <div className={styles.videoEmbed}>
            <iframe
              src="https://www.youtube.com/embed/yqjW3oJNB0c?start=50&autoplay=1&mute=1&loop=1&playlist=yqjW3oJNB0c"
              title="Saint Germain Embaixadoras"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={styles.videoIframe}
            />
          </div>
          <div className={styles.videoCopy}>
            <h2 className={styles.videoCopyTitle}>O que muda quando<br /><em>você entra.</em></h2>
            <div className={styles.videoCopyLines}>
              {[
                'Você passa a conhecer os lançamentos antes de todo mundo.',
                'Você entra em um grupo seleto de pessoas que, assim como você, escolheram a SG.',
                'Você é vista. Repostada. Reconhecida.',
                'E cada vez que alguém compra pelo seu cupom, você recebe também.',
              ].map((line, i) => (
                <div key={i} className={styles.videoCopyLine}>
                  <span className={styles.videoCopyDash}>-</span>
                  <p className={styles.videoCopyText}>{line}</p>
                </div>
              ))}
            </div>
            <div className={styles.videoCopyCta}>
              <button className={styles.heroBtnDark}
                onClick={() => document.getElementById('sg-form-section')?.scrollIntoView({ behavior: 'smooth' })}>
                Cadastre-se agora
              </button>
            </div>
          </div>
        </div>
      </section>

      <LPBenefits />

      <LPMarquee />

      <div id="sg-como-funciona">
        <LPHowItWorks />
      </div>

      {/* Callout strip */}
      <section className={styles.calloutSection}>
        <p className={styles.calloutTag}>Exclusivo para clientes</p>
        <h2 className={styles.calloutTitle}>
          Não é preciso ter seguidores.<br /><em>Só precisa amar a Saint Germain.</em>
        </h2>
        <p className={styles.calloutText}>
          O programa é para quem já comprou na nossa loja. Sem custo, sem burocracia. Você indica, a gente acompanha e você recebe.
        </p>
        <button className={styles.heroBtnWhite}
          onClick={() => document.getElementById('sg-form-section')?.scrollIntoView({ behavior: 'smooth' })}>
          Cadastre-se agora
        </button>
      </section>

      {/* Form section */}
      <section id="sg-form-section" className={styles.formSection}>
        <div className={styles.formInner}>
          <p className={styles.formTag}>Programa Embaixadoras</p>
          <h2 className={styles.formTitle}>Pronta para<br /><em>entrar no time?</em></h2>
          <p className={styles.formSub}>
            Preencha os dados abaixo. Verificamos automaticamente se você é cliente da Saint Germain.
          </p>
          <div className={styles.formBox}>
            <div className={styles.formFields}>
              {([
                { label: 'Nome completo *', key: 'nome',      type: 'text',  ph: '' },
                { label: 'E-mail *',        key: 'email',     type: 'email', ph: 'O mesmo utilizado na loja' },
                { label: 'CPF *',           key: 'cpf',       type: 'text',  ph: '' },
                { label: 'WhatsApp *',      key: 'whatsapp',  type: 'text',  ph: '(11) 99999-9999' },
                { label: 'Instagram',       key: 'instagram', type: 'text',  ph: '@' },
                { label: 'TikTok',          key: 'tiktok',    type: 'text',  ph: '@' },
              ] as const).map((field) => (
                <div key={field.key} className={styles.formField}>
                  <label className={styles.formLabel}>{field.label}</label>
                  <input className={styles.formInput} type={field.type}
                    value={f[field.key]} placeholder={field.ph}
                    onChange={(e) => set(field.key, e.target.value)} />
                </div>
              ))}
            </div>

            <div className={styles.formCheckbox}>
              <input type="checkbox" id="aceite-lp" checked={aceite}
                onChange={(e) => setAceite(e.target.checked)} className={styles.checkbox} />
              <label htmlFor="aceite-lp" className={styles.checkboxLabel}>
                Aceito os termos do programa e autorizo o uso da minha imagem em publicações relacionadas ao programa Clientes Embaixadores da Saint Germain.
              </label>
            </div>

            {err && <div className={styles.errBoxLight}><p className={styles.errText}>{err}</p></div>}

            <button className={styles.btnBlack} onClick={avancarParaCupom} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Continuar'}
            </button>

            <p className={styles.formFooter}>
              Já é embaixadora?{' '}
              <button className={styles.formFooterLink} onClick={() => navigate('/login')}>
                Acesse seu painel
              </button>
            </p>
          </div>
        </div>
      </section>

      <LPFAQ />

      {/* Rules */}
      <section className={styles.rulesSection}>
        <div className={styles.rulesInner}>
          <details>
            <summary className={styles.rulesSummary}>
              <div className={styles.rulesSummaryLeft}>
                <span className={styles.rulesTag}>Importante</span>
                <span className={styles.rulesLabel}>Regras de uso do cupom</span>
              </div>
              <span className={styles.rulesPlus}>+</span>
            </summary>
            <div className={styles.rulesList}>
              {[
                { titulo: 'Proibido comentários com cupons',          texto: 'É vedado comentar seus cupons em publicações oficiais da nossa marca, ou de nossos seguidores.' },
                { titulo: 'Compartilhamento privado indevido',        texto: 'O envio de cupons por mensagem privada para nossos clientes e seguidores também não é permitido.' },
                { titulo: 'Criação de contas somente para divulgação', texto: 'A criação de contas com o único propósito de divulgar cupons é estritamente proibida.' },
              ].map((r, i) => (
                <div key={i} className={`${styles.ruleItem} ${i < 2 ? styles.ruleItemBorder : ''}`}>
                  <span className={styles.ruleNum}>0{i + 1}</span>
                  <div>
                    <p className={styles.ruleTitle}>{r.titulo}</p>
                    <p className={styles.ruleText}>{r.texto}</p>
                  </div>
                </div>
              ))}
              <p className={styles.rulesDisclaimer}>
                O descumprimento dessas regras pode resultar no cancelamento do cupom e desligamento do programa, sem direito a comissões pendentes.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>Saint Germain - Programa Clientes Embaixadoras</p>
      </footer>
    </div>
  )
}
