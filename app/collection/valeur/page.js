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
async function loadSeriesValueSummaries(supabase, copies) {
  const bySet = new Map()
  for (const copy of copies || []) {
    const variant = copy.variant
    const set = copy.card?.card_sets
    if (!variant?.is_master_set_target || !variant.id || !set?.id) continue
    let summary = bySet.get(set.id)
    if (!summary) {
      summary = { setId: set.id, label: set.set_name || 'Série sans nom', seriesName: set.series_name || '', releaseDate: set.release_date || null, ownedVariantIds: new Set(), pricedCopies: 0, unpricedCopies: 0, value: 0, total: 0 }
      bySet.set(set.id, summary)
    }
    summary.ownedVariantIds.add(variant.id)
    if (copy.price !== null && Number.isFinite(Number(copy.price))) {
      summary.value += Number(copy.price)
      summary.pricedCopies += 1
    } else summary.unpricedCopies += 1
  }
  if (!bySet.size) return []
  const setIds = [...bySet.keys()]
  const cards = []
  for (let offset = 0; offset < setIds.length; offset += 100) {
    const result = await fetchAllRows(() => supabase.from('cards').select('id,card_set_id').in('card_set_id', setIds.slice(offset, offset + 100)))
    if (result.error) throw result.error
    cards.push(...(result.data || []))
  }
  const cardIds = [...new Set(cards.map(card => card.id).filter(Boolean))]
  const cardSetById = new Map(cards.map(card => [card.id, card.card_set_id]))
  const catalogVariants = []
  for (let offset = 0; offset < cardIds.length; offset += 100) {
    const result = await fetchAllRows(() => supabase.from('card_print_variants').select('id,card_id,is_master_set_target').in('card_id', cardIds.slice(offset, offset + 100)))
    if (result.error) throw result.error
    catalogVariants.push(...(result.data || []))
  }
  for (const variant of catalogVariants) {
    if (!variant.is_master_set_target) continue
    const summary = bySet.get(cardSetById.get(variant.card_id))
    if (summary) summary.total += 1
  }
  return [...bySet.values()].map(summary => ({
    ...summary,
    ownedCount: summary.ownedVariantIds.size,
    completion: summary.total ? Math.min(100, summary.ownedVariantIds.size / summary.total * 100) : null
  })).sort((a, b) => {
    const aHasValue = a.pricedCopies > 0
    const bHasValue = b.pricedCopies > 0
    if (aHasValue !== bHasValue) return aHasValue ? -1 : 1
    if (aHasValue && a.value !== b.value) return b.value - a.value
    if (a.completion !== b.completion) return (b.completion ?? -1) - (a.completion ?? -1)
    return a.label.localeCompare(b.label, 'fr')
  })
}

export default function CollectionValueOverviewPage() {
  const supabase = useMemo(() => createClient(), [])
  const [showAllSeries, setShowAllSeries] = useState(false)
  const [state, setState] = useState({ loading: true, error: '', profileName: 'Ma collection', cardsValue: null, cardCount: 0, sealedValue: null, sealedCount: 0, calculatedAt: null, seriesSummaries: [], seriesError: '' })

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
        let sealedValue = 0, sealedPriced = 0, sealedCount = 0
        for (const item of sealedItems) {
          const quantity = Number(item.quantity) || 1
          sealedCount += quantity
          const value = getSealedItemValue(item, products.get(item.product_id))
          if (value !== null) { sealedValue += value * quantity; sealedPriced += quantity }
        }

        let seriesSummaries = []
        let seriesError = ''
        try {
          seriesSummaries = await loadSeriesValueSummaries(supabase, cardsResult.copies)
        } catch (error) {
          seriesError = error.message || 'Impossible de calculer la progression des séries.'
        }

        if (cancelled) return
        setState({
          loading: false,
          error: '',
          profileName: profile.display_name || 'Ma collection',
          cardsValue: cardsResult.pricedCopies ? cardsResult.total : null,
          cardCount: cardsResult.copies.length,
          sealedValue: sealedPriced ? sealedValue : null,
          sealedCount,
          calculatedAt: new Date(),
          seriesSummaries,
          seriesError
        })
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: error.message || 'Impossible de calculer les valeurs de la collection.' }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const hasAnyValue = state.cardsValue != null || state.sealedValue != null
  const displayedSeries = showAllSeries ? state.seriesSummaries : state.seriesSummaries.slice(0, 5)
  const total = (state.cardsValue || 0) + (state.sealedValue || 0)
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Valeur de {state.profileName === 'Ma collection' ? 'ma collection' : state.profileName}</h1>
        <p>Cartes et produits scellés</p>
      </header>

      {state.error && <section className={styles.error} role="alert"><strong>Valeurs indisponibles</strong><p>{state.error}</p></section>}
      {state.loading ? <p className={styles.status} role="status">Calcul des valeurs de ta collection…</p> : !state.error && <>
        <section className={styles.totalCard} aria-label="Estimation globale">
          <span className={styles.eyebrow}>ESTIMATION GLOBALE</span>
          <strong>{hasAnyValue ? euro(total) : 'Aucune valeur disponible'}</strong>
          <small>Mise à jour au {state.calculatedAt?.toLocaleDateString('fr-FR')}</small>
        </section>


        <h2 className={styles.sectionTitle}>Détail de ma collection</h2>
        <div className={styles.options}>
          <a className={styles.option} href="/collection/valeur/cartes">
            <span className={`${styles.icon} ${styles.cardIcon}`} aria-hidden="true">C</span>
            <div className={styles.optionHeading}><strong>Cartes</strong><span>Valeur carte par carte, par série ou pour toute ta collection.</span></div>
            <strong className={styles.optionValue}>{euro(state.cardsValue)}</strong>
            <small>{state.cardCount} cartes possédées</small>
            <span className={styles.explore}>Explorer <b aria-hidden="true">→</b></span>
          </a>
          <a className={styles.option} href="/collection/valeur/scelles">
            <span className={`${styles.icon} ${styles.sealedIcon}`} aria-hidden="true">S</span>
            <div className={styles.optionHeading}><strong>Produits scellés</strong><span>Valeur de tes ETB, displays, coffrets et autres produits.</span></div>
            <strong className={styles.optionValue}>{euro(state.sealedValue)}</strong>
            <small>{state.sealedCount} produits possédés</small>
            <span className={styles.explore}>Explorer <b aria-hidden="true">→</b></span>
          </a>
        </div>
        <p className={styles.sourceNote}>Sources et dates des prix</p>
<section className={styles.seriesSection} aria-labelledby="series-overview-title">
          <div className={styles.seriesHeader}>
            <div>
              <span className={styles.eyebrow}>MES MASTER SETS</span>
              <h2 id="series-overview-title">Valeur et progression par série</h2>
              <p>Les séries les plus valorisées s’affichent d’abord. Ouvre une ligne pour voir les cartes de la série.</p>
            </div>
          </div>
          {state.seriesError
            ? <p className={styles.seriesMessage} role="status">La progression des séries est indisponible pour le moment. {state.seriesError}</p>
            : state.seriesSummaries.length
              ? <div className={styles.seriesList}>
                  {displayedSeries.map(series => {
                    const percentage = series.completion == null
                      ? null
                      : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(series.completion)
                    return (
                      <a className={styles.seriesRow} href={`/collection/valeur/cartes?set=${encodeURIComponent(series.setId)}`} key={series.setId}>
                        <span className={styles.seriesName}>
                          <strong>{series.label}</strong>
                          {series.seriesName && <small>{series.seriesName}</small>}
                        </span>
                        <span className={styles.seriesCompletion}>
                          <span className={styles.seriesCompletionLabel}>
                            <span>Master Set</span>
                            <strong>{series.ownedCount} / {series.total || '—'}{percentage !== null ? ` · ${percentage} %` : ''}</strong>
                          </span>
                          <span className={styles.seriesTrack} aria-hidden="true"><i style={{ width: `${series.completion ?? 0}%` }} /></span>
                        </span>
                        <span className={styles.seriesValue}>
                          <strong>{series.pricedCopies ? euro(series.value) : 'Prix indisponible'}</strong>
                          <small>{series.pricedCopies} carte{series.pricedCopies > 1 ? 's' : ''} cotée{series.pricedCopies > 1 ? 's' : ''}{series.unpricedCopies ? ` · ${series.unpricedCopies} sans cote` : ''}</small>
                        </span>
                        <span className={styles.seriesExplore}>Détail <b aria-hidden="true">→</b></span>
                      </a>
                    )
                  })}
                  {state.seriesSummaries.length > 5 && <button className={styles.seriesToggle} type="button" aria-expanded={showAllSeries} onClick={() => setShowAllSeries(value => !value)}>
                    {showAllSeries ? 'Réduire la liste' : `Afficher toutes les séries (${state.seriesSummaries.length})`}
                  </button>}
                </div>
              : <p className={styles.seriesMessage}>Les séries apparaîtront ici dès que tu posséderas une carte de leur Master Set.</p>}
          <p className={styles.seriesFootnote}>La progression compte les variantes possédées une seule fois. La valeur additionne les exemplaires possédés cotés, y compris les doublons; les cartes sans prix restent signalées à part.</p>
        </section>
      </>}
      <nav className={styles.bottomNav} aria-label="Navigation principale">
        <a href="/"><span className={styles.navDot} aria-hidden="true" />Accueil</a>
        <a href="/catalogue"><span className={styles.navDot} aria-hidden="true" />Catalogue</a>
        <a href="/collection"><span className={styles.navDot} aria-hidden="true" />Collection</a>
        <a href="/collection/valeur" aria-current="page" className={styles.activeNav}><span className={styles.navDot} aria-hidden="true" />Valeurs</a>
      </nav>
    </main>
  )
}
