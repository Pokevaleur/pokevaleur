'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import CardProvenanceButton from '../../components/card-provenance'
import styles from './page.module.css'

const ALL_SERIES = '__all_series__'
const MCDONALDS_SERIES = '__mcdonalds_series__'
const PACK_REWARD_PREFIX = '__pack_reward__:'
const ZENITH_MAIN_SET_CODE = 'swsh12.5'
const ZENITH_GALLERY_SET_CODE = 'swsh12.5gg'
const DEDICATED_ENERGY_SET_CODES = new Set(['sve', 'uen17', 'uen19', 'uen20', 'uen22', 'sme17', 'sme19', 'mee', 'mee30', 'sv10.5e'])
const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,card_type,element_types,rarity_label,image_url,source_url,image_source_url,guide_order,card_sets!cards_card_set_id_fkey(id,series_name,set_name,set_code,language,release_date),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target,copyright_year,image_url,image_source_url)'
const MCDONALDS_PTCG_IMAGE_YEARS = new Set(['2011', '2012', '2014', '2015', '2016', '2017', '2021', '2022'])

function normalizedCardName(name) {
  return String(name || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function mcdonaldsCardImageCandidates(card, set) {
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
    hasUnavailableTcgdexPath ? originalImage : null
  ].filter(Boolean)
  return [...new Set(candidates)]
}

function mewRgbPokepediaImage(card, set) {
  const setCode = String(set?.set_code || '').toLowerCase()
  const number = String(card?.collector_number || '').toUpperCase()
  if (setCode !== '30c' || String(card?.card_name || '').toLowerCase() !== 'mew') return null
  const images = {
    'G/RGB': 'https://www.pokepedia.fr/images/b/b8/Carte_30e_Anniversaire_G.png',
    'R/RGB': 'https://www.pokepedia.fr/images/3/38/Carte_30e_Anniversaire_R.png',
    'B/RGB': 'https://www.pokepedia.fr/images/6/61/Carte_30e_Anniversaire_B.png'
  }
  return images[number] || null
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
  sm9: 'SL09',
  smp: 'SM',
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
  const setName = code === 'smp' && set?.language === 'FR'
    ? 'Promos Soleil et Lune'
    : set?.set_name || 'Série'
  const displayCode = set?.language && set.language !== 'FR'
    ? rawCode.toUpperCase()
    : FRENCH_SET_CODES[code] || (/^sv\d/i.test(rawCode) ? 'EV' + rawCode.slice(2).toUpperCase() : rawCode.toUpperCase())
  return (displayCode ? displayCode + ' — ' : '') + setName
}

function isZenithGallerySet(set) {
  return String(set?.set_code || '').toLowerCase() === ZENITH_GALLERY_SET_CODE
}

function relatedSet(card) {
  return Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
}

function isPackRewardSelection(id) {
  return String(id || '').startsWith(PACK_REWARD_PREFIX)
}

function isPlayStampVariant(variant) {
  return /play|reward|prize/i.test([variant?.variant_key, variant?.variant_label, variant?.guide_marker].join(' '))
}

function formatCatalogPrice(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

function priceDetailsText(price) {
  const basisLabels = {
    avg30: 'moyenne Cardmarket sur 30 jours',
    'avg30-holo': 'moyenne Cardmarket holographique sur 30 jours',
    avg7: 'moyenne Cardmarket sur 7 jours',
    'avg7-holo': 'moyenne Cardmarket sur 7 jours',
    avg: 'prix moyen Cardmarket',
    'avg-holo': 'prix moyen Cardmarket',
    trend: 'tendance Cardmarket',
    'trend-holo': 'tendance Cardmarket',
    marketPrice: 'prix de marché TCGplayer',
    midPrice: 'prix médian TCGplayer'
  }
  const updated = price?.observedAt && !Number.isNaN(Date.parse(price.observedAt))
    ? 'données du ' + new Date(price.observedAt).toLocaleDateString('fr-FR')
    : ''
  const converted = price?.exchange?.date
    ? 'conversion du ' + new Date(price.exchange.date + 'T00:00:00').toLocaleDateString('fr-FR')
    : ''
  return [price?.source, basisLabels[price?.basis] || price?.basis, updated, converted].filter(Boolean).join(' · ')
}

function observedSalesDetailsText(sales) {
  if (!sales) return ''
  const saleLabel = sales.count === 1 ? 'Médiane · 1 vente confirmée sur 30 jours' : 'Médiane · ' + sales.count + ' ventes confirmées sur 30 jours'
  const formatDate = value => value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
    : ''
  const firstDate = formatDate(sales.earliestObservedAt)
  const lastDate = formatDate(sales.latestObservedAt)
  const dateLabel = firstDate && lastDate
    ? firstDate === lastDate ? 'vente du ' + firstDate : 'ventes du ' + firstDate + ' au ' + lastDate
    : firstDate || lastDate
  return [saleLabel, ...(sales.sources || []), dateLabel].filter(Boolean).join(' · ')
}

function isGoldEnergy(card) {
  return card?.card_type === 'Énergie' && /hyper rare/i.test(card?.rarity_label || '')
}

function isUnnumberedEnergyCard(card) {
  return card?.card_type === 'Énergie' && /^UEN-/i.test(String(card?.collector_number || ''))
}

function energyVariantCopyrightYear(card, variant) {
  const copyrightYear = Number(variant?.copyright_year)
  if (copyrightYear) return copyrightYear

  const setCode = String(relatedSet(card)?.set_code || '').toLowerCase()
  const collectorNumber = Number(String(card?.collector_number || '').replace(/^0+/, ''))
  if (setCode === 'sve' && variant?.variant_key === 'catalog_base' && collectorNumber >= 9 && collectorNumber <= 16) return 2024

  return Number(String(relatedSet(card)?.release_date || '').slice(0, 4)) || null
}

function energyPrintYearGroups(cards) {
  const groups = new Map()
  for (const card of cards) {
    const releaseYear = String(relatedSet(card)?.release_date || '').slice(0, 4)
    const variants = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
    const byYear = new Map()
    for (const variant of variants) {
      const year = energyVariantCopyrightYear(card, variant) || Number(releaseYear)
      if (!year) continue
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push(variant)
    }
    if (!byYear.size && releaseYear) byYear.set(Number(releaseYear), [])
    for (const [year, yearVariants] of byYear) {
      if (!groups.has(year)) groups.set(year, [])
      groups.get(year).push({ card, variants: yearVariants })
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, entries]) => ({
      year,
      entries: entries.sort((left, right) => {
        const leftSet = relatedSet(left.card)
        const rightSet = relatedSet(right.card)
        const dateOrder = String(rightSet?.release_date || '').localeCompare(String(leftSet?.release_date || ''))
        if (dateOrder) return dateOrder
        const setOrder = seriesLabel(leftSet).localeCompare(seriesLabel(rightSet), 'fr')
        return setOrder || String(left.card.collector_number || '').localeCompare(String(right.card.collector_number || ''), 'fr', { numeric: true })
      })
    }))
}

function isEnergySearch(value) {
  return ['energie', 'energy', 'plante', 'grass', 'feu', 'fire', 'eau', 'water', 'electri', 'lightning', 'foudre', 'psy', 'psychic', 'combat', 'fighting', 'obscurite', 'darkness', 'metal', 'incolore', 'colorless', 'gold', 'dore']
    .some(alias => normalizedSearchText(value).includes(alias))
}

function normalizedSearchText(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function accentInsensitiveNamePattern(value) {
  const normalized = normalizedSearchText(value)
  if (!normalized || !/[aeiouyc]/.test(normalized)) return null

  const pattern = [...normalized].map(character => {
    if (/[aeiouyc]/.test(character)) return '_'
    if (character === '%' || character === '_' || character === '\\') return '\\' + character
    return character
  }).join('')

  return '%' + pattern + '%'
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
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [sets, setSets] = useState([])
  const [rewardProducts, setRewardProducts] = useState([])
  const [foreignSets, setForeignSets] = useState([])
  const [foreignSetId, setForeignSetId] = useState('')
  const [loadingForeignSets, setLoadingForeignSets] = useState(false)
  const [setId, setSetId] = useState('')
  const [query, setQuery] = useState('')
  const [languageCode, setLanguageCode] = useState('FR')
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
  const [showPrices, setShowPrices] = useState(false)
  const [marketPrices, setMarketPrices] = useState({})
  const [marketPricesLoading, setMarketPricesLoading] = useState(false)
  const [marketPricesError, setMarketPricesError] = useState('')
  const [ownershipCardId, setOwnershipCardId] = useState(null)
  const [ownershipPopoverPosition, setOwnershipPopoverPosition] = useState(null)
  const [removingCopyId, setRemovingCopyId] = useState('')
  const [removedCopies, setRemovedCopies] = useState([])
  const [ownershipNotice, setOwnershipNotice] = useState('')
  const ownershipInfoRef = useRef(null)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const [seriesPickerQuery, setSeriesPickerQuery] = useState('')
  const seriesPickerRef = useRef(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const updateScrollTopVisibility = () => {
      const shouldShow = window.scrollY > 480
      setShowScrollTop(current => current === shouldShow ? current : shouldShow)
    }
    updateScrollTopVisibility()
    window.addEventListener('scroll', updateScrollTopVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollTopVisibility)
  }, [])

  useEffect(() => {
    const returnHomeOnBack = event => {
      event.stopImmediatePropagation()
      router.replace('/')
    }
    window.history.pushState({ ...(window.history.state || {}), pokevaleurCatalogueBack: true }, '', window.location.href)
    window.addEventListener('popstate', returnHomeOnBack, true)
    return () => window.removeEventListener('popstate', returnHomeOnBack, true)
  }, [router])

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const [{ data: setRows, error: setLoadError }, { data: rewardRows }, { data: { user: signedInUser } }] = await Promise.all([
        supabase.from('card_sets').select('id,series_name,set_name,set_code,language,release_date,advertised_card_count,checklist_scope_note')
          .eq('is_public', true).eq('language', 'FR').order('release_date', { ascending: false }).order('set_name'),
        supabase.from('products').select('id,name,product_type,series,release_date')
          .eq('is_public', true).eq('product_type', 'Pack Récompense').eq('series', 'Play! Pokémon')
          .order('name'),
        supabase.auth.getUser()
      ])
      if (cancelled) return
      if (setLoadError) setError('Le catalogue de cartes ne peut pas être chargé pour le moment.')
      else {
        setSets(setRows || [])
        setRewardProducts(rewardRows || [])
        const searchParams = new URLSearchParams(window.location.search)
        const requestedSetId = searchParams.get('set')
        const requestedSearch = searchParams.get('search')
        const zenithMainSet = (setRows || []).find(set => String(set.set_code || '').toLowerCase() === ZENITH_MAIN_SET_CODE)
        const zenithGallerySet = (setRows || []).find(isZenithGallerySet)
        if (requestedSearch) {
          setSetId(ALL_SERIES)
          setQuery(requestedSearch)
        } else if (requestedSetId && requestedSetId === zenithGallerySet?.id && zenithMainSet) {
          // Keep older direct links working, but open the combined Zénith Suprême view.
          setSetId(zenithMainSet.id)
        } else if (requestedSetId === MCDONALDS_SERIES || (setRows || []).some(set => set.id === requestedSetId)) {
          setSetId(requestedSetId)
        } else {
          setSetId(ALL_SERIES)
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
    setForeignSetId('')
    setForeignSets([])
    if (languageCode === 'FR') {
      setLoadingForeignSets(false)
      return
    }
    let cancelled = false
    setLoadingForeignSets(true)
    async function loadForeignSets() {
      const [{ data, error: loadError }, { data: nativeRows, error: nativeError }] = await Promise.all([
        fetchAllRows(() => supabase.from('foreign_card_sets')
          .select('id,catalog_set_id,language_code,market_code,series_name,series_name_fr,set_name,set_code,release_date,validation_status')
          .eq('language_code', languageCode)
          .eq('validation_status', 'verified')
          .order('release_date', { ascending: false })
          .order('set_name')),
        fetchAllRows(() => supabase.from('card_sets')
          .select('id,series_name,set_name,set_code,language,release_date,advertised_card_count,checklist_scope_note')
          .eq('language', languageCode).eq('is_public', true)
          .order('release_date', { ascending: false }).order('set_name'))
      ])
      if (cancelled) return
      if (loadError || nativeError) {
        setError('Les séries étrangères ne peuvent pas être chargées pour le moment.')
        setForeignSets([])
      } else {
        const nativeSets = (nativeRows || []).map(set => ({
          ...set,
          nativeCardSetId: set.id,
          is_native_set: true,
          language_code: set.language,
          market_code: languageCode === 'JP' ? 'JP' : languageCode
        }))
        setForeignSets([...(data || []), ...nativeSets].sort((left, right) =>
          String(right.release_date || '').localeCompare(String(left.release_date || ''))
          || String(left.set_name || '').localeCompare(String(right.set_name || ''), 'fr')
        ))
      }
      setLoadingForeignSets(false)
    }
    loadForeignSets().catch(() => {
      if (!cancelled) {
        setError('Les séries étrangères ne peuvent pas être chargées pour le moment.')
        setForeignSets([])
        setLoadingForeignSets(false)
      }
    })
    return () => { cancelled = true }
  }, [supabase, languageCode])

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
    if (setId === ALL_SERIES && !query.trim() && !foreignSetId) {
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
        const packRewardProductId = isPackRewardSelection(setId) ? setId.slice(PACK_REWARD_PREFIX.length) : ''
        const mcDonaldSetIds = sets.filter(isMcDonaldsSet).map(set => set.id)
        const zenithMainSet = sets.find(set => String(set.set_code || '').toLowerCase() === ZENITH_MAIN_SET_CODE)
        const zenithGallerySet = sets.find(isZenithGallerySet)
        const isZenithSelection = Boolean(zenithMainSet && setId === zenithMainSet.id)
        let packRewardCardIds = []
        if (packRewardProductId && languageCode === 'FR') {
          const { data: rewardContents, error: rewardError } = await fetchAllRows(() => supabase.from('product_contents')
            .select('card_id').eq('product_id', packRewardProductId).eq('content_role', 'possible').not('card_id', 'is', null))
          if (rewardError) throw rewardError
          packRewardCardIds = [...new Set((rewardContents || []).map(row => row.card_id).filter(Boolean))]
        }
        const setIds = isZenithSelection
          ? [zenithMainSet.id, zenithGallerySet?.id].filter(Boolean)
          : setId === ALL_SERIES
          ? sets.map(set => set.id)
          : setId === MCDONALDS_SERIES ? mcDonaldSetIds : packRewardProductId ? [] : [setId]
        if (!setIds.length && !packRewardCardIds.length) return
        const term = query.trim().replace(/[%_]/g, '\\$&')
        let cardRows = []
        if (packRewardProductId && languageCode === 'FR') {
          const { data: rewardCards, error: rewardCardsError } = await fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS)
            .in('id', packRewardCardIds).order('guide_order', { ascending: true }).order('collector_number', { ascending: true }))
          if (rewardCardsError) throw rewardCardsError
          cardRows = (rewardCards || []).map(card => ({
            ...card,
            card_print_variants: (card.card_print_variants || []).filter(isPlayStampVariant)
          }))
        } else if (languageCode !== 'FR' && (term || foreignSetId)) {
          const { data: mappings, error: mappingError } = await fetchAllRows(() => {
            let request = supabase.from('foreign_card_printings')
              .select('id,catalog_card_id,collector_number,card_name,variant_keys,image_url,foreign_card_sets!inner(id,catalog_set_id,language_code,market_code,series_name,series_name_fr,set_name,set_code,release_date,validation_status)')
              .eq('foreign_card_sets.language_code', languageCode)
              .eq('foreign_card_sets.validation_status', 'verified')
              .eq('validation_status', 'verified')
            if (foreignSetId) request = request.eq('foreign_card_sets.id', foreignSetId)
            return request
          })
          if (mappingError) throw mappingError
          const mappedCardIds = [...new Set((mappings || []).map(row => row.catalog_card_id).filter(Boolean))]
          if (mappedCardIds.length) {
            const { data: counterpartRows, error: counterpartError } = await fetchAllRows(() => supabase.from('cards')
              .select(CARD_FIELDS).in('id', mappedCardIds))
            if (counterpartError) throw counterpartError
            const counterpartById = new Map((counterpartRows || []).map(card => [card.id, card]))
            const searchTerms = normalizedSearchText(term).split(/\s+/).filter(Boolean)
            cardRows = (mappings || []).flatMap(mapping => {
              const counterpart = counterpartById.get(mapping.catalog_card_id)
              const foreignSet = Array.isArray(mapping.foreign_card_sets) ? mapping.foreign_card_sets[0] : mapping.foreign_card_sets
              if (!counterpart || !foreignSet) return []
              const searchable = normalizedSearchText([
                mapping.card_name, mapping.collector_number, foreignSet.series_name,
                foreignSet.series_name_fr, foreignSet.set_name, foreignSet.set_code,
                counterpart.card_name, counterpart.collector_number
              ].join(' '))
              if (searchTerms.length && !searchTerms.every(token => searchable.includes(token))) return []
              const allowedVariants = Array.isArray(mapping.variant_keys) ? mapping.variant_keys : []
              const variants = (counterpart.card_print_variants || []).filter(variant =>
                !allowedVariants.length || allowedVariants.includes(variant.variant_key))
              return [{
                ...counterpart,
                frenchCardName: counterpart.card_name,
                card_name: mapping.card_name,
                collector_number: mapping.collector_number,
                image_url: mapping.image_url || counterpart.image_url,
                foreignPrinting: { ...mapping, foreign_card_sets: foreignSet },
                card_print_variants: variants,
                card_sets: {
                  ...foreignSet,
                  language: foreignSet.language_code,
                  release_date: foreignSet.release_date || relatedSet(counterpart)?.release_date
                }
              }]
            })
          }
          if (!foreignSetId && term) {
            const nativeSetIds = foreignSets.filter(set => set.is_native_set).map(set => set.nativeCardSetId)
            if (nativeSetIds.length) {
              const pattern = '%' + term + '%'
              const [nameResult, numberResult] = await Promise.all([
                fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', nativeSetIds)
                  .ilike('card_name', pattern).order('guide_order', { ascending: true })),
                fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', nativeSetIds)
                  .ilike('collector_number', pattern).order('guide_order', { ascending: true }))
              ])
              if (nameResult.error) throw nameResult.error
              if (numberResult.error) throw numberResult.error
              const searchTerms = normalizedSearchText(term).split(/\s+/).filter(Boolean)
              const nativeCards = [...new Map([...(nameResult.data || []), ...(numberResult.data || [])].map(card => [card.id, card])).values()]
                .filter(card => {
                  const set = relatedSet(card)
                  const searchable = normalizedSearchText([card.card_name, card.collector_number, set?.set_name, set?.series_name, set?.set_code].join(' '))
                  return searchTerms.every(token => searchable.includes(token))
                })
              cardRows = [...cardRows, ...nativeCards]
            }
          }
          cardRows.sort((left, right) => String(left.collector_number || '').localeCompare(String(right.collector_number || ''), 'fr', { numeric: true }))
        } else if (setId === ALL_SERIES && term) {
          const pattern = '%' + term + '%'
          const searches = [
            fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).ilike('card_name', pattern).order('guide_order', { ascending: true }).order('collector_number', { ascending: true })),
            fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).ilike('collector_number', pattern).order('guide_order', { ascending: true }).order('collector_number', { ascending: true }))
          ]
          const accentNamePattern = accentInsensitiveNamePattern(term)
          if (accentNamePattern) {
            searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds).ilike('card_name', accentNamePattern).order('guide_order', { ascending: true }).order('collector_number', { ascending: true })))
          }
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
              const hasPrintYear = (card.card_print_variants || []).some(variant => variant.is_master_set_target && energyVariantCopyrightYear(card, variant) === Number(yearSearch))
              return releaseYear === yearSearch || hasPrintYear
            })
          }
          if (isEnergySearch(term) || yearSearch) {
            cardRows.sort((left, right) => {
              const leftSet = relatedSet(left)
              const rightSet = relatedSet(right)
              const dateOrder = String(rightSet?.release_date || '').localeCompare(String(leftSet?.release_date || ''))
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
        if (isZenithSelection && languageCode === 'FR') {
          // Present the 159-card main checklist first, followed by GG01–GG70.
          cardRows.sort((left, right) => {
            const leftIsGallery = isZenithGallerySet(relatedSet(left))
            const rightIsGallery = isZenithGallerySet(relatedSet(right))
            if (leftIsGallery !== rightIsGallery) return leftIsGallery ? 1 : -1
            return String(left.collector_number || '').localeCompare(String(right.collector_number || ''), 'fr', { numeric: true })
          })
        }
        if (cancelled) return
        const mcDonaldCards = cardRows.filter(card => isMcDonaldsSet(relatedSet(card)))
        const imageCandidates = {}
        const rewardSeriesNumber = String(rewardProducts.find(product => product.id === packRewardProductId)?.name || '').match(/série\s*(\d+)/i)?.[1]
        for (const card of cardRows) {
          const pokepediaImage = mewRgbPokepediaImage(card, relatedSet(card))
          if (pokepediaImage) imageCandidates[card.id] = [pokepediaImage, card.image_url].filter(Boolean)
          if (packRewardProductId) {
            const stampVariants = (card.card_print_variants || [])
              .filter(variant => isPlayStampVariant(variant) && variant.image_url)
              .sort((left, right) => {
                const leftText = [left.variant_key, left.variant_label, left.guide_marker].join(' ')
                const rightText = [right.variant_key, right.variant_label, right.guide_marker].join(' ')
                const seriesPattern = rewardSeriesNumber ? new RegExp('(?:series|série|s)[ _-]*' + rewardSeriesNumber + '(?:\\D|$)', 'i') : null
                const leftExact = seriesPattern?.test(leftText) ? 1 : 0
                const rightExact = seriesPattern?.test(rightText) ? 1 : 0
                if (leftExact !== rightExact) return rightExact - leftExact
                const leftHolo = /holo|cosmos/i.test(leftText) ? 1 : 0
                const rightHolo = /holo|cosmos/i.test(rightText) ? 1 : 0
                return rightHolo - leftHolo
              })
            if (stampVariants.length) {
              imageCandidates[card.id] = [...new Set([...stampVariants.map(variant => variant.image_url), card.image_url].filter(Boolean))]
            }
          }
        }
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
          for (const card of mcDonaldCards) {
            const set = relatedSet(card)
            imageCandidates[card.id] = mcdonaldsCardImageCandidates(card, set)
          }
        }
        const variantIds = Array.from(new Set(cardRows.flatMap(card => (card.card_print_variants || []).map(variant => variant.id))))
        let copyRows = []
        if (profileId && variantIds.length) {
          // Keep the URL for each PostgREST .in() request short enough for mobile networks and proxies.
          for (let offset = 0; offset < variantIds.length; offset += 100) {
            const variantBatch = variantIds.slice(offset, offset + 100)
            let copyQuery = supabase.from('collection_cards')
              .select('id,card_print_variant_id,ownership_type,grade,grade_label,created_at,edition_language_code,edition_market_code,edition_set_name,edition_collector_number,edition_card_name')
              .eq('collection_profile_id', profileId).in('card_print_variant_id', variantBatch)
              .order('created_at', { ascending: false })
            copyQuery = languageCode === 'FR'
              ? copyQuery.or('edition_language_code.is.null,edition_language_code.eq.FR')
              : copyQuery.eq('edition_language_code', languageCode)
            const { data, error: copyError } = await fetchAllRows(() => copyQuery)
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
  }, [supabase, setId, query, profileId, sets, languageCode, foreignSetId, foreignSets])

  useEffect(() => {
    if (!showPrices || languageCode !== 'FR' || !cards.length) {
      setMarketPrices({})
      setMarketPricesLoading(false)
      setMarketPricesError('')
      return
    }

    let cancelled = false
    const controller = new AbortController()
    async function loadMarketPrices() {
      setMarketPrices({})
      setMarketPricesError('')
      setMarketPricesLoading(true)
      try {
        const nextPrices = {}
        for (let offset = 0; offset < cards.length; offset += 400) {
          const batch = cards.slice(offset, offset + 400)
          const response = await fetch('/api/card-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cards: batch.map(card => ({
              id: card.id,
              source_url: card.source_url,
              image_source_url: card.image_source_url,
              set_code: relatedSet(card)?.set_code,
              card_name: card.card_name,
              collector_number: card.collector_number,
              variants: (card.card_print_variants || []).map(variant => ({
                id: variant.id,
                finish_code: variant.finish_code
              }))
            })) }),
            signal: controller.signal
          })
          if (!response.ok) throw new Error('Les cotes sont indisponibles pour le moment.')
          const payload = await response.json()
          for (const price of payload.prices || []) nextPrices[price.cardId] = price
        }
        if (!cancelled) setMarketPrices(nextPrices)
      } catch (priceError) {
        if (!cancelled && priceError.name !== 'AbortError') {
          setMarketPricesError(priceError.message || 'Impossible de charger les cotes.')
        }
      } finally {
        if (!cancelled) setMarketPricesLoading(false)
      }
    }

    loadMarketPrices()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [showPrices, languageCode, cards])

  const filteredRewardProducts = rewardProducts.filter(product => normalizedSearchText([product.name, product.product_type, product.series, product.release_date].join(' ')).includes(normalizedSearchText(seriesPickerQuery.trim())))
  const filteredSets = sets.filter(set => !isDedicatedEnergySet(set) && !isZenithGallerySet(set)
    && normalizedSearchText([seriesLabel(set), set.series_name, set.set_name, set.set_code, set.release_date?.slice(0, 4)].join(' ')).includes(normalizedSearchText(seriesPickerQuery.trim())))
  const filteredForeignSets = foreignSets.filter(set => normalizedSearchText([set.set_name, set.series_name_fr, set.series_name, set.set_code, set.release_date?.slice(0, 4)].join(' ')).includes(normalizedSearchText(seriesPickerQuery.trim())))
  const zenithMainSet = sets.find(set => String(set.set_code || '').toLowerCase() === ZENITH_MAIN_SET_CODE)
  const selectedForeignSet = foreignSets.find(set => set.id === foreignSetId)
  const selectedNativeSet = foreignSets.find(set => set.is_native_set && set.nativeCardSetId === setId)
  const selectedSet = selectedForeignSet
    ? { ...selectedForeignSet, language: selectedForeignSet.language_code, set_name: selectedForeignSet.set_name || selectedForeignSet.series_name_fr || selectedForeignSet.series_name }
    : selectedNativeSet
    ? selectedNativeSet
    : setId === MCDONALDS_SERIES
    ? { id: MCDONALDS_SERIES, set_code: 'MCD', set_name: 'McDonald’s · toutes les années', series_name: 'Collection McDonald’s' }
    : isPackRewardSelection(setId)
    ? (() => { const product = rewardProducts.find(row => row.id === setId.slice(PACK_REWARD_PREFIX.length)); return product ? { id: setId, set_name: product.name, series_name: product.series } : null })()
    : setId === zenithMainSet?.id
      ? { ...zenithMainSet, set_name: (zenithMainSet.set_name || 'Zénith Suprême') + ' + Galerie Galaroise' }
      : sets.find(set => set.id === setId)
  const selectedMcDonaldsSet = setId === MCDONALDS_SERIES
  const visibleCards = cards.filter(card => {
    const term = normalizedSearchText(filterQuery.trim() || (setId === ALL_SERIES ? query.trim() : ''))
    const set = relatedSet(card)
    const variantText = (card.card_print_variants || []).map(variant => variant.variant_label || variant.variant_key).join(' ')
    const searchText = normalizedSearchText([
      card.collector_number, card.card_name, card.frenchCardName, card.card_type, card.rarity_label, variantText,
      energyElementSearchTerms(card), card.card_type === 'Énergie' ? 'energy energie' : '',
      set?.set_name, set?.series_name, set?.set_code, isGoldEnergy(card) ? 'Gold dorée' : ''
    ].join(' '))
    return !term || term.split(/\s+/).every(token => searchText.includes(token))
  })
  const groupedEnergyView = setId === ALL_SERIES && isEnergySearch(query)
  const energyGroups = groupedEnergyView ? energyPrintYearGroups(visibleCards) : []
  const checklistGroups = groupedEnergyView
    ? energyGroups
    : [{ year: null, entries: visibleCards.map(card => ({ card, variants: null })) }]
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
    const cardByVariantId = new Map(cards.flatMap(card => (card.card_print_variants || []).map(variant => [variant.id, card])))
    const rows = []
    for (const [variantId, rawQuantity] of selectedRows) {
      const variant = variantById.get(variantId)
      const selectedCard = cardByVariantId.get(variantId)
      const foreignPrinting = selectedCard?.foreignPrinting
      const foreignSet = foreignPrinting?.foreign_card_sets
      const nativeSet = relatedSet(selectedCard)
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(rawQuantity) || 1)))
      if (!variant || (!variant.is_master_set_target && !isPlayStampVariant(variant))) continue
      for (let index = 0; index < quantity; index++) rows.push({
        user_id: user.id,
        collection_profile_id: profileId,
        card_print_variant_id: variantId,
        ownership_type: 'raw',
        ...(foreignPrinting && foreignSet ? {
          edition_language_code: foreignSet.language_code,
          edition_market_code: foreignSet.market_code,
          edition_set_name: [foreignSet.series_name_fr || foreignSet.series_name, foreignSet.set_name, foreignSet.set_code].filter(Boolean).join(' — '),
          edition_collector_number: foreignPrinting.collector_number,
          edition_card_name: foreignPrinting.card_name
        } : nativeSet?.language && nativeSet.language !== 'FR' ? {
          edition_language_code: nativeSet.language,
          edition_market_code: nativeSet.language === 'JP' ? 'JP' : nativeSet.language,
          edition_set_name: [nativeSet.series_name, nativeSet.set_name, nativeSet.set_code].filter(Boolean).join(' — '),
          edition_collector_number: selectedCard.collector_number,
          edition_card_name: selectedCard.card_name
        } : {})
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
        <nav className={styles.sectionNav} aria-label="Pages du catalogue de cartes">
          <a href="/catalogue/cartes" aria-current="page">Catalogue des cartes</a>
          <a href="/catalogue/cartes/stats-series">Stats séries</a>
        </nav>
      </header>

      <section className={styles.selectionPanel} aria-label="Choix de la langue, de la série et de la collection">
        <label className={styles.languageField}>
          <span>Langue de l’impression possédée</span>
          <select value={languageCode} onChange={event => {
            const nextLanguage = event.target.value
            setLanguageCode(nextLanguage)
            setForeignSetId('')
            setQuery('')
            setSetId(ALL_SERIES)
            setFilterQuery('')
            setSelection({})
            setSeriesPickerOpen(false)
          }}>
            <option value="FR">Français</option>
            <option value="JP">Japonais</option>
            <option value="ZH-CN">Chinois simplifié</option>
            <option value="ZH-TW">Chinois traditionnel</option>
            <option value="EN">Anglais</option>
            <option value="KO">Coréen</option>
          </select>
        </label>
        <div className={styles.seriesField}>
          <span>Série</span>
          <div className={styles.seriesPicker} ref={seriesPickerRef}>
            <button type="button" className={styles.seriesPickerTrigger} aria-haspopup="dialog" aria-expanded={seriesPickerOpen} disabled={loadingSets || (languageCode !== 'FR' && loadingForeignSets)} onClick={() => setSeriesPickerOpen(open => !open)}>
              <span>{languageCode !== 'FR'
                ? selectedSet ? seriesLabel(selectedSet) : 'Toutes les séries · rechercher'
                : selectedSet ? seriesLabel(selectedSet) : setId === ALL_SERIES ? isEnergySearch(query) ? 'Énergies · toutes les séries' : 'Toutes les séries · rechercher' : 'Choisir une série…'}</span>
              <span className={styles.seriesPickerChevron} aria-hidden="true">▾</span>
            </button>
            {seriesPickerOpen && <div className={styles.seriesPickerOptions} role="dialog" aria-label="Séries du catalogue">
              <label className={styles.seriesPickerSearch}><span>Rechercher une série</span><input type="search" value={seriesPickerQuery} onChange={event => setSeriesPickerQuery(event.target.value)} placeholder="Nom, code ou année…" autoFocus /></label>
              {languageCode !== 'FR' ? <>
                <button type="button" aria-pressed={!foreignSetId && setId !== ALL_SERIES} className={styles.seriesPickerOption} onClick={() => { setForeignSetId(''); setSetId(''); setQuery(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Choisir une série…</button>
                <button type="button" aria-pressed={!foreignSetId && setId === ALL_SERIES} className={!foreignSetId && setId === ALL_SERIES ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setForeignSetId(''); setSetId(ALL_SERIES); setQuery(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Toutes les séries · rechercher</button>
                {filteredForeignSets.map(set => {
                  const isSelected = set.is_native_set ? setId === set.nativeCardSetId && !foreignSetId : foreignSetId === set.id
                  return <button type="button" aria-pressed={isSelected} className={isSelected ? styles.seriesPickerOptionActive : styles.seriesPickerOption} key={(set.is_native_set ? 'native-' : 'foreign-') + set.id} onClick={() => {
                    setForeignSetId(set.is_native_set ? '' : set.id)
                    setSetId(set.is_native_set ? set.nativeCardSetId : ALL_SERIES)
                    setQuery(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false)
                  }}>{(set.set_code ? set.set_code.toUpperCase() + ' — ' : '') + (set.set_name || set.series_name_fr || set.series_name || 'Série')}</button>
                })}
                {!loadingForeignSets && !filteredForeignSets.length && <p className={styles.seriesPickerEmpty}>{seriesPickerQuery ? 'Aucune série ne correspond.' : 'Aucune série disponible pour cette langue.'}</p>}
              </> : <>
                <button type="button" aria-pressed={!setId} className={styles.seriesPickerOption} onClick={() => { setSetId(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Choisir une série…</button>
                <button type="button" aria-pressed={setId === ALL_SERIES && !isEnergySearch(query)} className={setId === ALL_SERIES && !isEnergySearch(query) ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(ALL_SERIES); setQuery(''); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Toutes les séries · rechercher</button>
                <button type="button" aria-pressed={setId === ALL_SERIES && isEnergySearch(query)} className={setId === ALL_SERIES && isEnergySearch(query) ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(ALL_SERIES); setQuery('Énergie'); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>Énergies · toutes les séries</button>
                <button type="button" aria-pressed={selectedMcDonaldsSet} className={selectedMcDonaldsSet ? styles.seriesPickerOptionActive : styles.seriesPickerOption} onClick={() => { setSetId(MCDONALDS_SERIES); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>McDonald’s · toutes les années</button>
                {filteredRewardProducts.map(product => {
                  const productSetId = PACK_REWARD_PREFIX + product.id
                  const selected = setId === productSetId
                  return <button type="button" aria-pressed={selected} className={selected ? styles.seriesPickerOptionActive : styles.seriesPickerOption} key={product.id} onClick={() => { setSetId(productSetId); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>{product.name}</button>
                })}
                {filteredSets.map(set => <button type="button" aria-pressed={setId === set.id} className={setId === set.id ? styles.seriesPickerOptionActive : styles.seriesPickerOption} key={set.id} onClick={() => { setSetId(set.id); setFilterQuery(''); setSelection({}); setSeriesPickerQuery(''); setSeriesPickerOpen(false) }}>{isMcDonaldsSet(set) ? 'McDonald’s · ' + (set.release_date ? new Date(set.release_date + 'T00:00:00').getFullYear() : set.set_name.match(/20\d{2}/)?.[0] || set.set_name) + ' — ' + set.set_name : seriesLabel(set)}</button>)}
              </>}
            </div>}
          </div>
        </div>
        {setId === ALL_SERIES && !foreignSetId && <label className={styles.searchField}>
          <span>{languageCode === 'FR' ? 'Nom, numéro ou finition' : 'Nom, numéro ou série dans cette langue (ou nom français)'}</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pikachu, 257, Gold" />
        </label>}
        {selectedSet && <label className={styles.searchField}>
          <span>{selectedMcDonaldsSet ? 'Filtrer les éditions McDonald’s' : isPackRewardSelection(setId) ? 'Filtrer les cartes de ce Pack Récompense' : 'Filtrer cette série'}</span>
          <input type="search" value={filterQuery} onChange={event => { setFilterQuery(event.target.value); setSelection({}) }} placeholder="Numéro ou nom…" />
        </label>}
        {user && profiles.length > 0 && <label className={styles.profileField}>
          <span>Profil de collection</span>
          <select value={profileId} onChange={event => selectProfile(event.target.value)}>
            {profiles.map(profile => <option value={profile.id} key={profile.id}>{profile.display_name || (profile.profile_type === 'adult' ? 'Ma collection' : 'Collection')}</option>)}
          </select>
        </label>}
      </section>

      {error && <p className={styles.message} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {!setId && !loadingSets && <p className={styles.hint}>La liste apparaîtra dès que tu auras choisi une série.</p>}
      {setId === ALL_SERIES && !query.trim() && !foreignSetId && <p className={styles.hint}>{languageCode === 'FR' ? 'Saisis un nom pour rechercher dans toutes les séries.' : 'Saisis un nom ou un numéro pour rechercher dans les impressions ' + languageCode + ' vérifiées.'}</p>}
      {loadingCards && <p className={styles.hint} role="status">Chargement de la liste complète…</p>}

      {setId === ALL_SERIES && !foreignSetId && query.trim() && !loadingCards && !error && <p className={styles.searchResultCount} role="status">
        <strong>{visibleCards.length}</strong> carte{visibleCards.length === 1 ? '' : 's'} trouvée{visibleCards.length === 1 ? '' : 's'}
      </p>}

      {selectedSet && !loadingCards && !error && <div className={styles.setSummary}>
        <div><strong>{seriesLabel(selectedSet)}</strong><span>{visibleCards.length}{filterQuery ? ' résultat(s)' : ' cartes dans la liste du catalogue'}</span></div>
        {languageCode === 'FR' && !isPackRewardSelection(setId) && <a href={selectedMcDonaldsSet
          ? '/collection/classeurs?set=mcdonalds'
          : '/collection/cartes?set=' + encodeURIComponent(setId) + '&collection=owned'}>{selectedMcDonaldsSet ? 'Voir mon classeur McDonald’s →' : 'Voir mes cartes de cette série →'}</a>}
      </div>}

      {visibleCards.length > 0 && !loadingCards && languageCode === 'FR' && <label className={styles.priceToggle}>
        <input type="checkbox" checked={showPrices} onChange={event => setShowPrices(event.target.checked)} />
        <span>Afficher les cotes</span>
        {marketPricesLoading && <small role="status">Chargement…</small>}
      </label>}
      {marketPricesError && showPrices && <p className={styles.message} role="alert">{marketPricesError}</p>}

      {cards.length > 0 && !loadingCards && (
        <section className={styles.checklist} aria-label={selectedSet ? 'Liste des cartes de ' + seriesLabel(selectedSet) : 'Résultats de recherche'}>
          {!visibleCards.length && <p className={styles.hint}>Aucune carte ne correspond à ce filtre.</p>}
          {checklistGroups.map((group, groupIndex) => {
            const entries = group.entries.map(({ card, variants: yearGroupVariants }, index) => {
            const yearSearch = normalizedSearchText(query).match(/^(20\d{2})$/)?.[1]
            const yearVariants = yearGroupVariants || (yearSearch
              ? (card.card_print_variants || []).filter(variant => variant.is_master_set_target && energyVariantCopyrightYear(card, variant) === Number(yearSearch))
              : [])
            const copyrightYearVariant = yearVariants.find(variant => variant.image_url) || yearVariants[0] || null
            const displayCopyrightYear = copyrightYearVariant ? energyVariantCopyrightYear(card, copyrightYearVariant) : null
            const variants = yearGroupVariants || (card.card_print_variants || []).filter(variant => (isPackRewardSelection(setId) ? isPlayStampVariant(variant) : variant.is_master_set_target || isPlayStampVariant(variant))
              && (!yearSearch || energyVariantCopyrightYear(card, variant) === Number(yearSearch) || String(relatedSet(card)?.release_date || '').startsWith(yearSearch)))
            const set = relatedSet(card)
            const previousEntry = index ? group.entries[index - 1] : null
            const showEnergyGroup = !groupedEnergyView && setId === ALL_SERIES && /^20\d{2}$/.test(normalizedSearchText(query)) && set?.id !== relatedSet(previousEntry?.card)?.id
            const storedImageCandidates = cardImageCandidates[card.id] || (card.image_url ? [card.image_url] : [])
            const imageCandidates = copyrightYearVariant?.image_url
              ? [copyrightYearVariant.image_url, ...storedImageCandidates].filter((url, index, values) => values.indexOf(url) === index)
              : storedImageCandidates
            const imageUrl = imageCandidates[0] || ''
            const cardMarketPrice = marketPrices[card.id] || null
            const ownedVariants = variants.map(variant => ({
              variant,
              copies: owned[variant.id] || []
            })).filter(entry => entry.copies.length > 0)
            const selectedProfileName = profiles.find(profile => profile.id === profileId)?.display_name || ''
            return <Fragment key={card.id + (group.year ? '-' + group.year : '')}>
              {showEnergyGroup && <h2 className={styles.energyGroupHeading}>{seriesLabel(set)}{displayCopyrightYear ? ' · tirage ©' + displayCopyrightYear + (copyrightYearVariant?.guide_marker === 'play-pokemon-prize-pack-series-6' ? ' · Pack Récompense Série 6 (2025)' : '') : set?.release_date ? ' · ' + new Date(set.release_date + 'T00:00:00').getFullYear() : ''}</h2>}
              <article className={`${styles.cardRow} ${ownershipCardId === card.id ? styles.cardRowWithOwnership : ''}`}>
              <button className={styles.thumbButton} type="button" onClick={event => { const currentImage = event.currentTarget.querySelector('img')?.currentSrc || imageUrl; setZoomedCard({ ...card, zoomImageUrl: currentImage, zoomImageCandidates: [...new Set([currentImage, ...imageCandidates, ...(cardImageCandidates[card.id] || []), card.image_url].filter(Boolean))] }) }} aria-label={'Voir l’image de ' + card.card_name}>
                {imageUrl ? <img src={imageUrl} alt={card.card_name} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index < 4 ? 'high' : 'auto'} onError={event => advanceCardImage(event, imageCandidates)} /> : <span>Image indisponible</span>}
                <span className={styles.zoomIcon} aria-hidden="true">⌕</span>
              </button>
              <div className={styles.cardIdentity}>
                <span className={styles.cardNumber}>{isPackRewardSelection(setId) ? seriesLabel(selectedSet) + ' · ' : setId === ALL_SERIES ? isEnergySearch(query) ? '' : seriesLabel(set) + ' · ' : selectedMcDonaldsSet ? set?.set_name + ' · ' : ''}{isUnnumberedEnergyCard(card) ? 'Sans numéro' : 'N° ' + card.collector_number}{card.card_type === 'Énergie' && (displayCopyrightYear || set?.release_date) ? displayCopyrightYear ? ' · ©' + displayCopyrightYear : ' · ' + new Date(set.release_date + 'T00:00:00').getFullYear() : ''}</span>
                <button type="button" className={styles.nameButton} onClick={() => setZoomedCard(card)}>{card.card_name}</button>
                {card.frenchCardName && <small className={styles.foreignCounterpart}>Correspondance française : {card.frenchCardName}</small>}
                {card.foreignPrinting && <small className={styles.foreignEditionBadge}>{languageCode} · impression vérifiée</small>}
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
                      {selectedProfileName && selectedProfileName.trim().toLocaleLowerCase('fr') !== 'ma collection' && <small>{selectedProfileName}</small>}
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
                {showPrices && <button
                  type="button"
                  className={styles.catalogPrice}
                  onClick={() => setZoomedCard(card)}
                  aria-label={cardMarketPrice?.amount != null
                    ? 'Voir les finitions et le détail du prix de ' + card.card_name
                    : 'Voir les cotes disponibles pour ' + card.card_name}
                >
                  {marketPricesLoading ? '…' : cardMarketPrice?.amount != null ? formatCatalogPrice(cardMarketPrice.amount) : 'Cote indisponible'}
                </button>}
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
                      {variant.image_url && <img className={styles.variantThumb} src={variant.image_url} alt="" loading="lazy" decoding="async" />}
                      <span>{label}</span>
                      {copies > 0 && <small>Déjà {copies} en collection</small>}
                    </label>
                    {variant.image_url && <button
                      type="button"
                      className={styles.variantPreviewButton}
                      aria-label={'Agrandir le visuel ' + label + ' de ' + card.card_name}
                      title="Agrandir le visuel de cette impression"
                      onClick={() => setZoomedCard({ ...card, zoomImageUrl: variant.image_url, zoomImageCandidates: [variant.image_url, card.image_url].filter(Boolean), zoomVariantLabel: label })}
                    >Voir</button>}
                    <a
                      className={styles.gradedAddButton}
                      href={'/collection/cartes-gradees/ajouter?variant_id=' + encodeURIComponent(variant.id)}
                      title="Ajouter cette carte en version gradée"
                      aria-label={'Ajouter ' + card.card_name + ' ' + label + ' en version gradée'}
                    >G</a>
                    {checked && <label className={styles.quantity}>
                      <span>Qté</span>
                      <input type="number" min="1" max="99" inputMode="numeric" value={quantity} onFocus={event => event.currentTarget.select()} onChange={event => setSelection(current => ({ ...current, [variant.id]: event.target.value }))} aria-label={'Quantité de ' + card.card_name + ' ' + label} />
                    </label>}
                  </div>
                })}
              </div>
            </article>
            </Fragment>
            })
            if (!groupedEnergyView) return <Fragment key="all-cards">{entries}</Fragment>
            const hasPlayPokemonPrinting = group.entries.some(entry => entry.variants.some(variant => variant.guide_marker === 'play-pokemon-prize-pack-series-6'))
            return <details className={styles.energyYearGroup} key={group.year} open={groupIndex === 0}>
              <summary className={styles.energyYearSummary}>
                <span>{group.year}{hasPlayPokemonPrinting ? ' · Play! Pokémon' : ''}</span>
                <small>{group.entries.length} carte{group.entries.length > 1 ? 's' : ''}</small>
              </summary>
              <div className={styles.energyYearCards}>{entries}</div>
            </details>
          })}
        </section>
      )}

      {groupedEnergyView && cards.length > 0 && !loadingCards && <div className={styles.listEndActions}>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Remonter en haut de la liste">
          <span aria-hidden="true">↑</span> Remonter en haut de la liste
        </button>
      </div>}

      {showScrollTop && <button
        type="button"
        className={styles.scrollTopButton}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Remonter en haut de la liste"
        title="Remonter en haut"
      >↑</button>}

      {cards.length > 0 && !loadingCards && !seriesPickerOpen && <aside className={styles.addBar} aria-label="Valider l’ajout à la collection">
        <p aria-live="polite">{selectedRows.length} impression{selectedRows.length > 1 ? 's' : ''} sélectionnée{selectedRows.length > 1 ? 's' : ''} · {selectedCopies} exemplaire{selectedCopies > 1 ? 's' : ''}</p>
        <button type="button" disabled={!selectedRows.length || saving} onClick={addSelectedVariants}>
          {saving ? 'Ajout en cours…' : 'Ajouter à ma collection'}
        </button>
        {!!selectedRows.length && <button className={styles.clearButton} type="button" disabled={saving} onClick={() => setSelection({})}>Effacer</button>}
      </aside>}

      {setId && !loadingCards && !error && !cards.length && (setId !== ALL_SERIES || query.trim() || foreignSetId) && <p className={styles.hint}>{languageCode === 'FR' ? 'Aucune carte trouvée pour cette série ou cette recherche.' : 'Aucune impression ' + languageCode + ' vérifiée ne correspond à cette recherche pour le moment.'}</p>}

      {zoomedCard && <div className={styles.modal} role="presentation" onClick={() => setZoomedCard(null)}>
        <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label={'Carte ' + zoomedCard.card_name} onClick={event => event.stopPropagation()}>
          <button type="button" className={styles.closeButton} onClick={() => setZoomedCard(null)} aria-label="Fermer">×</button>
          <img src={zoomedCard.zoomImageUrl || cardImageCandidates[zoomedCard.id]?.[0] || zoomedCard.image_url} alt={zoomedCard.card_name} onError={event => advanceCardImage(event, zoomedCard.zoomImageCandidates || cardImageCandidates[zoomedCard.id] || [zoomedCard.image_url].filter(Boolean))} />
          <p>{zoomedCard.card_name} · {zoomedCard.collector_number}{zoomedCard.zoomVariantLabel ? ' · ' + zoomedCard.zoomVariantLabel : ''}</p>
          {showPrices && <section className={styles.zoomPrices} aria-label="Cotes par finition">
            <strong>Cotes par finition</strong>
            {marketPricesLoading
              ? <p role="status">Chargement des cotes…</p>
              : (() => {
                const priceVariants = (zoomedCard.card_print_variants || []).filter(variant => variant.is_master_set_target)
                if (!priceVariants.length) {
                  const overallPrice = marketPrices[zoomedCard.id]
                  return overallPrice?.amount != null
                    ? <ul><li><span>Carte</span><div><b>{formatCatalogPrice(overallPrice.amount)}</b><small>{priceDetailsText(overallPrice)}</small></div></li></ul>
                    : <p>Cote indisponible</p>
                }
                return <ul>{priceVariants.map(variant => {
                  const variantPrice = marketPrices[zoomedCard.id]?.variantPrices?.find(price => price.variantId === variant.id)
                  const label = variant.variant_label === 'Carte (suivi de base)' ? 'Carte' : variant.variant_label || variant.variant_key || 'Finition'
                  return <li key={variant.id}>
                    <span>{label}</span>
                    <div>
                      <b>{variantPrice?.amount != null ? formatCatalogPrice(variantPrice.amount) : 'Cote indisponible'}</b>
                      {variantPrice?.amount != null && <small>{priceDetailsText(variantPrice)}</small>}
                    </div>
                  </li>
                })}</ul>
              })()}
          </section>}
          {showPrices && (() => {
            const observedVariants = (marketPrices[zoomedCard.id]?.variantPrices || [])
              .filter(variantPrice => Number(variantPrice.observedSales?.count) > 0)
            if (!observedVariants.length) return null
            return <section className={styles.zoomPrices} aria-label="Ventes observées PokéValeur">
              <strong>Ventes observées PokéValeur</strong>
              <ul>{observedVariants.map(variantPrice => {
                const variant = (zoomedCard.card_print_variants || []).find(item => item.id === variantPrice.variantId)
                const label = variant?.variant_label === 'Carte (suivi de base)' ? 'Carte' : variant?.variant_label || variantPrice.finish || 'Finition'
                return <li key={variantPrice.variantId}>
                  <span>{label}</span>
                  <div>
                    <b>{formatCatalogPrice(variantPrice.observedSales.amount)}</b>
                    <small>{observedSalesDetailsText(variantPrice.observedSales)}</small>
                  </div>
                </li>
              })}</ul>
            </section>
          })()}
          <CardProvenanceButton supabase={supabase} cardId={zoomedCard.id} setCode={zoomedCard.card_sets?.set_code || zoomedCard.set_code || ''} collectorNumber={zoomedCard.collector_number} />
        </div>
      </div>}
    </main>
  )
}
