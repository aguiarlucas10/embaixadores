import styles from './StatGrid.module.css'

interface StatGridProps {
  /** Array de [valor, label] */
  items: [string | number, string][]
  cols?: number
}

export function StatGrid({ items, cols = 2 }: StatGridProps) {
  return (
    <div
      className={`stat-grid ${styles.grid}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {items.map(([v, l], i) => (
        <div key={i} className={styles.item}>
          <div className={`stat-val ${styles.val}`}>{v}</div>
          <div className={styles.label}>{l}</div>
        </div>
      ))}
    </div>
  )
}
