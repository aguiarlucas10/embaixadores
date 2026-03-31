import type { ReactNode } from 'react'
import styles from './Row.module.css'

interface RowProps {
  left: ReactNode
  right: ReactNode
}

export function Row({ left, right }: RowProps) {
  return (
    <div className={`row-item ${styles.row}`}>
      {left}
      {right}
    </div>
  )
}
