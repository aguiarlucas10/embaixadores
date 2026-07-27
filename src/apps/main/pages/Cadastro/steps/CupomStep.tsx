// Reaproveita o CSS da landing page original: telas internas (pós-clique) do fluxo,
// não fazem parte do teste A/B de conversão, então o visual é idêntico em todas as landing pages.
import styles from '../Cadastro.module.css'

interface CupomStepProps {
  opcoesCupom: string[]
  cupomEscolhido: string
  onEscolher: (codigo: string) => void
  err: string
  loading: boolean
  onConfirmar: () => void
  onVoltar: () => void
}

/** Tela de escolha do código de cupom — etapa interna do fluxo de cadastro de embaixadoras. */
export function CupomStep({ opcoesCupom, cupomEscolhido, onEscolher, err, loading, onConfirmar, onVoltar }: CupomStepProps) {
  return (
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
              onClick={() => onEscolher(op)}>
              <span>{op}</span>
              {cupomEscolhido === op && <span className={styles.cupomSelectedTag}>SELECIONADO</span>}
            </button>
          ))}
        </div>
        {err && <div className={styles.errBox}><p className={styles.errText}>{err}</p></div>}
        <button className={styles.btnWhite} onClick={onConfirmar} disabled={loading}>
          {loading ? <span className={styles.spinnerDark} /> : 'Confirmar e entrar no programa'}
        </button>
        <button className={styles.btnBack} onClick={onVoltar}>
          Voltar
        </button>
      </div>
    </div>
  )
}
