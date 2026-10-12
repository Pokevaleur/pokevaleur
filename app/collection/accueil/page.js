'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './page.module.css'

const destinations = [
  {
    title: 'Produits scellés',
    description: 'Retrouve tes ETB, coffrets, displays et autres produits.',
    href: '/collection/stats?category=sealed',
    icon: '▣',
    label: 'Voir les statistiques des produits scellés'
  },
  {
    title: 'Cartes',
    description: 'Explore tes cartes par série et suis ta progression.',
    href: '/collection/stats?category=cards',
    icon: '▤',
    label: 'Voir les statistiques des cartes'
  },
  {
    title: 'Cartes gradées',
    description: 'Consulte les cartes gradées de ta collection.',
    href: '/collection/stats?category=graded',
    icon: '★',
    label: 'Voir les statistiques des cartes gradées'
  }
]

export default function CollectionOverviewPage() {
  const supabase = useMemo(() => createClient(), [])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function verifySession() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active) return
      if (error || !user) {
        const next = encodeURIComponent('/collection/accueil')
        window.location.replace('/login?next=' + next)
        return
      }
      setReady(true)
    }

    verifySession()
    return () => { active = false }
  }, [supabase])

  if (!ready) {
    return <main className={styles.page} aria-live="polite"><p className={styles.loading}>Chargement de ta collection…</p></main>
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>POKÉVALEUR · MA COLLECTION</p>
        <h1>Ma collection</h1>
        <p>Choisis ce que tu souhaites consulter.</p>
      </header>

      <nav className={styles.tabs} aria-label="Sections de ma collection">
        <a className={styles.active} href="/collection/accueil" aria-current="page">Vue d’ensemble</a>
        <a href="/collection#objets">Mes objets</a>
        <a href="/collection/stats">Stats collection</a>
        <a href="/collection/valeur">Valeur</a>
      </nav>

      <section className={styles.section} aria-labelledby="collection-categories">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>ACCÈS RAPIDE</p>
          <h2 id="collection-categories">Parcourir ma collection</h2>
        </div>
        <div className={styles.grid}>
          {destinations.map(destination => (
            <a className={styles.card} href={destination.href} key={destination.title} aria-label={destination.label}>
              <span className={styles.icon} aria-hidden="true">{destination.icon}</span>
              <h3>{destination.title}</h3>
              <p>{destination.description}</p>
              <span className={styles.cardAction}>Voir les statistiques <span aria-hidden="true">→</span></span>
            </a>
          ))}
        </div>
      </section>

      <a className={styles.manageLink} href="/collection#objets">Gérer mes objets <span aria-hidden="true">→</span></a>
    </main>
  )
}
