import type { User } from '@supabase/supabase-js'
import { Logo } from '@shared/components/atoms/Logo/Logo'
import { BtnGhost } from '@shared/components/atoms/Button/Button'
import styles from './Header.module.css'

interface HeaderProps {
  user?: User | null
  onLogout?: () => void
  isAdmin?: boolean
  /** Rótulo do link de alternância entre os apps (main ↔ sg) */
  altAppLabel?: string
  altAppHref?: string
}

export function Header({ user, onLogout, isAdmin = false, altAppLabel, altAppHref }: HeaderProps) {
  return (
    <header className={`header-bar ${styles.header}`}>
      <Logo />
      <div className={styles.actions}>
        {isAdmin && altAppLabel && altAppHref && (
          <a
            href={altAppHref}
            target="_blank"
            rel="noreferrer"
            className={styles.altLink}
          >
            {altAppLabel}
          </a>
        )}
        {user && onLogout && (
          <BtnGhost onClick={onLogout}>Sair</BtnGhost>
        )}
      </div>
    </header>
  )
}
