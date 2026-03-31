import styles from './Alert.module.css'

interface AlertProps {
  msg?: string | null
  ok?: boolean
}

export function Alert({ msg, ok = false }: AlertProps) {
  if (!msg) return null
  return (
    <div className={`${styles.alert} ${ok ? styles.ok : ''}`}>
      {msg}
    </div>
  )
}
