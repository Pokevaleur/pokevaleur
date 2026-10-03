'use client'

import { usePathname } from 'next/navigation'
import Navigation from './navigation'
import styles from './home.module.css'

export default function SiteHeader({ links }) {
  const pathname = usePathname()
  const home = pathname === '/'
  if (!home) return <header className="topbar"><a className="brand" href="/" aria-label="PokéValeur, accueil">PokéVal<span className="brandU">u<svg className="brandCrown" viewBox="0 0 48 28" aria-hidden="true" focusable="false"><path d="M5 8 15 15 24 3 33 15 43 8 38 25H10Z" fill="currentColor"/><circle cx="5" cy="5" r="3" fill="currentColor"/><circle cx="24" cy="3" r="3" fill="currentColor"/><circle cx="43" cy="5" r="3" fill="currentColor"/></svg></span>eur</a>{pathname !== '/login' && <Navigation links={links} />}</header>
  return <header className={styles.header}>
    <a className={styles.brand} href="/" aria-label="PokéValeur, accueil">Poké<span>Valeur<svg className={styles.crown} viewBox="0 0 48 28" aria-hidden="true"><path d="M5 8 15 15 24 3 33 15 43 8 38 25H10Z" fill="currentColor"/><circle cx="5" cy="5" r="3"/><circle cx="24" cy="3" r="3"/><circle cx="43" cy="5" r="3"/></svg></span></a>
  </header>
}
