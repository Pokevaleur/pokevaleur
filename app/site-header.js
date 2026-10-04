'use client'

import { usePathname } from 'next/navigation'
import Navigation from './navigation'
import BrandLogo from './brand-logo'
import styles from './home.module.css'

export default function SiteHeader({ links }) {
  const pathname = usePathname()
  const home = pathname === '/'
  if (!home) return <header className="topbar"><BrandLogo className="brand" />{pathname !== '/login' && <Navigation links={links} />}</header>
  return <header className={styles.header}>
    <BrandLogo className={styles.brand} />
  </header>
}
