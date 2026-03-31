import type { ChangeEvent, KeyboardEvent } from 'react'
import styles from './Input.module.css'

interface InputProps {
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  type?: string
  placeholder?: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  disabled?: boolean
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  onKeyDown,
  disabled,
}: InputProps) {
  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>{label}</label>
      <input
        className={`sg-input ${styles.input}`}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
    </div>
  )
}
