'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import { getSealedItemValue, loadActiveCollectionProfile, loadOwnedCardValuations } from '../../../lib/collection-value-data'
import styles from './value.module.css'

function euro(value) {
  if (value == null) return 'Prix indisponible'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

export default function CollectionValueOverviewPage() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState({ loading: true, error: '', profileName: 'Ma collection', cardsValue: null, cardCount: 0, cardsPriced: 0, cardsUnpriced: 0, sealedValue: null, sealedCount: 0, sealedPriced: 0, sealedUnpriced: 0 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const active = await loadActiveCollectionProfile(supabase)
        if (!active) {
          window.location.replace('/login?next=%2Fcollection%2Fvaleur')
          return
        }
        const { profile } = active
        const [itemsResult, productsResult, cardsResult] = await Promise.all([
          fetchAllRows(() => supabase.from('collection_items')
            .select('id,custom_name,quantity,product_id,current_value_override,sealed_condition')
            .eq('collection_profile_id', profile.id)),
          fetchAllRows(() => supabase.from('products')
            .select('id,name,series,category,product_type,current_value,zero_defect_value')
            .eq('is_public', true)),
          loadOwnedCardValuations(supabase, profile.id)
        ])
        if (itemsResult.error) throw itemsResult.error
        if (productsResult.error) throw productsResult.error

        const products = new Map((productsResult.data || []).map(product => [product.id, product]))
        const sealedItems = (itemsResult.data || []).filter(item => (
          String(products.get(item.product_id)?.category || '').trim().toLocaleLowerCase('fr') === 'sealed'
        ))
        let sealedValue = 0, sealedPriced = 0, sealedUnpriced = 0, sealedCount = 0
        for (const item of sealedItems) {
          const quantity = Number(item.quantity) || 1
          sealedCount += quantity
          const value = getSealedItemValue(item, products.get(item.product_id))
          if (value === null) sealedUnpriced += quantity
          else { sealedValue += value * quantity; sealedPriced += quantity }
        }

        if (cancelled) return
        setState({
          loading: false,
          error: '',
          profileName: profile.display_name || 'Ma collection',
          cardsValue: cardsResult.pricedCopies ? cardsResult.total : null,
          cardCount: cardsResult.copies.length,
          cardsPriced: cardsResult.pricedCopies,
          cardsUnpriced: cardsResult.unpricedCopies,
          sealedValue: sealedPriced ? sealedValue : null,
          sealedCount,
          sealedPriced,
          sealedUnpriced
        })
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: error.message || 'Impossible de calculer les valeurs de la collection.' }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const hasAnyValue = state.cardsValue != null || state.sealedValue != null
  const total = (state.cardsValue || 0) + (state.sealedValue || 0)
  const hasMissing = state.cardsUnpriced + state.sealedUnpriced > 0

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d’Ariane"><a href="/collection">Ma collection</a><span>›</span><span>Valeurs</span></nav>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>MA COLLECTION · VALEURS</span>
        <h1>Valeur de {state.profileName}</h1>
        <p>Retrouve séparément la valeur de tes cartes et de tes produits scellés.</p>
      </header>

      {state.error && <section className={styles.error} role="alert"><strong>Valeurs indisponibles</strong><p>{state.error}</p></section>}
      {state.loading ? <p className={styles.status} role="status">Calcul des valeurs de ta collection…</p> : !state.error && <>
        <section className={styles.totalCard} aria-label="Estimation globale">
          <span className={styles.eyebrow}>ESTIMATION GLOBALE</span>
          <strong>{hasAnyValue ? euro(total) : 'Aucune valeur disponible'}</strong>
          <small>{state.cardCount + state.sealedCount} exemplaires · {hasMissing ? 'certains prix sont indisponibles' : 'prix disponibles pour tous les exemplaires'}</small>
        </section>

        <h2 className={styles.sectionTitle}>Que veux-tu estimer ?</h2>
        <div className={styles.options}>
          <a className={styles.option} href="/collection/valeur/cartes">
            <span className={`${styles.icon} ${styles.cardIcon}`} aria-hidden="true">C</span>
            <div className={styles.optionHeading}><strong>Cartes</strong><span>Valeur carte par carte, par série ou pour toute ta collection.</span></div>
            <strong className={styles.optionValue}>{euro(state.cardsValue)}</strong>
            <small>{state.cardsPriced} prix disponibles sur {state.cardCount} exemplaires</small>
            <span className={styles.explore}>Explorer <b aria-hidden="true">→</b></span>
          </a>
          <a className={styles.option} href="/collection/valeur/scelles">
            <span className={`${styles.icon} ${styles.sealedIcon}`} aria-hidden="true">S</span>
            <div className={styles.optionHeading}><strong>Produits scellés</strong><span>Valeur de tes ETB, displays, coffrets et autres produits.</span></div>
            <strong className={styles.optionValue}>{euro(state.sealedValue)}</strong>
            <small>{state.sealedPriced} prix disponibles sur {state.sealedCount} exemplaires</small>
            <span className={styles.explore}>Explorer <b aria-hidden="true">→</b></span>
          </a>
        </div>
        <details className={styles.method}>
          <summary>Sources et méthode d’estimation</summary>
          <p>Les prix des cartes viennent d’abord de Cardmarket, puis de TCGplayer lorsque Cardmarket n’a pas de valeur. Les cartes gradées utilisent une valeur renseignée pour l’exemplaire ou une observation correspondant à sa société et à sa note. Les produits scellés utilisent la cote du catalogue, avec une valeur personnelle si tu en as saisi une.</p>
          <p>Les prix manquants sont signalés et exclus du total ; le prix d’achat n’est pas présenté comme une valeur actuelle.</p>
        </details>
      </>}
      <div className={styles.footerNote}>Estimation indicative · {state.profileName}</div>
    </main>
  )
}
