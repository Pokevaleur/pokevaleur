'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { fetchAllRows } from '../../../../lib/supabase-pagination.js'
import styles from './cards-value.module.css'

const OWNERSHIP_FILTERS = [
  ['all', 'Toutes'],
  ['owned', 'Possédées'],
  ['missing', 'Manquantes']
]

const GRADING_FILTERS = [
  ['all', 'Toutes'],
  ['raw', 'Non gradées'],
  ['graded', 'Mes gradées']
]

const FRENCH_SET_CODES = {
  swsh1: 'EB01',
  swsh2: 'EB02',
  swsh3: 'EB03',
  'swsh3.5': 'EB03.5',
  swsh4: 'EB04',
  'swsh4.5': 'EB04.5',
  'swsh4.5sv': 'EB04.5 SV',
  swsh5: 'EB05',
  swsh6: 'EB06',
  swsh7: 'EB07',
  cel25: 'EB07.5',
  cel25cc: 'EB07.5 CC',
  swsh8: 'EB08',
  swsh9: 'EB09',
  swsh9tg: 'EB09 TG',
  swsh10: 'EB10',
  swsh10tg: 'EB10 TG',
  'swsh10.5': 'EB10.5',
  swsh11: 'EB11',
  swsh11tg: 'EB11 TG',
  swsh12: 'EB12',
  swsh12tg: 'EB12 TG',
  'swsh12.5': 'EB12.5',
  'swsh12.5gg': 'EB12.5 GG',
  '30th': '30C',
  '30th-c': '30CC'
}

function seriesLabel(set) {
  const code = String(set?.set_code || '').trim().toLowerCase()
  const rawCode = set?.set_code || ''
  const displayCode = FRENCH_SET_CODES[code] || (/^sv\d/i.test(rawCode) ? 'EV' + rawCode.slice(2).toUpperCase() : rawCode.toUpperCase())
  const name = String(set?.set_name || 'Série').replace(/Classique(?=30e)/i, 'Classique ')
  return (displayCode ? displayCode + ' — ' : '') + name
}

function formatPrice(value, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)
}

function priceBasisLabel(price) {
  if (price?.basis === 'avg30') return 'moyenne Cardmarket sur 30 jours'
  if (price?.basis === 'avg30-holo') return 'moyenne Cardmarket holographique sur 30 jours'
  if (price?.basis === 'avg7' || price?.basis === 'avg7-holo') return 'moyenne Cardmarket sur 7 jours'
  if (price?.basis === 'avg' || price?.basis === 'avg-holo') return 'prix moyen Cardmarket'
  if (price?.basis === 'trend' || price?.basis === 'trend-holo') return 'tendance Cardmarket'
  if (price?.basis === 'marketPrice') return 'prix de marché TCGplayer'
  if (price?.basis === 'midPrice') return 'prix médian TCGplayer'
  return ''
}

function imageUrl(card) {
  const direct = card.image_url?.trim()
  if (direct) {
    const path = direct.split('?')[0].replace(/\/$/, '')
    if (/\.(png|jpe?g|webp)$/i.test(path)) return direct
    return path + '/low.webp'
  }
  const parts = (card.image_source_url || '').split('/').filter(Boolean)
  const setsIndex = parts.lastIndexOf('sets')
  if (setsIndex < 1 || setsIndex + 2 >= parts.length) return ''
  const language = parts[setsIndex - 1]
  const setCode = parts[setsIndex + 1]
  const localId = parts[setsIndex + 2]
  let seriesEnd = 0
  while (seriesEnd < setCode.length && /[a-z]/i.test(setCode[seriesEnd])) seriesEnd += 1
  const seriesCode = setCode.slice(0, seriesEnd)
  return seriesCode && language && localId
    ? `https://assets.tcgdex.net/${language}/${seriesCode}/${setCode}/${encodeURIComponent(localId)}/low.webp`
    : ''
}

function latestRawPrice(observations = []) {
  return observations
    .filter(row => row.price_kind === 'raw' && row.observation_type !== 'observed_listing')
    .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))[0] || null
}

function latestGradedPrice(observations = [], copies = []) {
  const gradedCopies = copies.filter(copy => copy.ownership_type === 'graded')
  const matches = observations.filter(row => row.price_kind === 'graded' && gradedCopies.some(copy => (
    copy.grading_company_id === row.grading_company_id && Number(copy.grade) === Number(row.grade)
  )))
  return matches.sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))[0] || null
}

export default function CardValuesBySeriesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState('')
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileId, setProfileId] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState('all')
  const [gradingFilter, setGradingFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const [marketPricesLoading, setMarketPricesLoading] = useState(false)
  const [priceDetailsCard, setPriceDetailsCard] = useState(null)
  const seriesPickerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function loadSets() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          window.location.replace('/login?next=%2Fcollection%2Fvaleur%2Fcartes')
          return
        }
        const [profileResult, setResult] = await Promise.all([
          supabase.from('collection_profiles').select('id,is_default').order('created_at'),
          supabase.from('card_sets').select('id,set_name,set_code,release_date').eq('is_public', true).eq('language', 'FR').order('release_date', { ascending: false })
        ])
        if (profileResult.error) throw profileResult.error
        if (setResult.error) throw setResult.error
        if (cancelled) return
        const savedProfileId = window.localStorage.getItem('pokevaleur-collection:' + user.id)
        const profile = (profileResult.data || []).find(row => row.id === savedProfileId)
          || (profileResult.data || []).find(row => row.is_default)
          || (profileResult.data || [])[0]
        setProfileId(profile?.id || '')
        setSets(setResult.data || [])
        const requested = new URLSearchParams(window.location.search).get('set') || ''
        if ((setResult.data || []).some(row => row.id === requested)) setSetId(requested)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de charger les séries.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSets()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (!seriesPickerOpen) return
    const closeOnEscape = event => {
      if (event.key === 'Escape') setSeriesPickerOpen(false)
    }
    const closeOnOutsideClick = event => {
      if (!seriesPickerRef.current?.contains(event.target)) setSeriesPickerOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [seriesPickerOpen])

  useEffect(() => {
    if (!setId || !profileId) {
      setCards([])
      return
    }
    let cancelled = false
    const pricesController = new AbortController()
    async function loadCards() {
      setCardsLoading(true)
      setMarketPricesLoading(false)
      setError('')
      try {
        const { data: cardRows, error: cardError } = await fetchAllRows(() => supabase.from('cards')
          .select('id,collector_number,card_name,rarity_label,image_url,image_source_url,guide_order,card_sets(set_code),card_print_variants(id,variant_label,variant_key,finish_code,is_master_set_target)')
          .eq('card_set_id', setId).order('guide_order', { ascending: true }))
        if (cardError) throw cardError
        if (cancelled) return
        const variantIds = (cardRows || []).flatMap(card => (card.card_print_variants || []).map(variant => variant.id))
        let copyRows = []
        let priceRows = []
        for (let offset = 0; offset < variantIds.length; offset += 100) {
          const batch = variantIds.slice(offset, offset + 100)
          const [copies, prices] = await Promise.all([
            supabase.from('collection_cards').select('id,card_print_variant_id,ownership_type,grade,grade_label,grading_company_id,current_value_override,card_grading_companies(company_name,abbreviation)').eq('collection_profile_id', profileId).in('card_print_variant_id', batch),
            supabase.from('card_price_observations').select('card_print_variant_id,price_kind,grading_company_id,grade,observation_type,amount,currency,source,observed_at').in('card_print_variant_id', batch).in('observation_type', ['confirmed_sale', 'estimate']).order('observed_at', { ascending: false })
          ])
          if (copies.error) throw copies.error
          if (prices.error) throw prices.error
          copyRows = copyRows.concat(copies.data || [])
          priceRows = priceRows.concat(prices.data || [])
        }
        if (cancelled) return
        const copiesByVariant = new Map()
        for (const copy of copyRows) {
          const rows = copiesByVariant.get(copy.card_print_variant_id) || []
          rows.push(copy)
          copiesByVariant.set(copy.card_print_variant_id, rows)
        }
        const pricesByVariant = new Map()
        for (const price of priceRows) {
          const rows = pricesByVariant.get(price.card_print_variant_id) || []
          rows.push(price)
          pricesByVariant.set(price.card_print_variant_id, rows)
        }
        const mapped = (cardRows || []).map(card => {
          const variants = card.card_print_variants || []
          const copies = variants.flatMap(variant => copiesByVariant.get(variant.id) || [])
          const observations = variants.flatMap(variant => pricesByVariant.get(variant.id) || [])
          const rawPrice = latestRawPrice(observations)
          const gradedPrice = latestGradedPrice(observations, copies)
          const latestGradedCopy = copies.filter(copy => copy.ownership_type === 'graded').sort((a, b) => Number(b.grade) - Number(a.grade))[0]
          return { ...card, variants, copies, rawPrice, gradedPrice, latestGradedCopy }
        })
        setCards(mapped)
        setCardsLoading(false)
        setMarketPricesLoading(true)
        try {
          const response = await fetch('/api/card-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cards: mapped.map(card => ({
              id: card.id,
              image_source_url: card.image_source_url,
              set_code: card.card_sets?.set_code,
              collector_number: card.collector_number,
              variants: card.variants.map(variant => ({ finish_code: variant.finish_code }))
            })) }),
            signal: pricesController.signal
          })
          if (response.ok) {
            const { prices = [] } = await response.json()
            const pricesByCard = new Map(prices.map(price => [price.cardId, price]))
            if (!cancelled) setCards(current => current.map(card => ({ ...card, marketPrice: pricesByCard.get(card.id) || null })))
          }
        } catch (priceError) {
          if (priceError.name !== 'AbortError') console.warn('Les prix externes sont indisponibles pour le moment.', priceError)
        } finally {
          if (!cancelled) setMarketPricesLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de charger les cartes et leurs valeurs.')
      } finally {
        if (!cancelled) setCardsLoading(false)
        if (!cancelled) setMarketPricesLoading(false)
      }
    }
    loadCards()
    return () => { cancelled = true; pricesController.abort() }
  }, [supabase, setId, profileId])

  const selectedSet = sets.find(set => set.id === setId)
  const filteredCards = cards.filter(card => {
    const owned = card.copies.length > 0
    if (ownershipFilter === 'owned' && !owned) return false
    if (ownershipFilter === 'missing' && owned) return false
    if (gradingFilter === 'graded' && !card.latestGradedCopy) return false
    const needle = search.trim().toLocaleLowerCase('fr')
    return !needle || `${card.card_name} ${card.collector_number}`.toLocaleLowerCase('fr').includes(needle)
  })
  const ownedCount = cards.filter(card => card.copies.length > 0).length

  function changeSet(value) {
    setSetId(value)
    const url = new URL(window.location.href)
    if (value) url.searchParams.set('set', value)
    else url.searchParams.delete('set')
    window.history.replaceState({}, '', url)
  }

  return (
    <main className={styles.page}>
      <a className={styles.backLink} href="/collection/valeur">← Ma collection · Valeur</a>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>MA COLLECTION · VALEUR DES CARTES</span>
        <h1>Une série, toutes ses cartes</h1>
        <p>Retrouve les cartes et leurs prix de référence. Les pastilles indiquent si chaque carte est dans ta collection.</p>
      </header>

      <section className={styles.controls} aria-label="Choix de la série et filtres">
        <label className={styles.seriesSelect}>Série
          <div className={styles.seriesPicker} ref={seriesPickerRef}>
            <button type="button" className={styles.seriesPickerTrigger} aria-haspopup="listbox" aria-expanded={seriesPickerOpen} disabled={loading} onClick={() => setSeriesPickerOpen(open => !open)}>
              <span>{selectedSet ? seriesLabel(selectedSet) : 'Choisir une série…'}</span>
              <span className={styles.seriesPickerChevron} aria-hidden="true">▾</span>
            </button>
            {seriesPickerOpen && <div className={styles.seriesPickerOptions} role="listbox" aria-label="Séries du catalogue">
              {sets.map(set => <button type="button" role="option" aria-selected={setId === set.id} className={setId === set.id ? styles.seriesPickerOptionActive : styles.seriesPickerOption} key={set.id} onClick={() => { changeSet(set.id); setSeriesPickerOpen(false) }}>{seriesLabel(set)}</button>)}
            </div>}
          </div>
        </label>
        <label className={styles.search}>Rechercher une carte
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nom ou numéro" />
        </label>
        <div className={styles.filterBlock} role="group" aria-label="Filtrer par présence dans la collection">
          <span>Dans ma collection</span>
          <div className={styles.chips}>{OWNERSHIP_FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={ownershipFilter === key} className={ownershipFilter === key ? styles.chipActive : styles.chip} onClick={() => setOwnershipFilter(key)}>{label}</button>)}</div>
        </div>
        <div className={styles.filterBlock} role="group" aria-label="Filtrer les cartes gradées">
          <span>État de gradation</span>
          <div className={styles.chips}>{GRADING_FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={gradingFilter === key} className={gradingFilter === key ? styles.chipActive : styles.chip} onClick={() => setGradingFilter(key)}>{label}</button>)}</div>
        </div>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <p className={styles.message} role="status">Chargement des séries…</p> : null}
      {!loading && !sets.length && <p className={styles.message}>Aucune série française n’est disponible.</p>}
      {selectedSet && <section aria-live="polite">
        <div className={styles.resultsHeader}>
          <div><span>{seriesLabel(selectedSet).split(' — ')[0] || 'SÉRIE'}</span><h2>{selectedSet.set_name.replace(/Classique(?=30e)/i, 'Classique ')}</h2></div>
          <p><strong>{filteredCards.length}</strong> cartes affichées · <strong>{ownedCount}</strong> possédées</p>
        </div>
        {marketPricesLoading && <p className={styles.priceStatus} role="status">Récupération des prix de référence…</p>}
        {cardsLoading ? <p className={styles.message} role="status">Chargement des cartes et des prix…</p> : filteredCards.length ? (
          <div className={styles.grid}>
            {filteredCards.map(card => {
              const owned = card.copies.length > 0
              const price = gradingFilter === 'graded' ? card.gradedPrice : card.rawPrice
              const gradedOwned = card.copies.filter(copy => copy.ownership_type === 'graded')
              const override = card.latestGradedCopy?.current_value_override
              const marketPrice = card.marketPrice?.amount != null ? card.marketPrice : null
              const selectedPrice = gradingFilter === 'graded' ? price : (marketPrice || price)
              const displayedPrice = gradingFilter === 'graded' && override != null ? Number(override) : selectedPrice ? Number(selectedPrice.amount) : null
              const displayCurrency = gradingFilter === 'graded' && override != null ? 'EUR' : selectedPrice?.currency || 'EUR'
              const latestCopy = card.latestGradedCopy
              return <article className={styles.card} key={card.id}>
                <div className={styles.art}>
                  {imageUrl(card) ? <img src={imageUrl(card)} alt={card.card_name} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement.dataset.imageMissing = 'true' }} /> : <span>Illustration<br />indisponible</span>}
                  <span className={owned ? styles.statusOwned : styles.statusMissing}>{owned ? 'Possédée' : 'Manquante'}</span>
                  {displayedPrice != null && <button type="button" className={styles.price} aria-label={`Voir le détail du prix de ${card.card_name}`} onClick={() => setPriceDetailsCard({ ...card, shownAmount: displayedPrice, shownCurrency: displayCurrency, shownSource: override != null ? 'Valeur renseignée pour ma carte gradée' : selectedPrice?.source || 'Prix de référence', shownObservedAt: selectedPrice?.observed_at || selectedPrice?.observedAt || null })}>{formatPrice(displayedPrice, displayCurrency)}</button>}
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.number}>N° {card.collector_number}</span>
                  <h3>{card.card_name}</h3>
                  <p>{card.rarity_label || 'Rareté non renseignée'}</p>
                  {gradingFilter === 'graded' && latestCopy && <small className={styles.gradeInfo}>{latestCopy.card_grading_companies?.abbreviation || latestCopy.card_grading_companies?.company_name} · note {latestCopy.grade_label || latestCopy.grade}</small>}
                  {displayedPrice == null && <small className={styles.noPrice}>{gradingFilter === 'graded' ? 'Prix gradé indisponible' : 'Prix indisponible'}</small>}
                  {gradingFilter === 'all' && gradedOwned.length > 0 && <small className={styles.gradeInfo}>{gradedOwned.length} exemplaire{gradedOwned.length > 1 ? 's' : ''} gradé{gradedOwned.length > 1 ? 's' : ''} dans la collection</small>}
                  {card.variants.length > 1 && <small className={styles.variantCount}>{card.variants.length} variantes de référence</small>}
                </div>
              </article>
            })}
          </div>
        ) : <p className={styles.message}>Aucune carte ne correspond à ces filtres.</p>}
        {!cardsLoading && cards.length > 0 && <details className={styles.note}>
          <summary>Sources et méthode des prix</summary>
          <p>La pastille affiche uniquement le prix en euros. Cardmarket est prioritaire, avec sa moyenne sur 30 jours quand elle est disponible. En son absence, une valeur de marché TCGplayer peut servir de secours, convertie en euros avec le taux de référence daté de Frankfurter.</p>
          <p>Appuie sur le prix d’une carte pour voir la source, la moyenne Cardmarket sur 30 jours, la date des données et, si nécessaire, le détail de la conversion. Les valeurs sont indicatives et concernent les cartes non gradées. Les sources peuvent parfois confondre deux impressions proches ; aucune valeur n’est inventée quand elles ne trouvent pas de correspondance fiable.</p>
        </details>}
      </section>}
      {!selectedSet && !loading && <p className={styles.message}>Choisis une série pour afficher toutes ses cartes et leurs valeurs.</p>}
      {priceDetailsCard && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPriceDetailsCard(null) }}>
        <section className={styles.priceDialog} role="dialog" aria-modal="true" aria-labelledby="price-dialog-title">
          <button type="button" className={styles.dialogClose} aria-label="Fermer" onClick={() => setPriceDetailsCard(null)}>×</button>
          <span className={styles.eyebrow}>DÉTAIL DU PRIX</span>
          <h2 id="price-dialog-title">{priceDetailsCard.card_name} · N° {priceDetailsCard.collector_number}</h2>
          <p className={styles.dialogMainPrice}>{formatPrice(priceDetailsCard.shownAmount, priceDetailsCard.shownCurrency)}</p>
          <p>{priceDetailsCard.shownSource}{priceDetailsCard.marketPrice?.basis ? ` · ${priceBasisLabel(priceDetailsCard.marketPrice)}` : ''}</p>
          {priceDetailsCard.marketPrice?.cardmarket && <div className={styles.dialogDetails}>
            <strong>Cardmarket · moyennes sur 30 jours</strong>
            {priceDetailsCard.marketPrice.cardmarket['avg30'] != null && <span>Normale : {formatPrice(priceDetailsCard.marketPrice.cardmarket['avg30'], 'EUR')}</span>}
            {priceDetailsCard.marketPrice.cardmarket['avg30-holo'] != null && <span>Holographique : {formatPrice(priceDetailsCard.marketPrice.cardmarket['avg30-holo'], 'EUR')}</span>}
            {priceDetailsCard.marketPrice.cardmarket.updated && <small>Données Cardmarket actualisées le {new Date(priceDetailsCard.marketPrice.cardmarket.updated).toLocaleDateString('fr-FR')}</small>}
          </div>}
          {priceDetailsCard.marketPrice?.chosenFallback && <div className={styles.dialogDetails}>
            <strong>Secours TCGplayer</strong>
            <span>{formatPrice(priceDetailsCard.marketPrice.chosenFallback.amount, 'USD')} · {priceDetailsCard.marketPrice.chosenFallback.field}</span>
            {priceDetailsCard.marketPrice.exchange && <small>Conversion USD → EUR : {priceDetailsCard.marketPrice.exchange.rate} · taux du {new Date(priceDetailsCard.marketPrice.exchange.date).toLocaleDateString('fr-FR')}</small>}
          </div>}
          {priceDetailsCard.shownObservedAt && <small className={styles.dialogDate}>Données source : {new Date(priceDetailsCard.shownObservedAt).toLocaleDateString('fr-FR')}</small>}
          <p className={styles.dialogFootnote}>Cote indicative pour une carte non gradée. Une carte gradée peut avoir une valeur différente.</p>
        </section>
      </div>}
    </main>
  )
}
