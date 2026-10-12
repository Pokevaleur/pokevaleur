'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../../../lib/supabase-browser'
import { fetchAllRows } from '../../../../../lib/supabase-pagination'
import { fetchCardMarketPrices, loadActiveCollectionProfile } from '../../../../../lib/collection-value-data'
import pageStyles from '../../value.module.css'
import styles from '../cards-value.module.css'

function euro(value, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)
}

function imageUrl(card) {
  const direct = card.image_url?.trim()
  if (direct) {
    const path = direct.split('?')[0].replace(/\/$/, '')
    return /\.(png|jpe?g|webp)$/i.test(path) ? direct : path + '/low.webp'
  }
  const parts = (card.image_source_url || '').split('/').filter(Boolean)
  const index = parts.lastIndexOf('sets')
  if (index < 1 || index + 2 >= parts.length) return ''
  const code = parts[index + 1]
  let end = 0
  while (end < code.length && /[a-z]/i.test(code[end])) end += 1
  return end ? `https://assets.tcgdex.net/${parts[index - 1]}/${code.slice(0, end)}/${code}/${encodeURIComponent(parts[index + 2])}/low.webp` : ''
}

function latest(rows) { return [...rows].sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))[0] || null }

export default function IndividualCardValuePage() {
  const supabase = useMemo(() => createClient(), [])
  const [profileId, setProfileId] = useState('')
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState([])
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [selectedPrice, setSelectedPrice] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadActiveCollectionProfile(supabase).then(active => {
      if (!active) {
        window.location.replace('/login?next=%2Fcollection%2Fvaleur%2Fcartes%2Findividuelle')
        return
      }
      if (!cancelled) setProfileId(active.profile.id)
    }).catch(err => { if (!cancelled) setError(err.message || 'Impossible de charger ta collection.') })
      .finally(() => { if (!cancelled) setLoadingProfile(false) })
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    const needle = query.trim().replace(/[^\p{L}\p{N} .’'/-]/gu, '').trim()
    if (!profileId || needle.length < 2) { setCards([]); setSearching(false); return }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const safe = needle.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
        const cardFields = 'id,collector_number,card_name,rarity_label,image_url,image_source_url,card_print_variants(id,finish_code),card_sets!cards_card_set_id_fkey!inner(set_code,set_name,language,is_public)'
        const [nameResult, numberResult] = await Promise.all([
          fetchAllRows(() => supabase.from('cards').select(cardFields)
            .ilike('card_name', `%${safe}%`).eq('card_sets.language', 'FR').eq('card_sets.is_public', true)
            .order('card_name', { ascending: true }).limit(40)),
          fetchAllRows(() => supabase.from('cards').select(cardFields)
            .ilike('collector_number', `%${safe}%`).eq('card_sets.language', 'FR').eq('card_sets.is_public', true)
            .order('card_name', { ascending: true }).limit(40))
        ])
        if (nameResult.error) throw nameResult.error
        if (numberResult.error) throw numberResult.error
        const cardRows = [...new Map([...(nameResult.data || []), ...(numberResult.data || [])].map(card => [card.id, card])).values()].slice(0, 40)
        const variantIds = cardRows.flatMap(card => (card.card_print_variants || []).map(variant => variant.id))
        const copyRows = []
        const observations = []
        for (let offset = 0; offset < variantIds.length; offset += 100) {
          const batch = variantIds.slice(offset, offset + 100)
          const [copyResult, priceResult] = await Promise.all([
            fetchAllRows(() => supabase.from('collection_cards')
              .select('id,card_print_variant_id,ownership_type,grade,grade_label,grading_company_id,current_value_override,card_grading_companies(company_name,abbreviation)')
              .eq('collection_profile_id', profileId).in('card_print_variant_id', batch)),
            fetchAllRows(() => supabase.from('card_price_observations')
              .select('card_print_variant_id,price_kind,grading_company_id,grade,observation_type,amount,currency,source,observed_at')
              .in('card_print_variant_id', batch).in('observation_type', ['confirmed_sale', 'estimate']).order('observed_at', { ascending: false }))
          ])
          if (copyResult.error) throw copyResult.error
          if (priceResult.error) throw priceResult.error
          copyRows.push(...(copyResult.data || []))
          observations.push(...(priceResult.data || []))
        }
        const copiesByVariant = new Map()
        for (const copy of copyRows) {
          const list = copiesByVariant.get(copy.card_print_variant_id) || []
          list.push(copy); copiesByVariant.set(copy.card_print_variant_id, list)
        }
        const pricesByVariant = new Map()
        for (const observation of observations) {
          const list = pricesByVariant.get(observation.card_print_variant_id) || []
          list.push(observation); pricesByVariant.set(observation.card_print_variant_id, list)
        }
        const marketPrices = await fetchCardMarketPrices(cardRows.map(card => ({
          id: card.id, image_source_url: card.image_source_url, set_code: card.card_sets?.set_code,
          collector_number: card.collector_number,
          variants: (card.card_print_variants || []).map(variant => ({ finish_code: variant.finish_code }))
        })))
        const result = cardRows.map(card => {
          const variants = card.card_print_variants || []
          const copies = variants.flatMap(variant => copiesByVariant.get(variant.id) || [])
          const rawObservation = latest(variants.flatMap(variant => pricesByVariant.get(variant.id) || [])
            .filter(row => row.price_kind === 'raw' && row.observation_type !== 'observed_listing'))
          const external = marketPrices.get(card.id)
          const rawPrice = external?.amount != null ? external : rawObservation
          const graded = copies.filter(copy => copy.ownership_type === 'graded').map(copy => {
            const match = latest((pricesByVariant.get(copy.card_print_variant_id) || []).filter(row => row.price_kind === 'graded'
              && row.grading_company_id === copy.grading_company_id && Number(row.grade) === Number(copy.grade)))
            const amount = copy.current_value_override ?? match?.amount ?? null
            return { ...copy, amount: amount == null ? null : Number(amount), currency: copy.current_value_override != null ? 'EUR' : match?.currency || 'EUR', source: copy.current_value_override != null ? 'Valeur personnelle' : match?.source }
          })
          return { ...card, copies, rawPrice, marketPrice: external, graded }
        })
        if (!cancelled) setCards(result)
      } catch (err) {
        if (!cancelled) { setCards([]); setError(err.message || 'La recherche de prix a échoué.') }
      } finally { if (!cancelled) setSearching(false) }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, profileId, supabase])

  return (
    <main className={pageStyles.page}>
      <nav className={pageStyles.breadcrumb} aria-label="Fil d’Ariane"><a href="/collection/valeur">Valeur</a><span>›</span><a href="/collection/valeur/cartes">Cartes</a><span>›</span><span>Carte individuelle</span></nav>
      <header className={pageStyles.pageHeader}>
        <span className={pageStyles.eyebrow}>MA COLLECTION · VALEUR D’UNE CARTE</span>
        <h1>Prix d’une carte</h1>
        <p>Recherche par nom de Pokémon ou numéro. Les cartes gradées affichent leur valeur propre quand elle est disponible.</p>
      </header>
      <label className={pageStyles.searchLabel}>Rechercher une carte
        <input className={pageStyles.searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pikachu ou 025/198" />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {(loadingProfile || searching) && <p className={styles.priceStatus} role="status">{loadingProfile ? 'Chargement de ta collection…' : 'Recherche des cartes et de leurs prix…'}</p>}
      {!loadingProfile && query.trim().length < 2 && <p className={styles.message}>Saisis au moins deux caractères pour afficher les cartes et leurs prix.</p>}
      {!searching && query.trim().length >= 2 && cards.length === 0 && !error && <p className={styles.message}>Aucune carte trouvée pour cette recherche.</p>}
      {cards.length > 0 && <div className={styles.grid}>
        {cards.map(card => {
          const market = card.marketPrice?.amount != null ? card.marketPrice : null
          const raw = market || card.rawPrice
          const amount = raw?.amount ?? null
          return <article className={styles.card} key={card.id}>
            <div className={styles.art}>
              {imageUrl(card) ? <img src={imageUrl(card)} alt={card.card_name} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement.dataset.imageMissing = 'true' }} /> : <span>Illustration<br />indisponible</span>}
              {amount != null && <button className={styles.price} type="button" onClick={() => setSelectedPrice({ card, amount: Number(amount), currency: raw.currency || 'EUR', source: raw.source || 'Prix observé', market: card.marketPrice })}>{euro(amount, raw.currency || 'EUR')}</button>}
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.number}>{card.card_sets?.set_name || 'Série'} · N° {card.collector_number}</span>
              <h3>{card.card_name}</h3>
              <p>{card.rarity_label || 'Rareté non renseignée'}</p>
              {amount == null && <small className={styles.noPrice}>Prix non gradé indisponible</small>}
              {card.graded.map(copy => <small className={styles.gradeInfo} key={copy.id}>{copy.card_grading_companies?.abbreviation || copy.card_grading_companies?.company_name} · note {copy.grade_label || copy.grade} · {copy.amount == null ? 'Prix gradé indisponible' : euro(copy.amount, copy.currency)}</small>)}
              {card.copies.length === 0 && <small className={styles.variantCount}>Pas encore dans ta collection</small>}
            </div>
          </article>
        })}
      </div>}
      <details className={styles.note}><summary>Sources et méthode</summary><p>Cardmarket est prioritaire (moyenne sur 30 jours si disponible). Si aucune valeur n’est fournie, le prix de marché TCGplayer sert de secours après conversion datée en euros. Les prix gradés sont séparés des prix bruts et ne sont affichés qu’à partir d’une valeur enregistrée pour l’exemplaire ou d’une observation correspondant à sa note.</p></details>
      {selectedPrice && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedPrice(null) }}>
        <section className={styles.priceDialog} role="dialog" aria-modal="true" aria-labelledby="individual-price-title">
          <button type="button" className={styles.dialogClose} aria-label="Fermer" onClick={() => setSelectedPrice(null)}>×</button>
          <span className={styles.eyebrow}>DÉTAIL DU PRIX</span>
          <h2 id="individual-price-title">{selectedPrice.card.card_name} · N° {selectedPrice.card.collector_number}</h2>
          <p className={styles.dialogMainPrice}>{euro(selectedPrice.amount, selectedPrice.currency)}</p>
          <p>{selectedPrice.source}{selectedPrice.market?.basis ? ` · ${selectedPrice.market.basis}` : ''}</p>
          {selectedPrice.market?.cardmarket && <div className={styles.dialogDetails}><strong>Cardmarket · moyennes sur 30 jours</strong>
            {selectedPrice.market.cardmarket.avg30 != null && <span>Normale : {euro(selectedPrice.market.cardmarket.avg30)}</span>}
            {selectedPrice.market.cardmarket['avg30-holo'] != null && <span>Holographique : {euro(selectedPrice.market.cardmarket['avg30-holo'])}</span>}
            {selectedPrice.market.cardmarket.updated && <small>Données actualisées le {new Date(selectedPrice.market.cardmarket.updated).toLocaleDateString('fr-FR')}</small>}
          </div>}
          {selectedPrice.market?.chosenFallback && <div className={styles.dialogDetails}><strong>Prix de secours · TCGplayer</strong><span>{euro(selectedPrice.market.chosenFallback.amount, 'USD')}</span>
            {selectedPrice.market.exchange && <small>Converti en euros au taux du {new Date(selectedPrice.market.exchange.date).toLocaleDateString('fr-FR')}</small>}
          </div>}
          <p className={styles.dialogFootnote}>Prix indicatif d’une carte non gradée. Une carte gradée a sa propre valeur.</p>
        </section>
      </div>}
    </main>
  )
}
