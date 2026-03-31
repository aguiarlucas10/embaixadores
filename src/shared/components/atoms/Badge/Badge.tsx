import styles from './Badge.module.css'

interface BadgeProps {
  text: string
  color?: string
}

export function Badge({ text, color = '#000' }: BadgeProps) {
  return (
    <span className={styles.badge} style={{ borderColor: color, color }}>
      {text}
    </span>
  )
}
