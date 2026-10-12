'use client'

import styles from './collection-mockup.module.css'

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
        <details className={styles.menu}>
          <summary aria-label="Ouvrir le menu" />
          <nav className={styles.menuPanel} aria-label="Navigation">
            <a href={isMember ? '/collection/accueil' : '/'}>Accueil</a>
            <a href="/catalogue">Catalogue</a>
            <a href="/collection">Produits scellés</a>
            <a href="/collection/cartes">Mes cartes</a>
            <a href="/collection/classeurs">Mes classeurs</a>
            <a href="/profil">Mon profil</a>
          </nav>
        </details>
        <a className={styles.profileLink} href={isMember ? '/profil' : '/login'} aria-label={isMember ? 'Mon profil' : 'Connexion'} />

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
