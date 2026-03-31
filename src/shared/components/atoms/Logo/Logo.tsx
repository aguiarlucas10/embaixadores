import styles from './Logo.module.css'

interface LogoProps {
  sub?: boolean
  subtitle?: string
}

export function Logo({ sub = true, subtitle }: LogoProps) {
  const label = subtitle ?? (sub ? 'Clientes Embaixadores' : null)
  return (
    <div>
      <div className={styles.brand}>Saint Germain</div>
      {label && <div className={styles.sub}>{label}</div>}
    </div>
  )
}
