'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import styles from './page.module.css'

const ALL_SERIES = '__all_series__'
const MCDONALDS_SERIES = '__mcdonalds_series__'
const DEDICATED_ENERGY_SET_CODES = new Set(['sve', 'uen17', 'uen19', 'uen20', 'uen22', 'mee30', 'sv10.5e'])
const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,card_type,element_types,rarity_label,image_url,guide_order,card_sets!cards_card_set_id_fkey(id,set_name,set_code,release_date),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target,copyright_year,image_url,image_source_url)'
const MCDONALDS_PTCG_IMAGE_YEARS = new Set(['2011', '2012', '2014', '2015', '2016', '2017', '2021', '2022'])

function normalizedCardName(name) {
  return String(name || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function mcdonaldsCardImageCandidates(card, set, matchingImages = []) {
  if (!isMcDonaldsSet(set)) return card.image_url ? [card.image_url] : []

  const year = String(set?.set_name || '').match(/20\d{2}/)?.[0]
  const number = String(card.collector_number || '').match(/\d+/)?.[0]
  const tcgApiImage = year && number && MCDONALDS_PTCG_IMAGE_YEARS.has(year)
    ? `https://images.pokemontcg.io/mcd${year.slice(-2)}/${Number(number)}.png`
    : null
  const originalImage = card.image_url || ''
  const hasUnavailableTcgdexPath = originalImage.includes('assets.tcgdex.net/fr/mc/')
  const candidates = [
    tcgApiImage,
    !hasUnavailableTcgdexPath ? originalImage : null,
    ...matchingImages,
    hasUnavailableTcgdexPath ? originalImage : null
  ].filter(Boolean)
  return [...new Set(candidates)]
}

function advanceCardImage(event, candidates) {
  const image = event.currentTarget
  const nextIndex = Number(image.dataset.imageIndex || 0) + 1
  if (candidates[nextIndex]) {
    image.dataset.imageIndex = String(nextIndex)
    image.src = candidates[nextIndex]
    return
  }
  image.style.display = 'none'
  image.parentElement?.setAttribute('data-image-error', 'true')
}

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
  mee30: 'MEE 30 ans',
  '30th': '30C',
  '30th-c': '30CC'
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

function isGoldEnergy(card) {
  return card?.card_type === 'Énergie' && /hyper rare/i.test(card?.rarity_label || '')
}

function isUnnumberedEnergyCard(card) {
  return card?.card_type === 'Énergie' && /^UEN-/i.test(String(card?.collector_number || ''))
}

function isEnergySearch(value) {
  return ['energie', 'energy', 'plante', 'grass', 'feu', 'fire', 'eau', 'water', 'electri', 'lightning', 'foudre', 'psy', 'psychic', 'combat', 'fighting', 'obscurite', 'darkness', 'metal', 'incolore', 'colorless', 'gold', 'dore']
    .some(alias => normalizedSearchText(value).includes(alias))
}

function normalizedSearchText(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function energyElementSearchTerms(card) {
  const aliases = {
    plante: 'plante grass',
    feu: 'feu fire',
    eau: 'eau water',
    electrique: 'electrique electric electrik lightning foudre',
    psy: 'psy psychic',
    combat: 'combat fighting',
    obscurite: 'obscurite darkness',
    metal: 'metal',
    incolore: 'incolore colorless'
  }
  return (card?.element_types || []).flatMap(type => {
    const normalizedType = normalizedSearchText(type)
    return aliases[normalizedType] || [type]
  }).join(' ')
}

function isMcDonaldsSet(set) {
  const family = String(set?.series_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
  const name = String(set?.set_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
  return family.includes('mcdonald') || name.includes('mcdonald')
}

function isDedicatedEnergySet(set) {
  return DEDICATED_ENERGY_SET_CODES.has(String(set?.set_code || '').toLowerCase())
}

export default function CardCataloguePage() {
  const supabase = useMemo(() => createClient(), [])
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState('')
  const [query, setQuery] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [cards, setCards] = useState([])
  const [cardImageCandidates, setCardImageCandidates] = useState({})
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
  const [ownershipCardId, setOwnershipCardId] = useState(null)
  const [ownershipPopoverPosition, setOwnershipPopoverPosition] = useState(null)
  const [removingCopyId, setRemovingCopyId] = useState('')
  const [removedCopies, setRemovedCopies] = useState([])
  const [ownershipNotice, setOwnershipNotice] = useState('')
  const ownershipInfoRef = useRef(null)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const [seriesPickerQuery, setSeriesPickerQuery] = useState('')
  const seriesPickerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const [{ data: setRows, error: setLoadError }, { data: { user: signedInUser } }] = await Promise.all([
        supabase.from('card_sets').select('id,series_name,set_name,set_code,language,release_date,advertised_card_count,checklist_scope_note')
          .eq('is_public', true).eq('language', 'FR').order('release_date', { ascending: false }).order('set_name'),
        supabase.auth.getUser()
      ])
      if (cancelled) return
      if (setLoadError) setError('Le catalogue de cartes ne peut pas être chargé pour le moment.')
      else {
        setSets(setRows || [])
        const searchParams = new URLSearchParams(window.location.search)
        const requestedSetId = searchParams.get('set')
        const requestedSearch = searchParams.get('search')
        if (requestedSearch) {
          setSetId(ALL_SERIES)
          setQuery(requestedSearch)
        } else if (requestedSetId === MCDONALDS_SERIES || (setRows || []).some(set => set.id === requestedSetId)) {
          setSetId(requestedSetId)
        }
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
    if (!zoomedCard && !seriesPickerOpen && !ownershipCardId) return
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setZoomedCard(null)
        setSeriesPickerOpen(false)
        setOwnershipCardId(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [zoomedCard, seriesPickerOpen, ownershipCardId])

  useEffect(() => {
    if (!seriesPickerOpen) return
    const closeOnOutsideClick = event => {
      if (!seriesPickerRef.current?.contains(event.target)) setSeriesPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [seriesPickerOpen])

  useEffect(() => {
    if (!ownershipCardId) return
    const closeOnOutsideClick = event => {
      if (!ownershipInfoRef.current?.contains(event.target)) setOwnershipCardId(null)
    }
    const closeOnViewportMove = () => setOwnershipCardId(null)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('scroll', closeOnViewportMove, true)
    window.addEventListener('resize', closeOnViewportMove)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('scroll', closeOnViewportMove, true)
      window.removeEventListener('resize', closeOnViewportMove)
    }
  }, [ownershipCardId])

  useEffect(() => {
    if (!setId) {
      setCards([])
      setCardImageCandidates({})
      setOwned({})
      setSelection({})
      setLoadingCards(false)
      return
    }
    if (setId === ALL_SERIES && !query.trim()) {
      setCards([])
      setCardImageCandidates({})
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
        const mcDonaldSetIds = sets.filter(isMcDonaldsSet).map(set => set.id)
        const setIds = setId === ALL_SERIES
          ? sets.map(set => set.id)
          : setId === MCDONALDS_SERIES ? mcDonaldSetIds : [setId]
        if (!setIds.length) return
        const term = query.trim().replace(/[%_]/g, '\\$&')
        let cardRows = []
        if (setId === ALL_SERIES && term) {
          const pattern = '%' + term + '%'
          const searches = [
            fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).ilike('card_name', pattern).order('guide_order', { ascending: true }).order('collector_number', { ascending: true })),
            fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).ilike('collector_number', pattern).order('guide_order', { ascending: true }).order('collector_number', { ascending: true }))
          ]
          const normalizedTerm = normalizedSearchText(term)
          if (['energie', 'energy', 'plante', 'grass', 'feu', 'fire', 'eau', 'water', 'electri', 'lightning', 'foudre', 'psy', 'psychic', 'combat', 'fighting', 'obscurite', 'darkness', 'metal', 'incolore', 'colorless', 'gold', 'dore'].some(alias => normalizedTerm.includes(alias))) {
            searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).eq('card_type', 'Énergie').order('guide_order', { ascending: true }).order('collector_number', { ascending: true })))
          }
          if (normalizedTerm.includes('gold') || normalizedTerm.includes('dore')) {
            searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).eq('card_type', 'Énergie').ilike('rarity_label', '%Hyper rare%').order('guide_order', { ascending: true }).order('collector_number', { ascending: true })))
          }
          const yearSearch = normalizedTerm.match(/^(20\d{2})$/)?.[1]
          if (yearSearch) {
            const carriedVisualSetCodes = yearSearch === '2018' ? ['uen17'] : yearSearch === '2021' ? ['uen20'] : []
            const energyYearSetIds = sets.filter(set =>
              String(set.release_date || '').startsWith(yearSearch)
                || carriedVisualSetCodes.includes(set.set_code)
                || (yearSearch === '2024' && set.set_code === 'sve')
            ).map(set => set.id)
            if (energyYearSetIds.length) {
              searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', energyYearSetIds)
                .eq('card_type', 'Énergie').order('guide_order', { ascending: true }).order('collector_number', { ascending: true })))
            }
          }
          const results = await Promise.all(searches)
          const failed = results.find(result => result.error)
          if (failed) throw failed.error
          cardRows = [...new Map(results.flatMap(result => result.data || []).map(card => [card.id, card])).values()]
          if (yearSearch) {
            cardRows = cardRows.filter(card => {
              if (card.card_type !== 'Énergie') return false
              const releaseYear = String(relatedSet(card)?.release_date || '').slice(0, 4)
              const hasPrintYear = (card.card_print_variants || []).some(variant => Number(variant.copyright_year) === Number(yearSearch))
              return releaseYear === yearSearch || hasPrintYear
            })
          }
          if (isEnergySearch(term) || yearSearch) {
            cardRows.sort((left, right) => {
              const leftSet = relatedSet(left)
              const rightSet = relatedSet(right)
              const dateOrder = String(leftSet?.release_date || '').localeCompare(String(rightSet?.release_date || ''))
              if (dateOrder) return dateOrder
              const nameOrder = seriesLabel(leftSet).localeCompare(seriesLabel(rightSet), 'fr')
              return nameOrder || String(left.collector_number || '').localeCompare(String(right.collector_number || ''), 'fr', { numeric: true })
            })
          }
        } else {
          const { data: rows, error: loadError } = await fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
            .order('guide_order', { ascending: true }).order('collector_number', { ascending: true }))
          if (loadError) throw loadError
          cardRows = rows || []
        }
        if (cancelled) return
        const mcDonaldCards = cardRows.filter(card => isMcDonaldsSet(relatedSet(card)))
        const imageCandidates = {}
        const printYearSearch = normalizedSearchText(term).match(/^(20\d{2})$/)?.[1]
        if (printYearSearch) {
          for (const card of cardRows) {
            const printImage = (card.card_print_variants || []).find(variant =>
              Number(variant.copyright_year) === Number(printYearSearch) && variant.image_url
            )?.image_url
            if (printImage) imageCandidates[card.id] = [printImage, card.image_url].filter(Boolean)
          }
        }
        if (mcDonaldCards.length) {
          const searchNames = Array.from(new Set(mcDonaldCards.flatMap(card => {
            const name = card.card_name || ''
            return [name, name.replace(/[’‘`´]/g, "'") , name.replace(/'/g, '’')]
          })))
          const matchingCards = []
          try {
            for (let offset = 0; offset < searchNames.length; offset += 50) {
              const { data, error: imageLoadError } = await fetchAllRows(() => supabase.from('cards')
                .select('card_name,image_url,card_sets!cards_card_set_id_fkey(set_name)')
                .in('card_name', searchNames.slice(offset, offset + 50))
                .not('image_url', 'is', null))
              if (!imageLoadError) matchingCards.push(...(data || []))
            }
          } catch {
            // The catalog stays usable when an optional cross-set image lookup is unavailable.
          }
          const matchingImagesByName = new Map()
          for (const candidate of matchingCards) {
            const candidateSet = Array.isArray(candidate.card_sets) ? candidate.card_sets[0] : candidate.card_sets
            if (!candidate.image_url || isMcDonaldsSet(candidateSet)) continue
            const name = normalizedCardName(candidate.card_name)
            if (!name) continue
            const current = matchingImagesByName.get(name) || []
            if (!current.includes(candidate.image_url)) current.push(candidate.image_url)
            matchingImagesByName.set(name, current)
          }
          for (const card of mcDonaldCards) {
            const set = relatedSet(card)
            imageCandidates[card.id] = mcdonaldsCardImageCandidates(card, set, matchingImagesByName.get(normalizedCardName(card.card_name)) || [])
          }
        }
        const variantIds = Array.from(new Set(cardRows.flatMap(card => (card.card_print_variants || []).map(variant => variant.id))))
        let copyRows = []
        if (profileId && variantIds.length) {
          // Keep the URL for each PostgREST .in() request short enough for mobile networks and proxies.
          for (let offset = 0; offset < variantIds.length; offset += 100) {
            const variantBatch = variantIds.slice(offset, offset + 100)
            const { data, error: copyError } = await fetchAllRows(() => supabase.from('collection_cards')
              .select('id,card_print_variant_id,ownership_type,grade,grade_label,created_at')
              .eq('collection_profile_id', profileId).in('card_print_variant_id', variantBatch)
              .order('created_at', { ascending: false }))
            if (copyError) throw copyError
            copyRows.push(...(data || []))
          }
        }
        const ownership = {}
        for (const copy of copyRows) {
          if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
          ownership[copy.card_print_variant_id].push(copy)
        }
        if (!cancelled) { setCardImageCandidates(imageCandidates); setCards(cardRows); setOwned(ownership) }
      } catch {
        if (!cancelled) setError('Impossible de charger les cartes de cette série. Réessaie dans un instant.')
      } finally {
        if (!cancelled) setLoadingCards(false)
      }
    }, setId === ALL_SERIES ? 250 : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [supabase, setId, query, profileId, sets])

  const filteredSets = sets.filter(set => !isDedicatedEnergySet(set)
    && normalizedSearchText([seriesLabel(set), set.series_name, set.set_name, set.set_code, set.release_date?.slice(0, 4)].join(' ')).includes(normalizedSearchText(seriesPickerQuery.trim())))
  const selectedSet = setId === MCDONALDS_SERIES
    ? { id: MCDONALDS_SERIES, set_code: 'MCD', set_name: 'McDonald’s · toutes les années', series_name: 'Collection McDonald’s' }
    : sets.find(set => set.id === setId)
  const selectedMcDonaldsSet = setId === MCDONALDS_SERIES
  const visibleCards = cards.filter(card => {
    const term = normalizedSearchText(filterQuery.trim() || (setId === ALL_SERIES ? query.trim() : ''))
    const set = relatedSet(card)
    const variantText = (card.card_print_variants || []).map(variant => variant.variant_label || variant.variant_key).join(' ')
    const searchText = normalizedSearchText([
      card.collector_number, card.card_name, card.card_type, card.rarity_label, variantText,
      energyElementSearchTerms(card), card.card_type === 'Énergie' ? 'energy energie' : '',
      set?.set_name, isGoldEnergy(card) ? 'Gold dorée' : ''
    ].join(' '))
    return !term || term.split(/\s+/).every(token => searchText.includes(token))
  })
  const selectedRows = Object.entries(selection).filter(([, qty]) => Number(qty) > 0)
  const selectedCopies = selectedRows.reduce((sum, [, qty]) => sum + Number(qty || 0), 0)

  function selectProfile(nextId) {
    setProfileId(nextId)
    setSelection({})
    setNotice('')
    setOwnershipCardId(null)
    setRemovedCopies([])
    setOwnershipNotice('')
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

  async function removeOneCopy(variant, card) {
    if (!user || !profileId || saving || removingCopyId) return
    const copy = (owned[variant.id] || []).find(entry => entry.ownership_type === 'raw')
    if (!copy) return
    setRemovingCopyId(copy.id)
    setOwnershipNotice('')
    try {
      const { data: deletedCopy, error: deleteError } = await supabase.from('collection_cards')
        .delete()
        .eq('id', copy.id)
        .eq('user_id', user.id)
        .eq('collection_profile_id', profileId)
        .eq('card_print_variant_id', variant.id)
        .select('*')
        .single()
      if (deleteError) throw deleteError
      setOwned(current => ({
        ...current,
        [variant.id]: (current[variant.id] || []).filter(entry => entry.id !== deletedCopy.id)
      }))
      setRemovedCopies(current => [...current, {
        row: deletedCopy,
        cardName: card.card_name,
        variantLabel: variant.variant_label,
        profileId
      }])
    } catch (removeError) {
      setOwnershipNotice('Impossible de retirer cette carte : ' + (removeError.message || 'réessaie.'))
    } finally {
      setRemovingCopyId('')
    }
  }

  async function undoLastRemovedCopy() {
    const removed = removedCopies[removedCopies.length - 1]
    if (!removed || removed.profileId !== profileId || saving || removingCopyId) return
    setSaving(true)
    setOwnershipNotice('')
    try {
      const { data: restoredCopy, error: restoreError } = await supabase.from('collection_cards')
        .insert(removed.row)
        .select('*')
        .single()
      if (restoreError) throw restoreError
      setOwned(current => ({
        ...current,
        [restoredCopy.card_print_variant_id]: [...(current[restoredCopy.card_print_variant_id] || []), restoredCopy]
      }))
      setRemovedCopies(current => current.slice(0, -1))
    } catch (restoreError) {
      setOwnershipNotice('Impossible d’annuler : ' + (restoreError.message || 'réessaie.'))
    } finally {
      setSaving(false)
    }
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
        <div className={styles.seriesField}>
          <span>Série</span>
          <div className={styles.seriesPicker} ref={seriesPickerRef}>
            <button type="button" className={styles.seriesPickerTrigger} aria-haspopup="dialog" aria-expanded={seriesPickerOpen} disabled={loadingSets} onClick={() => setSeriesPickerOpen(open => !open)}>
              <span>{selectedSet ? seriesLabel(selectedSet) : setId === ALL_SERIES ? isEnergySearch(query) ? 'Énergies · toutes les séries' : 'Toutes les séries · rechercher' : 'Choisir une série…'}</span>
              <span className={styles.seriesPickerChevron} aria-hidden="true">▾</span>
            </button>
            {seriesPickerOpen && <div className={styles.seriesPickerOptions} role="dialog" aria-label="Séries du catalogue">
              <label className={styles.seriesPickerSearch}><span>Rechercher une série</span><input type="search" value={seriesPickerQuery} onChange={event => setSeriesPickerQuery(event.target.value)} placeholder="Nom, code ou année…" autoFocus /></label>
              <button type="button" role="button" aria-pressed={!setId} className={styles.seriesPickerOption} onClick={() => { setSetId(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Choisir une série…</button>
              <button type="button" role="button" aria-pressed={setId === ALL_SERIES && !isEnergySearch(query)} className={setId === ALL_SERIES && !isEnergySearch(query) ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(ALL_SERIES); setQuery(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Toutes les séries · rechercher</button>
              <button type="button" role="button" aria-pressed={setId === ALL_SERIES && isEnergySearch(query)} className={setId === ALL_SERIES && isEnergySearch(query) ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(ALL_SERIES); setQuery('Énergie'); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Énergies · toutes les séries</button>
              <button type="button" role="button" aria-pressed={selectedMcDonaldsSet} className={selectedMcDonaldsSet ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(MCDONALDS_SERIES); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>McDonald’s · toutes les années</button>
              {filteredSets.map(set => <button type="button" role="button" aria-pressed={setId === set.id} className={setId === set.id ? styles.seriesPickerOptionActive : styles.seriesPickerOption} key={set.id} onClick={() => { setSetId(set.id); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>{isMcDonaldsSet(set) ? 'McDonald’s · ' + (set.release_date ? new Date(set.release_date + 'T00:00:00').getFullYear() : set.set_name.match(/20\d{2}/)?.[0] || set.set_name) + ' — ' + set.set_name : seriesLabel(set)}</button>)}
            </div>}
          </div>
        </div>
        {setId === ALL_SERIES && <label className={styles.searchField}>
          <span>Nom, numéro ou finition</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pikachu, 257, Gold" />
        </label>}
        {selectedSet && <label className={styles.searchField}>
          <span>{selectedMcDonaldsSet ? 'Filtrer les éditions McDonald’s' : 'Filtrer cette série'}</span>
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
        <a href={selectedMcDonaldsSet
          ? '/collection/classeurs?set=mcdonalds'
          : '/collection/cartes?set=' + encodeURIComponent(setId) + '&collection=owned'}>{selectedMcDonaldsSet ? 'Voir mon classeur McDonald’s →' : 'Voir mes cartes de cette série →'}</a>
      </div>}

      {cards.length > 0 && !loadingCards && (
        <section className={styles.checklist} aria-label={selectedSet ? 'Liste des cartes de ' + seriesLabel(selectedSet) : 'Résultats de recherche'}>
          {!visibleCards.length && <p className={styles.hint}>Aucune carte ne correspond à ce filtre.</p>}
          {visibleCards.map((card, index) => {
            const yearSearch = normalizedSearchText(query).match(/^(20\d{2})$/)?.[1]
            const yearVariants = yearSearch
              ? (card.card_print_variants || []).filter(variant => variant.is_master_set_target && Number(variant.copyright_year) === Number(yearSearch))
              : []
            const copyrightYearVariant = yearVariants.find(variant => variant.image_url) || yearVariants[0] || null
            const variants = (card.card_print_variants || []).filter(variant => variant.is_master_set_target
              && (!yearSearch || Number(variant.copyright_year) === Number(yearSearch) || String(relatedSet(card)?.release_date || '').startsWith(yearSearch)))
            const set = relatedSet(card)
            const previousSet = index ? relatedSet(visibleCards[index - 1]) : null
            const showEnergyGroup = setId === ALL_SERIES && (isEnergySearch(query) || /^20\d{2}$/.test(normalizedSearchText(query))) && set?.id !== previousSet?.id
            const storedImageCandidates = cardImageCandidates[card.id] || (card.image_url ? [card.image_url] : [])
            const imageCandidates = copyrightYearVariant?.image_url
              ? [copyrightYearVariant.image_url, ...storedImageCandidates].filter((url, index, values) => values.indexOf(url) === index)
              : storedImageCandidates
            const imageUrl = imageCandidates[0] || ''
            const ownedVariants = variants.map(variant => ({
              variant,
              copies: owned[variant.id] || []
            })).filter(entry => entry.copies.length > 0)
            return <Fragment key={card.id}>
              {showEnergyGroup && <h2 className={styles.energyGroupHeading}>{seriesLabel(set)}{copyrightYearVariant ? ' · tirage ©' + copyrightYearVariant.copyright_year + (copyrightYearVariant.guide_marker === 'play-pokemon-prize-pack-series-6' ? ' · Pack Récompense Série 6 (2025)' : '') : set?.release_date ? ' · ' + new Date(set.release_date + 'T00:00:00').getFullYear() : ''}</h2>}
              <article className={`${styles.cardRow} ${ownershipCardId === card.id ? styles.cardRowWithOwnership : ''}`}>
              <button className={styles.thumbButton} type="button" onClick={() => setZoomedCard(card)} aria-label={'Voir l’image de ' + card.card_name}>
                {imageUrl ? <img src={imageUrl} alt={card.card_name} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index < 4 ? 'high' : 'auto'} onError={event => advanceCardImage(event, imageCandidates)} /> : <span>Image indisponible</span>}
                <span className={styles.zoomIcon} aria-hidden="true">⌕</span>
              </button>
              <div className={styles.cardIdentity}>
                <span className={styles.cardNumber}>{setId === ALL_SERIES ? isEnergySearch(query) ? '' : seriesLabel(set) + ' · ' : selectedMcDonaldsSet ? set?.set_name + ' · ' : ''}{isUnnumberedEnergyCard(card) ? 'Sans numéro' : 'N° ' + card.collector_number}{card.card_type === 'Énergie' && (copyrightYearVariant || set?.release_date) ? copyrightYearVariant ? ' · ©' + copyrightYearVariant.copyright_year : ' · ' + new Date(set.release_date + 'T00:00:00').getFullYear() : ''}</span>
                <button type="button" className={styles.nameButton} onClick={() => setZoomedCard(card)}>{card.card_name}</button>
                <div className={styles.rarityRow}>
                  <span className={styles.rarity}>{isGoldEnergy(card) ? 'Gold · ' : ''}{card.rarity_label || 'Rareté non renseignée'}</span>
                  <span className={styles.ownershipInfo} ref={ownershipCardId === card.id ? ownershipInfoRef : null}>
                    <button
                      type="button"
                      className={styles.ownershipInfoButton}
                      aria-label={'Voir les exemplaires de ' + card.card_name + ' déjà dans ma collection'}
                      aria-expanded={ownershipCardId === card.id}
                      aria-controls={'ownership-info-' + card.id}
                      title="Voir ma collection pour cette carte"
                      onClick={event => {
                        if (ownershipCardId === card.id) {
                          setOwnershipCardId(null)
                          return
                        }
                        const rect = event.currentTarget.getBoundingClientRect()
                        const width = Math.max(0, Math.min(270, window.innerWidth - 24))
                        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
                        const below = rect.bottom + 8
                        const top = below + 220 <= window.innerHeight - 12
                          ? below
                          : Math.max(12, rect.top - 188)
                        const arrowLeft = Math.max(8, Math.min(rect.left + rect.width / 2 - left - 4, width - 18))
                        setOwnershipPopoverPosition({
                          position: 'fixed',
                          left: left + 'px',
                          top: top + 'px',
                          width: width + 'px',
                          '--ownership-arrow-left': arrowLeft + 'px'
                        })
                        setOwnershipCardId(card.id)
                      }}
                    >?</button>
                    {ownershipCardId === card.id && <div className={styles.ownershipPopover} style={ownershipPopoverPosition || undefined} id={'ownership-info-' + card.id} role="status">
                      <strong>Dans ma collection</strong>
                      {!user
                        ? <span className={styles.ownershipEmpty}>Connecte-toi pour voir tes exemplaires.</span>
                        : !profileId
                          ? <span className={styles.ownershipEmpty}>Aucune collection sélectionnée.</span>
                          : ownedVariants.length
                            ? <ul>{ownedVariants.map(({ variant, copies }) => {
                              const label = variant.variant_label === 'Carte (suivi de base)' ? 'Carte' : variant.variant_label
                              const removableCopies = copies.filter(copy => copy.ownership_type === 'raw')
                              const latestCopyId = removableCopies[0]?.id
                              return <li key={variant.id}>
                                <span>{label}</span>
                                <div className={styles.ownershipLineActions}>
                                  <b>{copies.length} exemplaire{copies.length > 1 ? 's' : ''}</b>
                                  <button
                                    type="button"
                                    className={styles.ownershipRemoveButton}
                                    aria-label={'Retirer un exemplaire de ' + label + ' pour ' + card.card_name}
                                    title={removableCopies.length ? 'Retirer un exemplaire non gradé' : 'Aucun exemplaire non gradé à retirer'}
                                    disabled={!latestCopyId || Boolean(removingCopyId) || saving}
                                    onClick={() => removeOneCopy(variant, card)}
                                  >{removingCopyId === latestCopyId ? '…' : '−'}</button>
                                </div>
                              </li>
                            })}</ul>
                            : <span className={styles.ownershipEmpty}>Aucun exemplaire de cette carte.</span>}
                      {profileId && <small>{profiles.find(profile => profile.id === profileId)?.display_name || 'Collection sélectionnée'}</small>}
                      {ownershipNotice && <span className={styles.ownershipActionNotice} role="alert">{ownershipNotice}</span>}
                      {removedCopies.length > 0 && removedCopies[removedCopies.length - 1].profileId === profileId && (
                        <div className={styles.ownershipUndo}>
                          <span>{removedCopies[removedCopies.length - 1].variantLabel} retirée · {removedCopies[removedCopies.length - 1].cardName}</span>
                          <button type="button" onClick={undoLastRemovedCopy} disabled={saving || Boolean(removingCopyId)}>Annuler</button>
                        </div>
                      )}
                    </div>}
                  </span>
                </div>
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
                      <input type="number" min="1" max="99" inputMode="numeric" value={quantity} onFocus={event => event.currentTarget.select()} onChange={event => setSelection(current => ({ ...current, [variant.id]: event.target.value }))} aria-label={'Quantité de ' + card.card_name + ' ' + label} />
                    </label>}
                  </div>
                })}
              </div>
            </article>
            </Fragment>
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
          <img src={cardImageCandidates[zoomedCard.id]?.[0] || zoomedCard.image_url} alt={zoomedCard.card_name} onError={event => advanceCardImage(event, cardImageCandidates[zoomedCard.id] || [zoomedCard.image_url].filter(Boolean))} />
          <p>{zoomedCard.card_name} · {zoomedCard.collector_number}</p>
        </div>
      </div>}
    </main>
  )
}
