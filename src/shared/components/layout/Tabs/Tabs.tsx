import { useState, type ReactNode } from 'react'
import styles from './Tabs.module.css'

interface TabsProps {
  tabs: string[]
  labels: Record<string, string>
  active: string
  onChange: (tab: string) => void
  children: ReactNode
}

const SIDEBAR_W = 220

export function Tabs({ tabs, labels, active, onChange, children }: TabsProps) {
  const [open, setOpen] = useState(false)
  const activeLabel = labels[active] ?? active

  return (
    <div className={styles.wrapper}>
      {/* Backdrop */}
      {open && (
        <div
          className={styles.backdrop}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={styles.sidebar}
        style={{ width: open ? SIDEBAR_W : 40 }}
      >
        {!open ? (
          /* Collapsed state */
          <div className={styles.collapsed}>
            <button
              className={styles.hamburgerBtn}
              title="Abrir menu"
              onClick={() => setOpen(true)}
            >
              <span className={styles.menuLabel}>menu</span>
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
            </button>
            <p className={styles.verticalLabel}>{activeLabel}</p>
          </div>
        ) : (
          /* Expanded state */
          <div className={styles.expanded} style={{ minWidth: SIDEBAR_W }}>
            <button
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              title="Fechar menu"
            >
              ✕
            </button>
            <nav>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`sg-tab ${styles.tabBtn} ${active === tab ? styles.tabActive : ''}`}
                  onClick={() => {
                    onChange(tab)
                    setOpen(false)
                  }}
                >
                  {labels[tab] ?? tab}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>{children}</div>
    </div>
  )
}
