import type { ReactNode } from 'react'
import styles from './SplitLayout.module.css'

interface SplitLayoutProps {
  left: ReactNode
  right: ReactNode
}

export function SplitLayout({ left, right }: SplitLayoutProps) {
  return (
    <div className={`split-layout ${styles.layout}`}>
      <div className={`split-left ${styles.left}`}>{left}</div>
      <div className={`split-right ${styles.right}`}>{right}</div>
    </div>
  )
}
