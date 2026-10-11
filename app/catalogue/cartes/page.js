'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import styles from './page.module.css'

const ALL_SERIES = '__all_series__'
const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,card_type,element_types,rarity_label,image_url,guide_order,card_sets(id,set_name,set_code),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target)'

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
  'swsh12.5gg': 'EB12.5 GG'
}

function seriesLabel(set) {
  const code = (set?.set_code || '').toLowerCase()
  const rawCode = set?.set_code || ''
  const displayCode = FRENCH_SET_CODES[code] || (/^sv\d/i.test(rawCode) ? 'EV' + rawCode.slice(2).toUpperCase() : rawCode.toUpperCase())
  return (displayCode ? displayCode + ' — ' : '') + (set?.set_name || 'Série')
}

function relatedSet(card) {
  return Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
}

export default function CardCataloguePage() {
  const supabase = useMemo(() => createClient(), [])
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState('')
  const [query, setQuery] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [cards, setCards] = useState([])
  const [owned, setOwned] = useState({})
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [user, setUser] = useState(null)
  const [loadingSets, setLoadingSets] = useState(true)
  const [loadingCards, setLoadingCards] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selection, setSelection] = useState({})
  const [saving, setSaving] = useState(false)
  const [zoomedCard, setZoomedCard] = useState(null)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const seriesPickerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const [{ data: setRows, error: setLoadError }, { data: { user: signedInUser } }] = await Promise.all([
        supabase.from('card_sets').select('id,set_name,set_code,language,release_date,advertised_card_count,checklist_scope_note')
          .eq('is_public', true).eq('language', 'FR').order('release_date', { ascending: false }).order('set_name'),
        supabase.auth.getUser()
      ])
      if (cancelled) return
      if (setLoadError) setError('Le catalogue de cartes ne peut pas être chargé pour le moment.')
      else {
        setSets(setRows || [])
        const requestedSetId = new URLSearchParams(window.location.search).get('set')
        if ((setRows || []).some(set => set.id === requestedSetId)) setSetId(requestedSetId)
      }
      setUser(signedInUser || null)
      if (signedInUser) {
        const { data: profileRows } = await supabase.from('collection_profiles')
          .select('id,display_name,is_default,profile_type').order('created_at')
        if (cancelled) return
        const savedId = window.localStorage.getItem('pokevaleur-collection:' + signedInUser.id)
        const active = (profileRows || []).find(row => row.id === savedId)
          || (profileRows || []).find(row => row.is_default)
          || (profileRows || [])[0]
        setProfiles(profileRows || [])
        if (active) {
          setProfileId(active.id)
          window.localStorage.setItem('pokevaleur-collection:' + signedInUser.id, active.id)
        }
      }
      setLoadingSets(false)
    }
    initialize().catch(() => { if (!cancelled) setError('Impossible de charger le catalogue.') })
      .finally(() => { if (!cancelled) setLoadingSets(false) })
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (!zoomedCard && !seriesPickerOpen) return
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setZoomedCard(null)
        setSeriesPickerOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [zoomedCard, seriesPickerOpen])

  useEffect(() => {
    if (!seriesPickerOpen) return
    const closeOnOutsideClick = event => {
      if (!seriesPickerRef.current?.contains(event.target)) setSeriesPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [seriesPickerOpen])

  useEffect(() => {
    if (!setId) {
      setCards([])
      setOwned({})
      setSelection({})
      setLoadingCards(false)
      return
    }
    if (setId === ALL_SERIES && !query.trim()) {
      setCards([])
      setOwned({})
      setSelection({})
      setLoadingCards(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoadingCards(true)
      setError('')
      setNotice('')
      setCards([])
      setOwned({})
      setSelection({})
      try {
        const setIds = setId === ALL_SERIES ? sets.map(set => set.id) : [setId]
        if (!setIds.length) return
        const term = query.trim().replace(/[%_]/g, '\\$&')
        const { data: rows, error: loadError } = await fetchAllRows(() => {
          let request = supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
          if (setId === ALL_SERIES && term) request = request.ilike('card_name', '%' + term + '%')
          return request.order('guide_order', { ascending: true }).order('collector_number', { ascending: true })
        })
        if (loadError) throw loadError
        if (cancelled) return
        const cardRows = rows || []
        const variantIds = Array.from(new Set(cardRows.flatMap(card => (card.card_print_variants || []).map(variant => variant.id))))
        let copyRows = []
        if (profileId && variantIds.length) {
          // Keep the URL for each PostgREST .in() request short enough for mobile networks and proxies.
          for (let offset = 0; offset < variantIds.length; offset += 100) {
            const variantBatch = variantIds.slice(offset, offset + 100)
            const { data, error: copyError } = await fetchAllRows(() => supabase.from('collection_cards')
              .select('id,card_print_variant_id,ownership_type,grade,grade_label')
              .eq('collection_profile_id', profileId).in('card_print_variant_id', variantBatch))
            if (copyError) throw copyError
            copyRows.push(...(data || []))
          }
        }
        const ownership = {}
        for (const copy of copyRows) {
          if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
          ownership[copy.card_print_variant_id].push(copy)
        }
        if (!cancelled) { setCards(cardRows); setOwned(ownership) }
      } catch {
        if (!cancelled) setError('Impossible de charger les cartes de cette série. Réessaie dans un instant.')
      } finally {
        if (!cancelled) setLoadingCards(false)
      }
    }, setId === ALL_SERIES ? 250 : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [supabase, setId, query, profileId, sets])

  const selectedSet = sets.find(set => set.id === setId)
  const visibleCards = cards.filter(card => {
    const term = filterQuery.trim().toLocaleLowerCase('fr')
    return !term || (String(card.collector_number || '') + ' ' + card.card_name).toLocaleLowerCase('fr').includes(term)
  })
  const selectedRows = Object.entries(selection).filter(([, qty]) => Number(qty) > 0)
  const selectedCopies = selectedRows.reduce((sum, [, qty]) => sum + Number(qty || 0), 0)

  function selectProfile(nextId) {
    setProfileId(nextId)
    setSelection({})
    setNotice('')
    if (user) window.localStorage.setItem('pokevaleur-collection:' + user.id, nextId)
  }

  function setVariantSelected(variantId, checked) {
    setSelection(current => {
      const next = { ...current }
      if (checked) next[variantId] = next[variantId] || 1
      else delete next[variantId]
      return next
    })
  }

  async function addSelectedVariants() {
    if (!user) {
      window.location.href = '/login?next=%2Fcatalogue%2Fcartes'
      return
    }
    if (!profileId || !selectedRows.length || saving) return
    const variantById = new Map(cards.flatMap(card => card.card_print_variants || []).map(variant => [variant.id, variant]))
    const rows = []
    for (const [variantId, rawQuantity] of selectedRows) {
      const variant = variantById.get(variantId)
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(rawQuantity) || 1)))
      if (!variant?.is_master_set_target) continue
      for (let index = 0; index < quantity; index++) rows.push({
        user_id: user.id,
        collection_profile_id: profileId,
        card_print_variant_id: variantId,
        ownership_type: 'raw'
      })
    }
    if (!rows.length) return
    setSaving(true)
    setNotice('')
    try {
      const insertedCopies = []
      for (let offset = 0; offset < rows.length; offset += 100) {
        const { data, error: insertError } = await supabase.from('collection_cards').insert(rows.slice(offset, offset + 100))
          .select('id,card_print_variant_id,ownership_type,grade,grade_label')
        if (insertError) throw insertError
        const saved = data || []
        insertedCopies.push(...saved)
        setOwned(current => {
          const next = { ...current }
          for (const copy of saved) next[copy.card_print_variant_id] = [...(next[copy.card_print_variant_id] || []), copy]
          return next
        })
      }
      setSelection({})
      setNotice(insertedCopies.length + ' exemplaire' + (insertedCopies.length > 1 ? 's ajoutés' : ' ajouté') + ' à ' + (profiles.find(row => row.id === profileId)?.display_name || 'la collection') + '.')
    } catch (saveError) {
      setNotice(insertedCopies.length
        ? insertedCopies.length + ' exemplaire(s) ajouté(s) ; le reste n’a pas été enregistré : ' + (saveError.message || 'réessaie.')
        : 'Ajout impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Catalogue · Cartes</p>
        <h1>Choisir des cartes à ajouter</h1>
        <p>Choisis une série pour afficher sa liste complète. Coche chaque impression que tu possèdes, indique les doublons, puis ajoute la sélection à la collection choisie.</p>
      </header>

      <section className={styles.selectionPanel} aria-label="Choix de la série et de la collection">
        <label className={styles.seriesField}>
          <span>Série</span>
          <div className={styles.seriesPicker} ref={seriesPickerRef}>
            <button type="button" className={styles.seriesPickerTrigger} aria-haspopup="listbox" aria-expanded={seriesPickerOpen} disabled={loadingSets} onClick={() => setSeriesPickerOpen(open => !open)}>
              <span>{selectedSet ? seriesLabel(selectedSet) : setId === ALL_SERIES ? 'Toutes les séries · rechercher' : 'Choisir une série…'}</span>
              <span className={styles.seriesPickerChevron} aria-hidden="true">▾</span>
            </button>
            {seriesPickerOpen && <div className={styles.seriesPickerOptions} role="listbox" aria-label="Séries du catalogue">
              <button type="button" role="option" aria-selected={!setId} className={styles.seriesPickerOption} onClick={() => { setSetId(''); setFilterQuery(''); setSelection({}); setSeriesPickerOpen(false) }}>Choisir une série…</button>
              <button type="button" role="option" aria-selected={setId === ALL_SERIES} className={setId === ALL_SERIES ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(ALL_SERIES); setFilterQuery(''); setSelection({}); setSeriesPickerOpen(false) }}>Toutes les séries · rechercher</button>
              {sets.map(set => <button type="button" role="option" aria-selected={setId === set.id} className={setId === set.id ? styles.seriesPickerOptionActive : styles.seriesPickerOption} key={set.id} onClick={() => { setSetId(set.id); setFilterQuery(''); setSelection({}); setSeriesPickerOpen(false) }}>{seriesLabel(set)}</button>)}
            </div>}
          </div>
        </label>
        {setId === ALL_SERIES && <label className={styles.searchField}>
          <span>Nom d’une carte</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pikachu" />
        </label>}
        {selectedSet && <label className={styles.searchField}>
          <span>Filtrer cette série</span>
          <input type="search" value={filterQuery} onChange={event => { setFilterQuery(event.target.value); setSelection({}) }} placeholder="Numéro ou nom…" />
        </label>}
        {profiles.length > 1 && <label className={styles.profileField}>
          <span>Ajouter à la collection</span>
          <select value={profileId} onChange={event => selectProfile(event.target.value)}>
            {profiles.map(profile => <option value={profile.id} key={profile.id}>{profile.display_name || (profile.profile_type === 'adult' ? 'Ma collection' : 'Collection')}</option>)}
          </select>
        </label>}
      </section>

      {error && <p className={styles.message} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {!setId && !loadingSets && <p className={styles.hint}>La liste apparaîtra dès que tu auras choisi une série.</p>}
      {setId === ALL_SERIES && !query.trim() && <p className={styles.hint}>Saisis un nom pour rechercher dans toutes les séries.</p>}
      {loadingCards && <p className={styles.hint} role="status">Chargement de la liste complète…</p>}

      {selectedSet && !loadingCards && !error && <div className={styles.setSummary}>
        <div><strong>{seriesLabel(selectedSet)}</strong><span>{visibleCards.length}{filterQuery ? ' résultat(s)' : ' cartes dans la liste du catalogue'}</span></div>
        <a href={'/collection/cartes?set=' + encodeURIComponent(setId) + '&collection=owned'}>Voir mes cartes de cette série →</a>
      </div>}

      {cards.length > 0 && !loadingCards && (
        <section className={styles.checklist} aria-label={selectedSet ? 'Liste des cartes de ' + seriesLabel(selectedSet) : 'Résultats de recherche'}>
          {!visibleCards.length && <p className={styles.hint}>Aucune carte ne correspond à ce filtre.</p>}
          {visibleCards.map((card, index) => {
            const variants = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
            const set = relatedSet(card)
            return <article className={styles.cardRow} key={card.id}>
              <button className={styles.thumbButton} type="button" onClick={() => setZoomedCard(card)} aria-label={'Voir l’image de ' + card.card_name}>
                {card.image_url ? <img src={card.image_url} alt={card.card_name} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index < 4 ? 'high' : 'auto'} onError={event => { const image = event.currentTarget; if (!image.dataset.pngFallback && image.src.includes('/low.webp')) { image.dataset.pngFallback = 'true'; image.src = image.src.replace('/low.webp', '/low.png'); return } image.style.display = 'none'; image.parentElement?.setAttribute('data-image-error', 'true') }} /> : <span>Image indisponible</span>}
                <span className={styles.zoomIcon} aria-hidden="true">⌕</span>
              </button>
              <div className={styles.cardIdentity}>
                <span className={styles.cardNumber}>{setId === ALL_SERIES ? seriesLabel(set) + ' · ' : ''}N° {card.collector_number}</span>
                <button type="button" className={styles.nameButton} onClick={() => setZoomedCard(card)}>{card.card_name}</button>
                <span className={styles.rarity}>{card.rarity_label || 'Rareté non renseignée'}</span>
              </div>
              <div className={styles.printings} role="group" aria-label={'Impressions de ' + card.card_name}>
                {!variants.length && <span className={styles.noVariants}>Impressions à préciser</span>}
                {variants.map(variant => {
                  const checked = Object.prototype.hasOwnProperty.call(selection, variant.id)
                  const quantity = selection[variant.id] || 1
                  const copies = owned[variant.id]?.length || 0
                  const label = variant.variant_label === 'Carte (suivi de base)' ? 'Carte' : variant.variant_label
                  return <div className={styles.printing} key={variant.id}>
                    <label className={styles.printingCheck}>
                      <input type="checkbox" checked={checked} onChange={event => setVariantSelected(variant.id, event.target.checked)} />
                      <span>{label}</span>
                      {copies > 0 && <small>Déjà {copies} en collection</small>}
                    </label>
                    {checked && <label className={styles.quantity}>
                      <span>Qté</span>
                      <input type="number" min="1" max="99" inputMode="numeric" value={quantity} onChange={event => setSelection(current => ({ ...current, [variant.id]: event.target.value }))} aria-label={'Quantité de ' + card.card_name + ' ' + label} />
                    </label>}
                  </div>
                })}
              </div>
            </article>
          })}
        </section>
      )}

      {cards.length > 0 && !loadingCards && !seriesPickerOpen && <aside className={styles.addBar} aria-label="Valider l’ajout à la collection">
        <p aria-live="polite">{selectedRows.length} impression{selectedRows.length > 1 ? 's' : ''} sélectionnée{selectedRows.length > 1 ? 's' : ''} · {selectedCopies} exemplaire{selectedCopies > 1 ? 's' : ''}</p>
        <button type="button" disabled={!selectedRows.length || saving} onClick={addSelectedVariants}>
          {saving ? 'Ajout en cours…' : 'Ajouter à ma collection'}
        </button>
        {!!selectedRows.length && <button className={styles.clearButton} type="button" disabled={saving} onClick={() => setSelection({})}>Effacer</button>}
      </aside>}

      {setId && !loadingCards && !error && !cards.length && (setId !== ALL_SERIES || query.trim()) && <p className={styles.hint}>Aucune carte trouvée pour cette série ou cette recherche.</p>}

      {zoomedCard && <div className={styles.modal} role="presentation" onClick={() => setZoomedCard(null)}>
        <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label={'Carte ' + zoomedCard.card_name} onClick={event => event.stopPropagation()}>
          <button type="button" className={styles.closeButton} onClick={() => setZoomedCard(null)} aria-label="Fermer">×</button>
          <img src={zoomedCard.image_url} alt={zoomedCard.card_name} />
          <p>{zoomedCard.card_name} · {zoomedCard.collector_number}</p>
        </div>
      </div>}
    </main>
  )
}
