'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import styles from './page.module.css'

const ALL_SERIES = '__all_series__'
const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,card_type,element_types,rarity_label,image_url,guide_order,card_sets(id,set_name,set_code),card_print_variants(id,variant_label,finish_code,guide_marker,checklist_group)'

function seriesLabel(set) {
  return (set.set_code ? set.set_code.toUpperCase() + ' — ' : '') + set.set_name
}

function relatedSet(card) {
  return Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
}

export default function CardCataloguePage() {
  const supabase = useMemo(() => createClient(), [])
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState(ALL_SERIES)
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState([])
  const [loadingSets, setLoadingSets] = useState(true)
  const [loadingCards, setLoadingCards] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [zoomedCard, setZoomedCard] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadSets() {
      const { data, error: loadError } = await supabase.from('card_sets')
        .select('id,set_name,set_code,language,release_date')
        .eq('is_public', true).eq('language', 'FR')
        .order('release_date', { ascending: false }).order('set_name')
      if (cancelled) return
      if (loadError) setError('Le catalogue de cartes ne peut pas être chargé pour le moment.')
      else setSets(data || [])
      setLoadingSets(false)
    }
    loadSets()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (!zoomedCard) return
    const closeOnEscape = event => { if (event.key === 'Escape') setZoomedCard(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [zoomedCard])

  async function searchCards(event) {
    event.preventDefault()
    setSearched(true)
    setError('')
    setCards([])
    const term = query.trim()
    const publicSetIds = sets.map(set => set.id)
    if (setId === ALL_SERIES && !term) return
    if (setId === ALL_SERIES && !publicSetIds.length) {
      setError('Aucune série française n’est publiée pour le moment.')
      return
    }

    setLoadingCards(true)
    const buildQuery = () => {
      let request = supabase.from('cards').select(CARD_FIELDS)
      request = setId === ALL_SERIES
        ? request.in('card_set_id', publicSetIds)
        : request.eq('card_set_id', setId)
      return request
    }

    try {
      if (term) {
        const isNumber = /^[A-Za-z]*\d+(?:[A-Za-z0-9./-]*)$/.test(term)
        const { data, error: loadError } = await fetchAllRows(() => {
          const request = buildQuery()
          return isNumber
            ? request.eq('collector_number', term).order('card_name')
            : request.ilike('card_name', '%' + term + '%').order('card_name')
        })
        if (loadError) throw loadError
        setCards(data || [])
      } else {
        const { data, error: loadError } = await fetchAllRows(() =>
          buildQuery().order('guide_order', { ascending: true }).order('collector_number')
        )
        if (loadError) throw loadError
        setCards(data || [])
      }
    } catch {
      setError('Impossible de charger les cartes. Réessaie ou choisis une série précise.')
    } finally {
      setLoadingCards(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Catalogue · Cartes</p>
        <h1>Le catalogue des cartes</h1>
        <p>Explore les cartes françaises répertoriées, par série ou en recherchant un Pokémon. Le catalogue décrit les cartes ; leur possession se suit séparément dans Ma Collection.</p>
      </header>

      <form className={styles.searchPanel} onSubmit={searchCards}>
        <label>
          <span>Série</span>
          <select value={setId} onChange={event => setSetId(event.target.value)} disabled={loadingSets}>
            <option value={ALL_SERIES}>Toutes les séries</option>
            {sets.map(set => <option value={set.id} key={set.id}>{seriesLabel(set)}</option>)}
          </select>
        </label>
        <label>
          <span>Nom d’une carte ou numéro</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pikachu, Dracaufeu, 189" />
        </label>
        <button type="submit" disabled={loadingSets || loadingCards}>{loadingCards ? 'Recherche…' : 'Rechercher'}</button>
      </form>

      {!error && !searched && <p className={styles.hint}>Choisis une série pour la parcourir, ou recherche un nom dans toutes les séries.</p>}
      {error && <p className={styles.message} role="alert">{error}</p>}
      {searched && !loadingCards && !error && setId === ALL_SERIES && !query.trim() && <p className={styles.hint}>Choisis une série ou saisis un nom ou un numéro de carte.</p>}
      {loadingCards && <p className={styles.hint} role="status">Recherche des cartes…</p>}
      {searched && !loadingCards && !error && query.trim() && <p className={styles.resultCount}>{cards.length ? cards.length + ' cartes trouvées' : 'Aucune carte trouvée'}</p>}

      {searched && !loadingCards && !error && cards.length > 0 && (
        <section className={styles.grid} aria-label="Résultats du catalogue de cartes">
          {cards.map(card => {
            const set = relatedSet(card)
            const variants = [...new Set((card.card_print_variants || [])
              .map(variant => variant.variant_label)
              .filter(label => label && label !== 'Carte (suivi de base)'))]
            return (
              <article className={styles.card} key={card.id}>
                {card.image_url ? (
                  <button className={styles.imageButton} type="button" onClick={() => setZoomedCard(card)} aria-label={'Agrandir ' + card.card_name}>
                    <img src={card.image_url} alt={card.card_name} loading="lazy" />
                    <span aria-hidden="true">⌕</span>
                  </button>
                ) : <div className={styles.imagePlaceholder}>Image à ajouter</div>}
                <div className={styles.cardInfo}>
                  <p className={styles.cardSet}>{set ? seriesLabel(set) : 'Série non renseignée'}</p>
                  <h2>{card.card_name}</h2>
                  <p className={styles.cardNumber}>{card.collector_number || 'Numéro non renseigné'}{card.rarity_label ? ' · ' + card.rarity_label : ''}</p>
                  {variants.length > 0 && <p className={styles.variants}>{variants.join(' · ')}</p>}
                  {set && <a className={styles.collectionLink} href={'/collection/cartes?set=' + encodeURIComponent(set.id)}>Voir cette série dans Ma Collection →</a>}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {zoomedCard && (
        <div className={styles.modal} role="presentation" onClick={() => setZoomedCard(null)}>
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label={'Carte ' + zoomedCard.card_name} onClick={event => event.stopPropagation()}>
            <button type="button" className={styles.closeButton} onClick={() => setZoomedCard(null)} aria-label="Fermer">×</button>
            <img src={zoomedCard.image_url} alt={zoomedCard.card_name} />
            <p>{zoomedCard.card_name} · {zoomedCard.collector_number}</p>
          </div>
        </div>
      )}
    </main>
  )
}
