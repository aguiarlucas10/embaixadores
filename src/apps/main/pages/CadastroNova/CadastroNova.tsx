import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCadastroFlow } from '../Cadastro/useCadastroFlow'
import { CupomStep } from '../Cadastro/steps/CupomStep'
import { SucessoStep } from '../Cadastro/steps/SucessoStep'
import { BENEFITS, HOW_IT_WORKS_STEPS, FAQ_ITEMS, RULES, MARQUEE_TEXT, VIDEO_COPY_LINES } from '../Cadastro/content'
import { SplitLayout } from '@shared/components/layout/SplitLayout/SplitLayout'
import { Input } from '@shared/components/atoms/Input/Input'
import { BtnPrimary, TextLink } from '@shared/components/atoms/Button/Button'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import styles from './CadastroNova.module.css'
// Seções mantidas visualmente idênticas à home atual (marquee, FAQ, regras, rodapé) —
// não fazem parte da hipótese de teste A/B, então reaproveitam o CSS original.
import sharedStyles from '../Cadastro/Cadastro.module.css'

function Marquee() {
  const full = MARQUEE_TEXT.repeat(8)
  return (
    <div className={sharedStyles.marqueeWrap}>
      <div className={sharedStyles.marqueeTrack}>{full}{full}</div>
    </div>
  )
}

function FAQSection() {
  return (
    <section className={sharedStyles.faqSection}>
      <div className={sharedStyles.faqInner}>
        <p className={sharedStyles.sectionTag}>Dúvidas frequentes</p>
        <h2 className={sharedStyles.sectionTitle}>FAQ</h2>
        <div className={sharedStyles.faqList}>
          {FAQ_ITEMS.map((it, i) => (
            <details key={i} className={sharedStyles.faqItem}>
              <summary className={sharedStyles.faqSummary}>
                <span className={sharedStyles.faqQ}>{it.q}</span>
                <span className={sharedStyles.faqPlus}>+</span>
              </summary>
              <p className={sharedStyles.faqA}>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function RulesSection() {
  return (
    <section className={sharedStyles.rulesSection}>
      <div className={sharedStyles.rulesInner}>
        <details>
          <summary className={sharedStyles.rulesSummary}>
            <div className={sharedStyles.rulesSummaryLeft}>
              <span className={sharedStyles.rulesTag}>Importante</span>
              <span className={sharedStyles.rulesLabel}>Regras de uso do cupom</span>
            </div>
            <span className={sharedStyles.rulesPlus}>+</span>
          </summary>
          <div className={sharedStyles.rulesList}>
            {RULES.map((r, i) => (
              <div key={i} className={`${sharedStyles.ruleItem} ${i < RULES.length - 1 ? sharedStyles.ruleItemBorder : ''}`}>
                <span className={sharedStyles.ruleNum}>0{i + 1}</span>
                <div>
                  <p className={sharedStyles.ruleTitle}>{r.titulo}</p>
                  <p className={sharedStyles.ruleText}>{r.texto}</p>
                </div>
              </div>
            ))}
            <p className={sharedStyles.rulesDisclaimer}>
              O descumprimento dessas regras pode resultar no cancelamento do cupom e desligamento do programa, sem direito a comissões pendentes.
            </p>
          </div>
        </details>
      </div>
    </section>
  )
}

const FIELDS = [
  { label: 'Nome completo *', key: 'nome',      type: 'text',  ph: '' },
  { label: 'E-mail *',        key: 'email',     type: 'email', ph: 'O mesmo utilizado na loja' },
  { label: 'CPF *',           key: 'cpf',       type: 'text',  ph: '' },
  { label: 'WhatsApp *',      key: 'whatsapp',  type: 'text',  ph: '(11) 99999-9999' },
  { label: 'Instagram',       key: 'instagram', type: 'text',  ph: '@' },
  { label: 'TikTok',          key: 'tiktok',    type: 'text',  ph: '@' },
] as const

/**
 * Landing page alternativa (teste A/B) de captação de embaixadoras: hipótese
 * "formulário primeiro" — hero em split-screen com o formulário já visível acima da
 * dobra, em vez do storytelling longo da home atual (Cadastro.tsx). Reaproveita o
 * mesmo fluxo de cadastro (useCadastroFlow) e a mesma copy (content.ts).
 */
export function PageCadastroNova() {
  const navigate = useNavigate()
  const {
    f, set, aceite, setAceite, etapa, setEtapa,
    opcoesCupom, cupomEscolhido, setCupomEscolhido, cupomFinal,
    senha, setSenha, senhaConfirm, setSenhaConfirm,
    loading, loadingFinalizar, loadingAcesso, err, setErr,
    avancarParaCupom, finalizar, criarContaEAcessar,
  } = useCadastroFlow({ pagina: 'cadastro_nova' })

  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => {
    function onScroll() {
      setShowStickyCta(window.scrollY > window.innerHeight * 0.7)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToForm() {
    document.getElementById('form-topo')?.scrollIntoView({ behavior: 'smooth' })
  }

  if (etapa === 'sucesso') return (
    <SucessoStep
      cupomFinal={cupomFinal}
      senha={senha}
      onSenhaChange={setSenha}
      senhaConfirm={senhaConfirm}
      onSenhaConfirmChange={setSenhaConfirm}
      err={err}
      loading={loadingAcesso}
      onAcessar={criarContaEAcessar}
    />
  )

  if (etapa === 'cupom') return (
    <CupomStep
      opcoesCupom={opcoesCupom}
      cupomEscolhido={cupomEscolhido}
      onEscolher={setCupomEscolhido}
      err={err}
      loading={loadingFinalizar}
      onConfirmar={finalizar}
      onVoltar={() => { setEtapa('form'); setErr('') }}
    />
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Saint Germain</span>
        <button className={styles.headerLogin} onClick={() => navigate('/login')}>
          Entrar
        </button>
      </header>

      <div id="form-topo">
        <SplitLayout
          left={
            <div className={`stagger ${styles.heroLeft}`}>
              <p className={styles.heroTag}>Programa Exclusivo</p>
              <h1 className={styles.heroHeadline}>
                Você já ama<br /><em>Saint Germain.</em><br />Agora, ganhe por isso.
              </h1>
              <div className={styles.heroBenefitList}>
                {BENEFITS.slice(0, 3).map((b, i) => (
                  <div key={i} className={styles.heroBenefitItem}>
                    <span className={styles.heroBenefitNum}>{b.num}</span>
                    <div>
                      <p className={styles.heroBenefitTitle}>{b.title}</p>
                      <p className={styles.heroBenefitDesc}>{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
          right={
            <div className={`stagger ${styles.heroRight}`}>
              <p className={styles.formEyebrow}>Cadastro rápido</p>
              <p className={styles.formIntro}>{FAQ_ITEMS[0]!.a}</p>

              <div className={styles.fields}>
                {FIELDS.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    type={field.type}
                    value={f[field.key]}
                    placeholder={field.ph}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                ))}
              </div>

              <div className={styles.formCheckbox}>
                <input type="checkbox" id="aceite-nova" checked={aceite}
                  onChange={(e) => setAceite(e.target.checked)} className={styles.checkbox} />
                <label htmlFor="aceite-nova" className={styles.checkboxLabel}>
                  Aceito os termos do programa e autorizo o uso da minha imagem em publicações relacionadas ao programa Clientes Embaixadores da Saint Germain.
                </label>
              </div>

              {err && <div className={styles.alertWrap}><Alert msg={err} /></div>}

              <BtnPrimary onClick={avancarParaCupom} loading={loading}>Continuar</BtnPrimary>

              <p className={styles.footerNote}>
                Já é embaixadora?{' '}
                <TextLink onClick={() => navigate('/login')}>Acesse seu painel</TextLink>
              </p>
            </div>
          }
        />
      </div>

      {/* ── Seções de convencimento (para quem rolou sem se cadastrar) ──────── */}

      <section className={styles.howSection}>
        <div className={styles.sectionInner}>
          <p className={styles.condensedTag}>Simples assim</p>
          <h2 className={styles.condensedTitle}>Como <em>funciona?</em></h2>
          <div className={styles.stepsRow}>
            {HOW_IT_WORKS_STEPS.map((s, i) => (
              <div key={i} className={styles.stepItem}>
                <div className={styles.stepNum}>{s.num}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Marquee />

      <section className={styles.benefitsSection}>
        <div className={styles.sectionInner}>
          <p className={styles.condensedTag}>Por que ser embaixadora</p>
          <h2 className={styles.condensedTitle}>O que você <em>ganha?</em></h2>
          <div className={styles.benefitsGrid}>
            {BENEFITS.map((it, i) => (
              <div key={i} className={styles.benefitCard}>
                <p className={styles.benefitTitle}>{it.title}</p>
                <p className={styles.benefitDesc}>{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.videoSection}>
        <div className={styles.videoInner}>
          <p className={styles.videoTeaser}>
            {VIDEO_COPY_LINES[VIDEO_COPY_LINES.length - 1]} Quer ver mais?
          </p>
          <div className={styles.videoEmbed}>
            <iframe
              src="https://www.youtube.com/embed/yqjW3oJNB0c?start=50"
              title="Saint Germain Embaixadoras"
              frameBorder="0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={styles.videoIframe}
            />
          </div>
        </div>
      </section>

      <FAQSection />
      <RulesSection />

      <div className={styles.backToFormWrap}>
        <p className={styles.backToFormTitle}>Pronta para entrar no time?</p>
        <button className={styles.backToFormBtn} onClick={scrollToForm}>
          Voltar ao formulário
        </button>
      </div>

      <footer className={sharedStyles.footer}>
        <p className={sharedStyles.footerText}>Saint Germain - Programa Clientes Embaixadoras</p>
      </footer>

      {showStickyCta && (
        <div className={styles.stickyCta}>
          <button className={styles.stickyCtaBtn} onClick={scrollToForm}>
            Quero ser embaixadora →
          </button>
        </div>
      )}
    </div>
  )
}
