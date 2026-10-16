'use client'

import styles from './collection-mockup.module.css'
import Navigation from './navigation'
import InboxShortcut from './inbox-shortcut'
import navLinks from './navigation-links'
import BrandLogo from './brand-logo'

const destinations = [
  {
    name: 'Mes classeurs',
    description: 'Organise tes cartes par extension, série ou thème dans tes classeurs.',
    href: '/collection/classeurs',
    className: 'binders',
    image: '/collection-desktop-binders.webp',
    alt: 'Un classeur ouvert avec des cartes Pokémon et plusieurs classeurs de collection',
  },
  {
    name: 'Mes cartes gradées',
    description: 'Retrouve et suis tes cartes gradées, avec leurs notes et certifications.',
    href: '/collection/cartes-gradees/consulter',
    className: 'graded',
    image: '/collection-desktop-graded.webp',
    alt: 'Trois cartes de collection gradées et certifiées',
  },
  {
    name: 'Mes produits scellés',
    description: 'Stocke et suis tes boosters, ETB et autres produits scellés.',
    href: '/collection',
    className: 'sealed',
    image: '/collection-desktop-sealed.webp',
    alt: 'Des produits Pokémon scellés rangés dans une vitrine',
  },
]

export default function CollectionMockup({ isMember = true }) {
  return (
    <main className={styles.page}>
      <div className={styles.desktopView}>
        <header className={styles.desktopHeader}>
          <BrandLogo className={styles.desktopBrand} />
          <div className={styles.desktopNavWrap}>
            <Navigation links={navLinks} />
          </div>
        </header>
        <section className={styles.desktopContent}>
          <div className={styles.desktopIntro}>
            <h1>Ma collection</h1>
            <p>Tes trésors, bien organisés.</p>
          </div>
          <div className={styles.triptych}>
            {destinations.map(destination => (
              <a className={styles.triptychCard} href={destination.href} key={destination.className}>
                <img className={styles.triptychImage} src={destination.image} alt={destination.alt} />
                <div className={styles.triptychCopy}>
                  <div>
                    <h2>{destination.name}</h2>
                    <p>{destination.description}</p>
                  </div>
                  <span className={styles.triptychArrow} aria-hidden="true">→</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.mobileView}>
        <div className={styles.artboard}>
          <header className={styles.mobileHeader}>
            <BrandLogo className={styles.mobileBrand} href={isMember ? '/collection/accueil' : '/'} />
            <span className={styles.legacyMenuMask} aria-hidden="true" />
            <div className={styles.mobileInbox}><InboxShortcut /></div>
            <div className={styles.menu}>
              <Navigation links={navLinks} mobileOnly overlayTrigger />
            </div>
          </header>
          <img
            className={styles.image}
            src="/collection-maquette.webp"
            alt="Ma collection : mes classeurs, mes cartes gradées et mes produits scellés"
            fetchPriority="high"
          />

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
      </div>
    </main>
  )
}
