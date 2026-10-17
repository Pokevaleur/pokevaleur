'use client'

import { usePathname } from 'next/navigation'
import Navigation from './navigation'
import BrandLogo from './brand-logo'
import styles from './home.module.css'

export default function SiteHeader({ links }) {
  const pathname = usePathname()
  const home = pathname === '/'
  const fullMockup = pathname === '/collection/accueil' || pathname === '/rejoindre'
  if (fullMockup) return null
  if (!home) return <header className="topbar"><BrandLogo className="brand" />{pathname !== '/login' && <Navigation links={links} />}</header>
  return <header className={styles.header}>
    <BrandLogo className={styles.brand} />
    <div className={styles.homeMenu}>
      <Navigation links={links} mobileOnly overlayTrigger />
    </div>
  </header>
}
