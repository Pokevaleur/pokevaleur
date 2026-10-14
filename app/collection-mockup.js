'use client'

import styles from './collection-mockup.module.css'
import Navigation from './navigation'
import navLinks from './navigation-links'

const destinations = [
  { name: 'Mes classeurs', href: '/collection/classeurs', className: 'binders' },
  { name: 'Mes cartes gradées', href: '/collection/stats?category=graded', className: 'graded' },
  { name: 'Mes produits scellés', href: '/collection/stats?category=sealed', className: 'sealed' },
]

export default function CollectionMockup({ isMember = true }) {
  return (
    <main className={styles.page}>
      <div className={styles.artboard}>
        <img
          className={styles.image}
          src="/collection-maquette.webp"
          alt="Ma collection : mes classeurs, mes cartes gradées et mes produits scellés"
          fetchPriority="high"
        />

        <a className={styles.brandLink} href={isMember ? '/collection/accueil' : '/'} aria-label="PokéValeur, accueil" />
        <span className={styles.legacyMenuMask} aria-hidden="true" />
        <div className={styles.menu}>
          <Navigation links={navLinks} overlayTrigger />
        </div>

        {destinations.map(destination => (
          <a
            key={destination.className}
            className={styles[destination.className]}
            href={destination.href}
            aria-label={destination.name}
            title={destination.name}
          />
        ))}
        <p className={styles.accessibleText}>
          Sélectionne une zone : Mes classeurs, Mes cartes gradées ou Mes produits scellés.
        </p>
      </div>
    </main>
  )
}
