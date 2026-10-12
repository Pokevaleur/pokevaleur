'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import styles from './page.module.css'

const destinations = [
  {
    id: 'binders',
    title: 'Mes classeurs',
    description: 'Organise tes cartes par extension, série ou thème dans tes classeurs.',
    href: '/collection/classeurs',
    action: 'Explorer mes classeurs',
    images: [
      { src: '/binder-covers/aventures-ensemble.webp', alt: 'Couverture Aventures Ensemble', className: 'coverOne' },
      { src: '/binder-covers/destinees-de-paldea.webp', alt: 'Couverture Destinées de Paldea', className: 'coverTwo' },
      { src: '/binder-covers/astres-radieux.webp', alt: 'Couverture Astres Radieux', className: 'coverThree' },
    ],
  },
  {
    id: 'graded',
    title: 'Mes cartes gradées',
    description: 'Retrouve et suis tes cartes gradées, avec leurs notes et certifications.',
    href: '/collection/stats?category=graded',
    action: 'Voir mes cartes gradées',
    image: '/catalogue/nymphali-ex-30-ans.webp',
    alt: 'Carte Pokémon Nymphali-ex',
  },
  {
    id: 'sealed',
    title: 'Mes produits scellés',
    description: 'Stocke et suis tes boosters, ETB et autres produits scellés.',
    href: '/collection/stats?category=sealed',
    action: 'Voir mes produits scellés',
    image: '/catalogue/bundle-30e-anniversaire-fr.jpg',
    alt: 'Produit Pokémon français scellé, bundle du 30e anniversaire',
  },
]

export default function RejoindrePage() {
  const [member, setMember] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let active = true
    async function sync() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (active) setMember(!error && Boolean(user))
      } catch {
        if (active) setMember(false)
      }
    }
    sync()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => { if (active) sync() }, 0)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase])

  function hrefFor(destination) {
    return member ? destination : `/login?mode=signup&next=${encodeURIComponent(destination)}`
  }

  const signupHref = hrefFor('/collection/accueil')
  const signinHref = `/login?next=${encodeURIComponent('/collection/accueil')}`

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>TON ESPACE DE COLLECTION</p>
        <h1>Ma collection</h1>
        <p className={styles.subtitle}>Tes trésors, bien organisés.</p>
        <span className={styles.ornament} aria-hidden="true"><i /></span>
      </header>

      <section className={styles.features} aria-label="Les espaces de ta collection">
        {destinations.map((item, index) => (
          <a className={`${styles.feature} ${styles[item.id]}`} href={hrefFor(item.href)} key={item.id}>
            <span className={styles.copy}>
              <span className={styles.featureNumber}>0{index + 1} · POKÉVALEUR</span>
              <span className={styles.featureTitle}>{item.title}</span>
              <span className={styles.description}>{item.description}</span>
              <span className={styles.action}>{member ? item.action : 'Découvrir cet espace'} <span aria-hidden="true">→</span></span>
            </span>
            <span className={styles.art} aria-hidden="true">
              {item.images ? (
                <span className={styles.albumStack}>
                  {item.images.map(image => <img key={image.src} className={styles[image.className]} src={image.src} alt="" loading="lazy" />)}
                </span>
              ) : item.id === 'graded' ? (
                <span className={styles.slab}>
                  <img src={item.image} alt="" loading="lazy" />
                  <span className={styles.slabLabel}><b>POKÉVALEUR</b><small>CARTE DE COLLECTION</small></span>
                </span>
              ) : (
                <img className={styles.sealedProduct} src={item.image} alt="" loading="lazy" />
              )}
            </span>
          </a>
        ))}
      </section>

      <section className={styles.join} aria-labelledby="join-heading">
        <p className={styles.eyebrow}>TA PASSION, À TON RYTHME</p>
        <h2 id="join-heading">Prêt à réunir tes trésors ?</h2>
        <p>Crée ton espace et retrouve tes classeurs, cartes gradées et produits scellés au même endroit.</p>
        <div className={styles.actions}>
          <a className={styles.primary} href={signupHref}>{member ? 'Accéder à ma collection' : 'Créer mon compte gratuit'}</a>
          {!member && <a className={styles.secondary} href={signinHref}>J’ai déjà un compte</a>}
        </div>
      </section>
    </main>
  )
}
