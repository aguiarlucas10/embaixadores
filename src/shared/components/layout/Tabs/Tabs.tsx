import { type ReactNode } from 'react'
import styles from './Tabs.module.css'

interface TabsProps {
  tabs: string[]
  labels: Record<string, string>
  active: string
  onChange: (tab: string) => void
  children: ReactNode
}

export function Tabs({ tabs, labels, active, onChange, children }: TabsProps) {
  return (
    <div>
      <nav className={styles.bar} role="tablist" aria-label="Seções">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            className={`${styles.tab} ${active === tab ? styles.tabActive : ''}`}
            onClick={() => onChange(tab)}
          >
            {labels[tab] ?? tab}
          </button>
        ))}
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
