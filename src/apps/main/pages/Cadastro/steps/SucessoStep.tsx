// Reaproveita o CSS da landing page original: telas internas (pós-clique) do fluxo,
// não fazem parte do teste A/B de conversão, então o visual é idêntico em todas as landing pages.
import { COMISSAO_PCT, DESCONTO_PCT } from '../content'
import styles from '../Cadastro.module.css'

interface SucessoStepProps {
  cupomFinal: string
  senha: string
  onSenhaChange: (v: string) => void
  senhaConfirm: string
  onSenhaConfirmChange: (v: string) => void
  err: string
  loading: boolean
  onAcessar: () => void
}

/** Tela de sucesso do cadastro + criação de senha — etapa interna do fluxo de cadastro de embaixadoras. */
export function SucessoStep({
  cupomFinal, senha, onSenhaChange, senhaConfirm, onSenhaConfirmChange, err, loading, onAcessar,
}: SucessoStepProps) {
  return (
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
                placeholder="Mínimo 6 caracteres" onChange={(e) => onSenhaChange(e.target.value)} />
            </div>
            <div className={styles.darkField}>
              <label className={styles.darkLabel}>Confirmar senha *</label>
              <input className={styles.darkInput} type="password" value={senhaConfirm}
                placeholder="" onChange={(e) => onSenhaConfirmChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onAcessar() }} />
            </div>
          </div>
          {err && <div className={styles.errBox}><p className={styles.errText}>{err}</p></div>}
          <button className={styles.btnWhite} onClick={onAcessar} disabled={loading}>
            {loading ? <span className={styles.spinnerDark} /> : 'Acessar meu painel'}
          </button>
        </div>
        <p className={styles.darkNote}>Em breve você receberá uma mensagem com os detalhes do programa e acesso ao grupo exclusivo.</p>
      </div>
    </div>
  )
}
