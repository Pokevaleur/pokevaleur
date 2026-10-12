'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import styles from './page.module.css'

const binderCovers = [
  { src: '/binder-covers/aventures-ensemble.webp', alt: 'Classeur Aventures Ensemble' },
  { src: '/binder-covers/destinees-de-paldea.webp', alt: 'Classeur Destinées de Paldea' },
  { src: '/binder-covers/astres-radieux.webp', alt: 'Classeur Astres Radieux' },
]

const fallbackCards = [
  { id: 'sv09-001', card_name: 'Chenipan', collector_number: '001/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/001/low.webp' },
  { id: 'sv09-002', card_name: 'Chrysacier', collector_number: '002/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/002/low.webp' },
  { id: 'sv09-003', card_name: 'Papilusion', collector_number: '003/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/003/low.webp' },
  { id: 'sv09-004', card_name: 'Paras', collector_number: '004/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/004/low.webp' },
  { id: 'sv09-005', card_name: 'Parasect', collector_number: '005/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/005/low.webp' },
  { id: 'sv09-006', card_name: 'Chlorobule', collector_number: '006/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/006/low.webp' },
  { id: 'sv09-007', card_name: 'Fragilady', collector_number: '007/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/007/low.webp' },
  { id: 'sv09-008', card_name: 'Maracachi', collector_number: '008/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/008/low.webp' },
  { id: 'sv09-009', card_name: 'Carabing', collector_number: '009/159', image_url: 'https://assets.tcgdex.net/fr/sv/sv09/009/low.webp' },
]

const fallbackEtbProducts = [
  { id: 'etb-30e-anniversaire', name: 'Coffret Dresseur d’élite 30e Anniversaire', image_url: 'https://www.pokepedia.fr/images/5/5f/Coffret_Dresseur_d%27%C3%A9lite_30e_Anniversaire.png' },
  { id: 'etb-celebrations', name: 'Coffret Dresseur d’élite Célébrations', image_url: 'https://www.pokepedia.fr/images/2/23/Coffret_Dresseur_d%27%C3%A9lite_C%C3%A9l%C3%A9brations.png' },
  { id: 'etb-destinees-occultes', name: 'Coffret Dresseur d’élite Destinées Occultes', image_url: 'https://www.pokepedia.fr/images/6/64/Coffret_Dresseur_d%27%C3%A9lite_Destin%C3%A9es_Occultes.png' },
  { id: 'etb-destinees-radieuses', name: 'Coffret Dresseur d’élite Destinées Radieuses', image_url: 'https://www.pokepedia.fr/images/8/8f/Coffret_Dresseur_d%27%C3%A9lite_Destin%C3%A9es_Radieuses.png' },
  { id: 'etb-151', name: 'Coffret Dresseur d’élite Écarlate et Violet – 151', image_url: 'https://www.pokepedia.fr/images/7/79/Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_151.png' },
  { id: 'etb-aventures-ensemble', name: 'Coffret Dresseur d’élite Aventures Ensemble', image_url: 'https://www.pokepedia.fr/images/2/21/Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Aventures_Ensemble.png' },
]

const destinations = [
  {
    id: 'binders',
    title: 'Mes classeurs',
    description: 'Organise tes cartes par extension, série ou thème dans tes classeurs.',
    href: '/collection/classeurs',
    action: 'Explorer mes classeurs',
  },
  {
    id: 'graded',
    title: 'Mes cartes gradées',
    description: 'Retrouve et suis tes cartes gradées, avec leurs notes et certifications.',
    href: '/collection/stats?category=graded',
    action: 'Voir mes cartes gradées',
  },
  {
    id: 'sealed',
    title: 'Mes produits scellés',
    description: 'Stocke et suis tes boosters, ETB et autres produits scellés.',
    href: '/collection/stats?category=sealed',
    action: 'Voir mes produits scellés',
  },
]

function imageFor(item) {
  return item?.image_url || item?.image_source_url || ''
}

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function RejoindrePage() {
  const [member, setMember] = useState(false)
  const [showcaseCards, setShowcaseCards] = useState([])
  const [etbProducts, setEtbProducts] = useState(fallbackEtbProducts)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let active = true

    async function loadPublicShowcase() {
      const { data: sets } = await supabase.from('card_sets')
        .select('id,set_code,set_name,is_public,release_date')
        .eq('is_public', true)
        .order('release_date', { ascending: false })

      const preferredSet = (sets || []).find(set => /^EV9$/i.test(set.set_code || ''))
        || (sets || []).find(set => /aventures ensemble/i.test(set.set_name || ''))
        || (sets || [])[0]

      const cardRequest = preferredSet
        ? supabase.from('cards')
          .select('id,card_name,collector_number,image_url,image_source_url,guide_order')
          .eq('card_set_id', preferredSet.id)
          .order('guide_order', { ascending: true })
          .limit(9)
        : Promise.resolve({ data: [], error: null })

      const productRequest = supabase.from('products')
        .select('id,name,series,category,product_type,image_url')
        .eq('is_public', true)
        .order('name', { ascending: true })
        .limit(500)

      const [cardsResult, productsResult] = await Promise.all([cardRequest, productRequest])
      if (!active) return

      if (!cardsResult.error && cardsResult.data?.length) setShowcaseCards(cardsResult.data)

      if (!productsResult.error) {
        const etbs = (productsResult.data || []).filter(product => {
          const label = normalized([product.name, product.category, product.product_type].join(' '))
          return product.image_url && (label.includes('etb') || label.includes('coffret dresseur') && label.includes('elite'))
        })
        setEtbProducts(etbs.slice(0, 6))
      }
    }

    loadPublicShowcase().catch(() => {})
    return () => { active = false }
  }, [supabase])

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
    return member ? destination : '/login?mode=signup&next=' + encodeURIComponent(destination)
  }

  const signupHref = hrefFor('/collection/accueil')
  const signinHref = '/login?next=' + encodeURIComponent('/collection/accueil')
  const cardsForArt = showcaseCards.length ? showcaseCards : fallbackCards
  const cardsForBinder = Array.from({ length: 9 }, (_, index) => cardsForArt[index % cardsForArt.length])
  const gradedCards = cardsForArt.slice(0, 3)
  const productsForShelf = etbProducts.length ? etbProducts : fallbackEtbProducts

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <h1>Ma collection</h1>
        <span className={styles.ornament} aria-hidden="true"><i /></span>
        <p className={styles.subtitle}>Tes trésors, bien organisés.</p>
      </header>

      <section className={styles.features} aria-label="Les espaces de ta collection">
        {destinations.map(item => (
          <a className={styles.feature + ' ' + styles[item.id]} href={item.href} key={item.id} aria-label={item.title + ' : ' + item.action}>
            <span className={styles.copy}>
              <span className={styles.featureTitle}>{item.title}</span>
              <span className={styles.description}>{item.description}</span>
              <span className={styles.action} aria-hidden="true">→</span>
            </span>
            <span className={styles.art} aria-hidden="true">
              {item.id === 'binders' ? (
                <span className={styles.binderScene}>
                  <span className={styles.openBinder}>
                    <span className={styles.ringSpine}><i /><i /><i /></span>
                    <span className={styles.cardGrid}>
                      {cardsForBinder.map((card, index) => (
                        <span className={styles.cardPocket} key={card.id + '-' + index}>
                          <img src={imageFor(card)} alt="" loading="lazy" />
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={styles.binderCovers}>
                    {binderCovers.map(cover => <img key={cover.src} src={cover.src} alt="" loading="lazy" />)}
                  </span>
                </span>
              ) : item.id === 'graded' ? (
                <span className={styles.displayCase}>
                  <span className={styles.slabs}>
                    {gradedCards.map((card, index) => (
                      <span className={styles.slab} key={card.id}>
                        <span className={styles.slabHeader}>{['PSA', 'CGC', 'BGS'][index]}</span>
                        <img src={imageFor(card)} alt="" loading="lazy" />
                      </span>
                    ))}
                  </span>
                  <span className={styles.caseFront} aria-hidden="true"><i /></span>
                </span>
              ) : (
                <span className={styles.productShelves}>
                  {productsForShelf.map(product => (
                    <span className={styles.shelfProduct} key={product.id}>
                      <img src={product.image_url || product.image_source_url} alt="" loading="lazy" />
                      <small>{product.name}</small>
                    </span>
                  ))}
                  <i className={styles.shelfRail} />
                </span>
              )}
            </span>
          </a>
        ))}
      </section>

      <section className={styles.join} aria-label="Créer un compte">
        <a className={styles.primary} href={signupHref}>{member ? 'Accéder à ma collection' : 'Créer mon compte gratuit'}</a>
        {!member && <a className={styles.secondary} href={signinHref}>J’ai déjà un compte</a>}
      </section>
    </main>
  )
}
