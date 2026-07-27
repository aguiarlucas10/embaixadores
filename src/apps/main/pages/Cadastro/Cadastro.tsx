import { useNavigate } from 'react-router-dom'
import { useCadastroFlow } from './useCadastroFlow'
import { CupomStep } from './steps/CupomStep'
import { SucessoStep } from './steps/SucessoStep'
import { BENEFITS, HOW_IT_WORKS_STEPS, FAQ_ITEMS, RULES, MARQUEE_TEXT, VIDEO_COPY_LINES } from './content'
import styles from './Cadastro.module.css'

// ─── LP sub-components ────────────────────────────────────────────────────────

function LPMarquee() {
  const full = MARQUEE_TEXT.repeat(8)
  return (
    <div className={styles.marqueeWrap}>
      <div className={styles.marqueeTrack}>{full}{full}</div>
    </div>
  )
}

function LPBenefits() {
  return (
    <section className={styles.benefitsSection}>
      <div className={styles.sectionInner}>
        <p className={styles.sectionTag}>Por que ser embaixadora</p>
        <h2 className={styles.sectionTitle}>O que você <em>ganha?</em></h2>
        <div className={styles.benefitsGrid}>
          {BENEFITS.map((it, i) => (
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
  return (
    <section className={styles.howSection}>
      <div className={styles.sectionInner}>
        <p className={styles.sectionTag}>Simples assim</p>
        <h2 className={styles.sectionTitle}>Como <em>funciona?</em></h2>
        <div className={styles.stepsGrid}>
          {HOW_IT_WORKS_STEPS.map((s, i) => (
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
  return (
    <section className={styles.faqSection}>
      <div className={styles.faqInner}>
        <p className={styles.sectionTag}>Dúvidas frequentes</p>
        <h2 className={styles.sectionTitle}>FAQ</h2>
        <div className={styles.faqList}>
          {FAQ_ITEMS.map((it, i) => (
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

// ─── Main component ───────────────────────────────────────────────────────────

export function PageCadastro() {
  const navigate = useNavigate()
  const {
    f, set, aceite, setAceite, etapa, setEtapa,
    opcoesCupom, cupomEscolhido, setCupomEscolhido, cupomFinal,
    senha, setSenha, senhaConfirm, setSenhaConfirm,
    loading, loadingFinalizar, loadingAcesso, err, setErr,
    avancarParaCupom, finalizar, criarContaEAcessar,
  } = useCadastroFlow({ pagina: 'cadastro' })

  // ── Tela: sucesso ──────────────────────────────────────────────────────────
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

  // ── Tela: escolha do cupom ─────────────────────────────────────────────────
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
              {VIDEO_COPY_LINES.map((line, i) => (
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
              {RULES.map((r, i) => (
                <div key={i} className={`${styles.ruleItem} ${i < RULES.length - 1 ? styles.ruleItemBorder : ''}`}>
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
