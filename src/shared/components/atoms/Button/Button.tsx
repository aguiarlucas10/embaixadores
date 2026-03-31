import type { CSSProperties, ReactNode } from 'react'
import styles from './Button.module.css'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  style?: CSSProperties
  type?: 'button' | 'submit' | 'reset'
}

export function BtnPrimary({ children, onClick, loading, disabled, style: sx, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      className={`sg-btn-primary ${styles.primary}`}
      onClick={onClick}
      disabled={loading || disabled}
      style={sx}
    >
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  )
}

export function BtnSecondary({ children, onClick, style: sx, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      className={`sg-btn-secondary ${styles.secondary}`}
      onClick={onClick}
      style={sx}
    >
      {children}
    </button>
  )
}

export function BtnGhost({ children, onClick, style: sx, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      className={`sg-btn-ghost ${styles.ghost}`}
      onClick={onClick}
      style={sx}
    >
      {children}
    </button>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={styles.textLink} onClick={onClick}>
      {children}
    </button>
  )
}
