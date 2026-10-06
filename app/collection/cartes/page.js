'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './cards.module.css'

const ALL_SERIES_FILTER = '__all_series__'

function seriesAbbreviation(set) {
  const code = (set?.set_code || '').trim()
  const normalized = code.toLowerCase()
  const prefixes = { swsh: 'EB', hgss: 'HGSS', sv: 'EV', ev: 'EV', me: 'ME', eb: 'EB', sm: 'SL', sl: 'SL', xy: 'XY', bw: 'NB', dp: 'DP', pl: 'PL' }

  for (const [prefix, abbreviation] of Object.entries(prefixes)) {
    const match = normalized.match(new RegExp('^' + prefix + '(\\d+(?:\\.\\d+)?)([a-z]*)$'))
    if (match) return abbreviation + String(Number(match[1])) + match[2].toUpperCase()
  }

  return code.toUpperCase()
}

function seriesOptionLabel(set) {
  const abbreviation = seriesAbbreviation(set)
  const name = (set.set_name || '').replace(/Classique(?=30e)/i, 'Classique ')
  return (abbreviation ? abbreviation + ' — ' : '') + name + (set.is_public ? '' : ' · brouillon privé')
}

function raritySymbol(label) {
  const value = (label || '').toLocaleLowerCase('fr')
  if (value.includes('commune') || value.includes('common')) return '●'
  if (value.includes('uncommon') || value.includes('peu commune')) return '◆'
  if (value.includes('double')) return '✦✦'
  if (value.includes('hyper')) return '✦✦'
  if (value.includes('illustration')) return value.includes('special') ? '✧' : '★'
  if (value.includes('ultra')) return '★'
  return '★'
}

function rarityDisplayLabel(label) {
  const labels = {
    Common: 'Commune',
    Uncommon: 'Peu commune',
    Rare: 'Rare',
    'Double rare': 'Double rare',
    'Ultra Rare': 'Ultra rare',
    'Illustration rare': 'Illustration rare',
    'Special illustration rare': 'Illustration spéciale rare',
    'Hyper rare': 'Hyper rare'
  }
  return labels[label] || label
}

function elementTypeSymbol(label) {
  const symbols = {
    Grass: '♣', Fire: '♨', Water: '◉', Lightning: 'ϟ', Psychic: '✧',
    Fighting: '✊', Darkness: '☾', Metal: '⚙', Dragon: '♜', Colorless: '☆', Special: 'Sp'
  }
  return symbols[label] || '◇'
}

function elementTypeDisplayLabel(label) {
  const labels = {
    Colorless: 'Incolore', Darkness: 'Obscurité', Dragon: 'Dragon', Fighting: 'Combat',
    Fire: 'Feu', Grass: 'Plante', Lightning: 'Électrik', Metal: 'Métal',
    Psychic: 'Psy', Water: 'Eau', Special: 'Énergie spéciale'
  }
  return labels[label] || label
}

function cardTypeSymbol(label) {
  if (label === 'Pokémon') return '●'
  if (label === 'Dresseur') return '♟'
  if (label === 'Énergie') return '✦'
  return '◇'
}

function imageUrl(card, quality = 'low') {
  const directUrl = card.image_url?.trim()
  if (directUrl) {
    const queryIndex = directUrl.indexOf('?')
    const imagePath = queryIndex < 0 ? directUrl : directUrl.slice(0, queryIndex)
    const query = queryIndex < 0 ? '' : directUrl.slice(queryIndex)
    const normalizedPath = imagePath.endsWith('/') ? imagePath.slice(0, -1) : imagePath
    const lowerPath = normalizedPath.toLowerCase()
    const isImageFile = ['.png', '.jpg', '.jpeg', '.webp'].some(extension => lowerPath.endsWith(extension))
    if (isImageFile && quality === 'high' && lowerPath.endsWith('/low.webp')) return imagePath.slice(0, -'low.webp'.length) + 'high.webp' + query
    return isImageFile ? directUrl : normalizedPath + '/' + quality + '.webp' + query
  }

  const sourceParts = (card.image_source_url || '').split('/').filter(Boolean)
  const setsIndex = sourceParts.lastIndexOf('sets')
  if (setsIndex < 1 || setsIndex + 2 >= sourceParts.length) return ''
  const language = sourceParts[setsIndex - 1]
  const setCode = sourceParts[setsIndex + 1]
  const localId = sourceParts[setsIndex + 2]
  let seriesEnd = 0
  while (seriesEnd < setCode.length) {
    const character = setCode[seriesEnd].toLowerCase()
    if (character < 'a' || character > 'z') break
    seriesEnd += 1
  }
  const seriesCode = setCode.slice(0, seriesEnd)
  if (!seriesCode || !language || !localId) return ''
  return 'https://assets.tcgdex.net/' + language + '/' + seriesCode + '/' + setCode + '/' + encodeURIComponent(localId) + '/' + quality + '.webp'
}

function formatMissingCardNumbers(numbers) {
  const parts = []
  let run = []

  function flushRun() {
    if (run.length > 1) {
      parts.push(run[0].label + ' à ' + run[run.length - 1].label)
    } else if (run.length === 1) {
      parts.push(run[0].label)
    }
    run = []
  }

  for (const value of numbers) {
    const label = String(value)
    const digits = label.match(/^\d+$/)
    if (!digits) {
      flushRun()
      parts.push(label)
      continue
    }

    const number = Number(label)
    const width = label.length
    const previous = run[run.length - 1]
    if (previous && (width !== previous.width || number !== previous.number + 1)) flushRun()
    run.push({ label, number, width })
  }

  flushRun()
  return parts.join(', ')
}

export default function CardChecklistPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState('')
  const [cards, setCards] = useState([])
  const [owned, setOwned] = useState({})
  const [companies, setCompanies] = useState([])
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState([])
  const [selectedCardTypes, setSelectedCardTypes] = useState([])
  const [selectedElementTypes, setSelectedElementTypes] = useState([])
  const [selectedVersions, setSelectedVersions] = useState([])
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [checklistFilter, setChecklistFilter] = useState('main')
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyVariant, setBusyVariant] = useState('')
  const [gradingVariant, setGradingVariant] = useState('')
  const [savingGrade, setSavingGrade] = useState(false)
  const [zoomedCard, setZoomedCard] = useState(null)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const seriesPickerRef = useRef(null)

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
    let cancelled = false
    async function initialize() {
      const params = new URLSearchParams(window.location.search)
      const requestedSetId = params.get('set') || ''
      const requestedRarity = params.get('rarity') || ''
      const requestedChecklist = params.get('checklist')
      setRarity(requestedRarity ? requestedRarity.split(',').filter(Boolean) : [])
      const requestedCollectionFilter = params.get('collection') || (params.get('owned') === '1' ? 'owned' : 'all')
      if (['all', 'owned', 'missing', 'duplicates'].includes(requestedCollectionFilter)) setCollectionFilter(requestedCollectionFilter)
      if (['main', 'promos', 'stamps', 'all'].includes(requestedChecklist)) setChecklistFilter(requestedChecklist)
      setLoading(true)
      const { data: { user: signedInUser }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !signedInUser) {
        window.location.replace('/login?next=%2Fcollection%2Fcartes')
        return
      }
      setUser(signedInUser)

      const { data: identity, error: identityError } = await supabase.from('profiles')
        .select('is_admin').eq('id', signedInUser.id).maybeSingle()
      if (cancelled) return
      const admin = !identityError && identity?.is_admin === true
      setIsAdmin(admin)

      const { data: profileRows, error: profileError } = await supabase.from('collection_profiles')
        .select('id,display_name,is_default,profile_type').order('created_at')
      if (profileError) throw profileError
      if (cancelled) return
      const savedProfileId = window.localStorage.getItem('pokevaleur-collection:' + signedInUser.id)
      const activeProfile = (profileRows || []).find(row => row.id === savedProfileId)
        || (profileRows || []).find(row => row.is_default)
        || (profileRows || [])[0]
      setProfiles(profileRows || [])
      if (activeProfile) {
        setProfileId(activeProfile.id)
        window.localStorage.setItem('pokevaleur-collection:' + signedInUser.id, activeProfile.id)
      }

      const { data: setRows, error: setError } = await supabase.from('card_sets')
        .select('id,set_name,set_code,language,advertised_card_count,checklist_scope_note,is_public,release_date')
        .order('release_date', { ascending: false })
      if (setError) throw setError
      if (cancelled) return
      const availableSets = setRows || []
      setSets(availableSets)
      const selected = availableSets.find(row => row.id === requestedSetId) || availableSets[0]
      if (requestedSetId === ALL_SERIES_FILTER) setSetId(ALL_SERIES_FILTER)
      else if (selected) setSetId(selected.id)

      const { data: companyRows, error: companyError } = await supabase.from('card_grading_companies')
        .select('id,company_name,abbreviation').eq('is_active', true).order('company_name')
      if (companyError) throw companyError
      if (!cancelled) setCompanies(companyRows || [])
    }
    initialize().catch(loadError => { if (!cancelled) setError(loadError.message || 'Impossible de charger la checklist.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (!setId || !profileId || setId === ALL_SERIES_FILTER) return
    let cancelled = false
    async function loadChecklist() {
      setCardsLoading(true)
      setError('')
      setNotice('')
      setCards([])
      setOwned({})
      const { data: cardRows, error: cardError } = await supabase.from('cards')
        .select('id,collector_number,card_name,card_type,element_types,guide_category_label,guide_category_code,rarity_label,mechanic_label,image_url,image_source_url,guide_order,card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target)')
        .eq('card_set_id', setId).order('guide_order', { ascending: true })
      if (cardError) throw cardError
      if (cancelled) return
      const { data: copyRows, error: copyError } = await supabase.from('collection_cards')
        .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)')
        .eq('collection_profile_id', profileId)
      if (copyError) throw copyError
      if (cancelled) return
      const ownership = {}
      for (const copy of copyRows || []) {
        if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
        ownership[copy.card_print_variant_id].push(copy)
      }
      setCards(cardRows || [])
      setOwned(ownership)
    }
    loadChecklist().catch(loadError => { if (!cancelled) setError(loadError.message || 'Impossible de charger les cartes.') })
      .finally(() => { if (!cancelled) setCardsLoading(false) })
    return () => { cancelled = true }
  }, [supabase, setId, profileId])

  useEffect(() => {
    if (setId !== ALL_SERIES_FILTER || !profileId) return
    const term = query.trim()
    const searchableSetIds = sets.filter(row => row.is_public && row.language === 'FR').map(row => row.id)
    let cancelled = false
    if (!term || !searchableSetIds.length) {
      setCards([])
      setOwned({})
      setCardsLoading(false)
      return () => { cancelled = true }
    }
    const timer = window.setTimeout(async () => {
      setCardsLoading(true)
      setError('')
      setNotice('')
      try {
        const escapedTerm = term.replace(/[%_]/g, '\\$&')
        const { data: cardRows, error: cardError } = await supabase.from('cards')
          .select('id,card_set_id,collector_number,card_name,card_type,element_types,rarity_label,image_url,image_source_url,card_sets(set_name,set_code),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target)')
          .in('card_set_id', searchableSetIds).ilike('card_name', '%' + escapedTerm + '%')
          .order('card_name', { ascending: true }).limit(500)
        if (cardError) throw cardError
        if (cancelled) return
        const variantIds = (cardRows || []).flatMap(card => (card.card_print_variants || []).map(variant => variant.id))
        let copyRows = []
        if (variantIds.length) {
          const { data, error: copyError } = await supabase.from('collection_cards')
            .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)')
            .eq('collection_profile_id', profileId).in('card_print_variant_id', variantIds)
          if (copyError) throw copyError
          copyRows = data || []
        }
        if (cancelled) return
        const ownership = {}
        for (const copy of copyRows) {
          if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
          ownership[copy.card_print_variant_id].push(copy)
        }
        setCards(cardRows || [])
        setOwned(ownership)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de rechercher dans toutes les séries.')
      } finally {
        if (!cancelled) setCardsLoading(false)
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [supabase, setId, profileId, query, sets])

  const isAllSeriesSelected = setId === ALL_SERIES_FILTER
  const selectedSet = sets.find(row => row.id === setId)
  const isIncludedVariant = variant => (
    checklistFilter === 'all' ||
    (checklistFilter === 'stamps' ? variant.checklist_group === 'stamp' :
      checklistFilter === 'promos' ? variant.checklist_group === 'promo' :
      variant.checklist_group === 'main')
  )
  const isProgressTarget = variant => variant.is_master_set_target && isIncludedVariant(variant)
  const isCatalogOnlySet = cards.length > 0 && cards.every(card => !(card.card_print_variants || []).length)
  const cardsWithIncludedVariants = isAllSeriesSelected || isCatalogOnlySet
    ? cards
    : cards.filter(card => (card.card_print_variants || []).some(isIncludedVariant))
  const rarities = useMemo(() => [...new Set(cardsWithIncludedVariants.map(card => card.rarity_label?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [cardsWithIncludedVariants])
  const cardTypes = useMemo(() => [...new Set(cardsWithIncludedVariants.map(card => card.card_type?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [cardsWithIncludedVariants])
  const elementTypes = useMemo(() => [...new Set(cardsWithIncludedVariants.flatMap(card => card.element_types || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [cardsWithIncludedVariants])
  const versions = useMemo(() => {
    const labels = new Map()
    for (const card of cardsWithIncludedVariants) {
      for (const variant of card.card_print_variants || []) {
        if (isIncludedVariant(variant) && variant.variant_key) labels.set(variant.variant_key, variant.variant_label || variant.variant_key)
      }
    }
    return [...labels.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [cardsWithIncludedVariants, checklistFilter])
  const baseFilteredCards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr')
    return cardsWithIncludedVariants.filter(card => {
      const matchesQuery = !normalized || (card.collector_number + ' ' + card.card_name).toLocaleLowerCase('fr').includes(normalized)
      const matchesRarity = !rarity.length || rarity.includes(card.rarity_label?.trim())
      const matchesCardType = !selectedCardTypes.length || selectedCardTypes.includes(card.card_type?.trim())
      const matchesElementType = !selectedElementTypes.length || (card.element_types || []).some(type => selectedElementTypes.includes(type))
      const includedVariants = (card.card_print_variants || []).filter(variant => isIncludedVariant(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)))
      return matchesQuery && matchesRarity && matchesCardType && matchesElementType && (isAllSeriesSelected || includedVariants.length > 0)
    })
  }, [cardsWithIncludedVariants, query, rarity, selectedCardTypes, selectedElementTypes, selectedVersions, checklistFilter, isAllSeriesSelected])

  function matchesVariantCollectionFilter(variant, filter) {
    const count = (owned[variant.id] || []).length
    if (filter === 'owned') return count > 0
    if (filter === 'missing') return count === 0
    if (filter === 'duplicates') return count > 1
    return true
  }

  function matchesCollectionFilter(card, filter) {
    const targets = (card.card_print_variants || []).filter(variant => isIncludedVariant(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)))
    return targets.some(variant => matchesVariantCollectionFilter(variant, filter))
  }

  const visibleCards = useMemo(
    () => isAllSeriesSelected ? baseFilteredCards : baseFilteredCards.filter(card => matchesCollectionFilter(card, collectionFilter)),
    [baseFilteredCards, collectionFilter, owned, checklistFilter, selectedVersions, isAllSeriesSelected]
  )
  const missingCardsForCopy = useMemo(
    () => baseFilteredCards.filter(card => matchesCollectionFilter(card, 'missing')),
    [baseFilteredCards, owned, checklistFilter, selectedVersions]
  )
  const missingCardNumbers = [...new Set(missingCardsForCopy.map(card => card.collector_number).filter(Boolean))]
  const formattedMissingCardNumbers = formatMissingCardNumbers(missingCardNumbers)

  const visibleTargetVariants = visibleCards.flatMap(card => (card.card_print_variants || []).filter(variant => isIncludedVariant(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && matchesVariantCollectionFilter(variant, collectionFilter)))
  const visibleOwnedVariantCount = visibleTargetVariants.filter(variant => (owned[variant.id] || []).length > 0).length

  const targetVariants = cardsWithIncludedVariants.flatMap(card => (card.card_print_variants || []).filter(isProgressTarget))
  const cardsWithProgressTargets = cardsWithIncludedVariants.filter(card => (card.card_print_variants || []).some(isProgressTarget))
  const ownedTargetCount = targetVariants.filter(variant => (owned[variant.id] || []).length > 0).length
  const completedCardCount = cardsWithProgressTargets.filter(card => {
    const targets = (card.card_print_variants || []).filter(isProgressTarget)
    return targets.every(variant => (owned[variant.id] || []).length > 0)
  }).length
  const completion = targetVariants.length ? Math.round(ownedTargetCount * 100 / targetVariants.length) : 0

  function selectSet(nextSetId) {
    setSetId(nextSetId)
    setRarity([])
    setSelectedCardTypes([])
    setSelectedElementTypes([])
    setSelectedVersions([])
    setCollectionFilter('all')
    const url = new URL(window.location.href)
    url.searchParams.set('set', nextSetId)
    url.searchParams.delete('rarity')
    url.searchParams.delete('owned')
    url.searchParams.delete('collection')
    window.history.replaceState({}, '', url)
  }

  function selectRarity(nextRarity) {
    const next = rarity.includes(nextRarity) ? rarity.filter(value => value !== nextRarity) : [...rarity, nextRarity]
    setRarity(next)
    const url = new URL(window.location.href)
    if (next.length) url.searchParams.set('rarity', next.join(','))
    else url.searchParams.delete('rarity')
    window.history.replaceState({}, '', url)
  }

  function toggleCardType(value) {
    setSelectedCardTypes(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
  }

  function toggleElementType(value) {
    setSelectedElementTypes(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
  }

  function toggleVersion(value) {
    setSelectedVersions(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
  }

  function selectCollectionFilter(nextFilter) {
    setCollectionFilter(nextFilter)
    const url = new URL(window.location.href)
    if (nextFilter === 'all') url.searchParams.delete('collection')
    else url.searchParams.set('collection', nextFilter)
    url.searchParams.delete('owned')
    window.history.replaceState({}, '', url)
  }

  async function copyMissingCardNumbers() {
    if (!missingCardNumbers.length) {
      setNotice('Aucun numéro manquant avec les filtres actuels.')
      return
    }
    const textToCopy = formatMissingCardNumbers(missingCardNumbers)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = textToCopy
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('La copie n’est pas disponible dans ce navigateur.')
      }
      setNotice(missingCardNumbers.length + ' numéro' + (missingCardNumbers.length > 1 ? 's' : '') + ' manquant' + (missingCardNumbers.length > 1 ? 's' : '') + ' copié' + (missingCardNumbers.length > 1 ? 's' : '') + '.')
    } catch (copyError) {
      setNotice('Copie impossible : ' + (copyError.message || 'sélectionne les numéros manuellement.'))
    }
  }

  function selectProfile(nextProfileId) {
    setProfileId(nextProfileId)
    if (user) window.localStorage.setItem('pokevaleur-collection:' + user.id, nextProfileId)
  }

  async function changeRawCopies(variant, action) {
    const copies = owned[variant.id] || []
    const rawCopies = copies.filter(copy => copy.ownership_type === 'raw')
    if (action === 'remove' && !rawCopies.length) return
    if (action === 'remove' && !window.confirm('Retirer un exemplaire brut de la collection ?')) return
    setBusyVariant(variant.id)
    setNotice('')
    try {
      if (action === 'remove') {
        const copyToRemove = rawCopies[rawCopies.length - 1]
        const { error: deleteError } = await supabase.from('collection_cards').delete().eq('id', copyToRemove.id)
        if (deleteError) throw deleteError
        setOwned(current => ({ ...current, [variant.id]: (current[variant.id] || []).filter(copy => copy.id !== copyToRemove.id) }))
        setNotice(rawCopies.length > 1 ? 'Un exemplaire retiré ; les autres restent dans la collection.' : 'Carte retirée de la collection.')
      } else {
        const { data, error: insertError } = await supabase.from('collection_cards').insert({
          user_id: user.id,
          collection_profile_id: profileId,
          card_print_variant_id: variant.id,
          ownership_type: 'raw'
        }).select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)').single()
        if (insertError) throw insertError
        setOwned(current => ({ ...current, [variant.id]: [...(current[variant.id] || []), data] }))
        setNotice('Exemplaire brut ajouté à la collection.')
      }
    } catch (saveError) {
      setNotice('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setBusyVariant('')
    }
  }

  async function addGradedCopy(event, variant) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const companyId = formData.get('grading_company_id')
    const gradeValue = Number(formData.get('grade'))
    if (!companyId || gradeValue < 1 || gradeValue > 10) {
      setNotice('Choisis une société et une note entre 1 et 10.')
      return
    }
    setSavingGrade(true)
    setNotice('')
    try {
      const { data, error: insertError } = await supabase.from('collection_cards').insert({
        user_id: user.id,
        collection_profile_id: profileId,
        card_print_variant_id: variant.id,
        ownership_type: 'graded',
        grading_company_id: companyId,
        grade: gradeValue,
        grade_label: String(gradeValue) + '/10',
        certification_number: String(formData.get('certification_number') || '').trim() || null,
        current_value_override: formData.get('current_value_override') ? Number(formData.get('current_value_override')) : null
      }).select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)').single()
      if (insertError) throw insertError
      setOwned(current => ({ ...current, [variant.id]: [...(current[variant.id] || []), data] }))
      setGradingVariant('')
      setNotice('Carte gradée ajoutée à la collection.')
    } catch (saveError) {
      setNotice('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setSavingGrade(false)
    }
  }

  async function removeGradedCopy(variantId, copy) {
    if (!window.confirm('Retirer cet exemplaire gradé de la collection ?')) return
    const { error: deleteError } = await supabase.from('collection_cards').delete().eq('id', copy.id)
    if (deleteError) {
      setNotice('Suppression impossible : ' + deleteError.message)
      return
    }
    setOwned(current => ({ ...current, [variantId]: (current[variantId] || []).filter(entry => entry.id !== copy.id) }))
    setNotice('Exemplaire gradé retiré.')
  }

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement de la collection de cartes…</p></main>

  return (
    <main className={styles.page}>
      <div className={styles.topLine}>
        <a className={styles.backLink} href="/collection">← Ma collection</a>
        <span className={styles.privateBadge}>Espace membre</span>
      </div>
      <header className={styles.header}>
        <p className={styles.kicker}>Checklist de série</p>
        <h1>Checklist cartes</h1>
        <p>Marque tes cartes, repère les manquantes et filtre par numéro, rareté, type ou version.</p>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.controls} aria-label="Sélection de la série et du profil">
        <label>
          Série
          <div className={styles.seriesPicker} ref={seriesPickerRef}>
            <button
              type="button"
              className={styles.seriesPickerTrigger}
              aria-haspopup="listbox"
              aria-expanded={seriesPickerOpen}
              aria-label="Choisir une série"
              onClick={() => setSeriesPickerOpen(open => !open)}
              disabled={!sets.length}
            >
              <span>{isAllSeriesSelected ? 'Toutes les séries' : selectedSet ? seriesOptionLabel(selectedSet) : 'Choisir une série'}</span>
              <span className={styles.seriesPickerChevron} aria-hidden="true">▾</span>
            </button>
            {seriesPickerOpen && (
              <div className={styles.seriesPickerOptions} role="listbox" aria-label="Séries de cartes">
                <button
                  type="button"
                  role="option"
                  aria-selected={isAllSeriesSelected}
                  className={isAllSeriesSelected ? styles.seriesPickerOptionActive : styles.seriesPickerOption}
                  onClick={() => { selectSet(ALL_SERIES_FILTER); setSeriesPickerOpen(false) }}
                >Toutes les séries</button>
                {sets.map(set => {
                  const selected = set.id === setId
                  return (
                    <button
                      type="button"
                      key={set.id}
                      role="option"
                      aria-selected={selected}
                      className={selected ? styles.seriesPickerOptionActive : styles.seriesPickerOption}
                      onClick={() => { selectSet(set.id); setSeriesPickerOpen(false) }}
                    >{seriesOptionLabel(set)}</button>
                  )
                })}
              </div>
            )}
          </div>
        </label>
        <label>
          Profil de collection
          <select value={profileId} onChange={event => selectProfile(event.target.value)} disabled={!profiles.length}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || (profile.profile_type === 'adult' ? 'Ma collection' : 'Collection familiale')}</option>)}
          </select>
        </label>
        {isAdmin && selectedSet && !selectedSet.is_public && <p className={styles.adminNote}>Série privée : visible ici pour la vérification administrateur uniquement.</p>}
      </section>

      {!sets.length && !error && <p className={styles.empty}>Aucune série de cartes n’est publiée pour le moment.</p>}
      {isAllSeriesSelected ? (
        <section className={styles.globalSearch} aria-label="Recherche dans toutes les séries">
          <label className={styles.globalSearchLabel}>
            Rechercher une carte dans toutes les séries
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom du Pokémon, par exemple Pikachu…" autoFocus />
          </label>
          {!query.trim() && <p className={styles.scope}>Saisis un nom pour trouver les cartes correspondantes dans toutes les séries françaises publiées.</p>}
          {!!query.trim() && <p className={styles.resultCount} aria-live="polite"><strong>{visibleCards.length}</strong> résultat{visibleCards.length > 1 ? 's' : ''} pour « {query.trim()} » · jusqu’à 500 cartes affichées</p>}
          {cardsLoading ? <p className={styles.status}>Recherche dans toutes les séries…</p> : query.trim() && (
            <section className={styles.cardGrid} aria-label="Résultats toutes séries">
              {!visibleCards.length && !error && <p className={styles.empty}>Aucune carte ne correspond à « {query.trim()} ».</p>}
              {visibleCards.map(card => {
                const cardSet = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
                const cardImage = imageUrl(card)
                return <article className={styles.card} key={card.id}>
                  <div className={styles.cardTop}>
                    <div className={styles.artFrame}>
                      {cardImage && <button type="button" className={styles.artZoomButton} aria-label={'Agrandir l’image de ' + card.card_name} onClick={() => setZoomedCard({ ...card, seriesName: cardSet?.set_name || '' })}>
                        <img src={cardImage} alt={'Illustration de ' + card.card_name} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement.parentElement.dataset.imageMissing = 'true' }} />
                      </button>}
                      <span>{card.card_type || 'Carte Pokémon'} · cliquer pour agrandir</span>
                    </div>
                    <div className={styles.cardHeading}>
                      <span className={styles.number}>N° {card.collector_number}</span>
                      <h2>{card.card_name}</h2>
                      <p className={styles.rarity}>{cardSet?.set_name || 'Série'}</p>
                      <small>{rarityDisplayLabel(card.rarity_label || 'Rareté à préciser')}</small>
                    </div>
                  </div>
                </article>
              })}
            </section>
          )}
        </section>
      ) : selectedSet && (
        <>
          {isCatalogOnlySet ? (
            <section className={styles.progressCard} aria-label="État du catalogue">
              <strong>{cards.length} cartes répertoriées</strong>
              <p className={styles.scope}>Première passe du catalogue : les noms et numéros sont importés. Les variantes et le suivi de collection seront ajoutés ensuite.</p>
            </section>
          ) : (
          <section className={styles.progressCard} aria-label="Progression de la série">
            <div className={styles.progressHeading}>
              <div><strong>{ownedTargetCount} / {targetVariants.length}</strong><span>variantes du checklist possédées</span></div>
              <div><strong>{completedCardCount} / {cardsWithIncludedVariants.length}</strong><span>cartes complétées</span></div>
              <strong className={styles.percent}>{completion}%</strong>
            </div>
            <div className={styles.progressTrack} role="progressbar" aria-valuenow={completion} aria-valuemin="0" aria-valuemax="100" aria-label="Progression de la checklist">
              <span style={{ width: completion + '%' }} />
            </div>
            <p className={styles.scope}>{selectedSet.checklist_scope_note} Une carte est comptée une seule fois dans la liste ; les variantes (normale, reverse, tamponnée…) sont comptées séparément dans la progression.</p>
          </section>
          )}

          <section className={styles.filters} aria-label="Filtres de la checklist">
            <label className={styles.searchLabel}>
              Rechercher une carte
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Numéro ou nom…" />
            </label>
            <div className={styles.visualFilters}>
              <div className={styles.filterGroup}>
                <div className={styles.filterHeading}><strong>Rareté</strong><span>{rarities.length} choix</span></div>
                <div className={styles.filterChoices} role="group" aria-label="Filtrer par rareté">
                  {rarities.map(value => {
                    const count = cardsWithIncludedVariants.filter(card => card.rarity_label?.trim() === value).length
                    const active = rarity.includes(value)
                    return <button type="button" key={value} className={active ? styles.filterChoiceActive : styles.filterChoice} aria-pressed={active} title={rarityDisplayLabel(value) + ' · ' + count + ' cartes'} onClick={() => selectRarity(value)}>
                      <span className={styles.filterIcon} aria-hidden="true">{raritySymbol(value)}</span><span>{rarityDisplayLabel(value)}</span><small>{count}</small>
                    </button>
                  })}
                </div>
              </div>
              <div className={styles.filterGroup}>
                <div className={styles.filterHeading}><strong>Famille de carte</strong><span>{cardTypes.length} choix</span></div>
                <div className={styles.filterChoices} role="group" aria-label="Filtrer par famille de carte">
                  {cardTypes.map(value => {
                    const count = cardsWithIncludedVariants.filter(card => card.card_type?.trim() === value).length
                    const active = selectedCardTypes.includes(value)
                    return <button type="button" key={value} className={active ? styles.filterChoiceActive : styles.filterChoice} aria-pressed={active} title={value + ' · ' + count + ' cartes'} onClick={() => toggleCardType(value)}>
                      <span className={styles.filterIcon} aria-hidden="true">{cardTypeSymbol(value)}</span><span>{value}</span><small>{count}</small>
                    </button>
                  })}
                </div>
              </div>
              {!!elementTypes.length && <div className={styles.filterGroup}>
                <div className={styles.filterHeading}><strong>Élément / énergie</strong><span>{elementTypes.length} choix</span></div>
                <div className={styles.filterChoices} role="group" aria-label="Filtrer par type élémentaire">
                  {elementTypes.map(value => {
                    const count = cardsWithIncludedVariants.filter(card => (card.element_types || []).includes(value)).length
                    const active = selectedElementTypes.includes(value)
                    return <button type="button" key={value} className={active ? styles.filterChoiceActive : styles.filterChoice} aria-pressed={active} title={elementTypeDisplayLabel(value) + ' · ' + count + ' cartes'} onClick={() => toggleElementType(value)}>
                      <span className={styles.filterIcon} aria-hidden="true">{elementTypeSymbol(value)}</span><span>{elementTypeDisplayLabel(value)}</span><small>{count}</small>
                    </button>
                  })}
                </div>
              </div>}
              <div className={styles.filterGroup}>
                <div className={styles.filterHeading}><strong>Version</strong><span>{versions.length} choix</span></div>
                <div className={styles.filterChoices} role="group" aria-label="Filtrer par version">
                  {versions.map(version => {
                    const count = cardsWithIncludedVariants.filter(card => (card.card_print_variants || []).some(variant => isIncludedVariant(variant) && variant.variant_key === version.key)).length
                    const active = selectedVersions.includes(version.key)
                    return <button type="button" key={version.key} className={active ? styles.filterChoiceActive : styles.filterChoice} aria-pressed={active} title={version.label + ' · ' + count + ' cartes'} onClick={() => toggleVersion(version.key)}>
                      <span className={styles.versionIcon} aria-hidden="true">{version.label.slice(0, 1).toLocaleUpperCase('fr')}</span><span>{version.label}</span><small>{count}</small>
                    </button>
                  })}
                </div>
              </div>
            </div>
            <div className={styles.quickFilters} aria-label="Filtres rapides de collection">
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'owned', label: 'Possédées' },
                { key: 'missing', label: 'Manquantes' },
                { key: 'duplicates', label: 'En double' }
              ].map(option => {
                const count = baseFilteredCards.filter(card => matchesCollectionFilter(card, option.key)).length
                const active = collectionFilter === option.key
                return <button type="button" key={option.key} className={active ? styles.quickFilterActive : styles.quickFilter} aria-pressed={active} onClick={() => selectCollectionFilter(option.key)}>
                  {option.label}<small>{count}</small>
                </button>
              })}
              <button type="button" className={styles.copyMissing} onClick={copyMissingCardNumbers} disabled={!missingCardNumbers.length}>
                Copier les numéros manquants{missingCardNumbers.length ? ' · ' + missingCardNumbers.length : ''}
              </button>
            </div>
            {missingCardNumbers.length > 0 && <details className={styles.missingPreview}>
              <summary>Voir les {missingCardNumbers.length} numéros manquants</summary>
              <p>{formattedMissingCardNumbers}</p>
            </details>}
            <label>
              Type de checklist
              <select value={checklistFilter} onChange={event => setChecklistFilter(event.target.value)} disabled={isCatalogOnlySet}>
                <option value="main">Cartes et variantes principales</option>
                <option value="promos">Promos SVP liées à la série</option>
                <option value="stamps">Versions tamponnées</option>
                <option value="all">Tout afficher</option>
              </select>
            </label>
          </section>

          {checklistFilter === 'stamps' && (
            <p className={styles.imageNote} role="status">
              Le filtre liste les variantes avec stamp ; l’image disponible peut représenter la carte sans son stamp.
            </p>
          )}

          {cardsLoading ? <p className={styles.status}>Chargement des cartes…</p> : (
            <section className={styles.cardGrid} aria-label="Cartes de la série">
              {!visibleCards.length && <p className={styles.empty}>{collectionFilter === 'owned' ? 'Aucune carte possédée avec ces filtres.' : collectionFilter === 'missing' ? 'Aucune carte manquante avec ces filtres.' : collectionFilter === 'duplicates' ? 'Aucun doublon avec ces filtres.' : 'Aucune carte ne correspond aux filtres.'}</p>}
              <p className={styles.resultCount} aria-live="polite"><strong>{visibleCards.length}</strong> carte{visibleCards.length > 1 ? 's' : ''} affichée{visibleCards.length > 1 ? 's' : ''} · <strong>{visibleOwnedVariantCount} / {visibleTargetVariants.length}</strong> variantes possédées</p>
              {visibleCards.map(card => {
                const cardVariants = (card.card_print_variants || []).filter(variant => isIncludedVariant(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && matchesVariantCollectionFilter(variant, collectionFilter))
                return (
                  <article className={styles.card} key={card.id}>
                    <div className={styles.cardTop}>
                      <div className={styles.artFrame}>
                        <button type="button" className={styles.artZoomButton} aria-label={'Agrandir l’image de ' + card.card_name} onClick={() => setZoomedCard({ ...card, seriesName: selectedSet?.set_name || '' })}>
                          <img src={imageUrl(card)} alt={'Illustration de ' + card.card_name} loading="lazy" onError={event => {
                            event.currentTarget.style.display = 'none'
                            event.currentTarget.parentElement.parentElement.dataset.imageMissing = 'true'
                          }} />
                        </button>
                        <span>{card.card_type || 'Carte Pokémon'} · cliquer pour agrandir</span>
                      </div>
                      <div className={styles.cardHeading}>
                        <span className={styles.number}>N° {card.collector_number}</span>
                        <h2>{card.card_name}</h2>
                        <p className={styles.rarity}>{rarityDisplayLabel(card.rarity_label || 'Rareté à préciser')}</p>
                        {card.mechanic_label && <small>{card.mechanic_label}</small>}
                      </div>
                    </div>
                    <div className={styles.variantList}>
                      {!cardVariants.length && isCatalogOnlySet && <p className={styles.scope}>Variantes à compléter avant le suivi de collection.</p>}
                      {cardVariants.map(variant => {
                        const copies = owned[variant.id] || []
                        const rawCopies = copies.filter(copy => copy.ownership_type === 'raw')
                        const gradedCopies = copies.filter(copy => copy.ownership_type === 'graded')
                        return (
                          <div className={styles.variant} key={variant.id}>
                            <div className={styles.variantName}>
                              <span>{variant.variant_label}</span>
                              {variant.checklist_group === 'stamp' && <small>Tampon</small>}
                            </div>
                            <div className={styles.rawLine}>
                              <label className={styles.checkboxLine}>
                                <input type="checkbox" checked={rawCopies.length > 0} readOnly />
                                <span>Brute · {rawCopies.length}</span>
                              </label>
                              <div className={styles.copyActions}>
                                <button type="button" aria-label="Retirer un exemplaire brut" disabled={!rawCopies.length || busyVariant === variant.id} onClick={() => changeRawCopies(variant, 'remove')}>−</button>
                                <button type="button" aria-label="Ajouter un exemplaire brut" disabled={busyVariant === variant.id} onClick={() => changeRawCopies(variant, 'add')}>+</button>
                              </div>
                            </div>
                            <div className={styles.gradedSection}>
                              <div className={styles.gradedHeading}><span>Gradées · {gradedCopies.length}</span><button type="button" onClick={() => setGradingVariant(gradingVariant === variant.id ? '' : variant.id)}>+ Ajouter</button></div>
                              {gradedCopies.map(copy => (
                                <div className={styles.gradedCopy} key={copy.id}>
                                  <span>{copy.card_grading_companies?.abbreviation || copy.card_grading_companies?.company_name || 'Société'} {copy.grade_label || copy.grade}</span>
                                  {copy.certification_number && <small>Cert. {copy.certification_number}</small>}
                                  <button type="button" aria-label="Retirer cet exemplaire gradé" onClick={() => removeGradedCopy(variant.id, copy)}>×</button>
                                </div>
                              ))}
                              {gradingVariant === variant.id && (
                                <form className={styles.gradeForm} onSubmit={event => addGradedCopy(event, variant)}>
                                  <label>Société
                                    <select name="grading_company_id" required defaultValue="">
                                      <option value="" disabled>Choisir…</option>
                                      {companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}
                                    </select>
                                  </label>
                                  <label>Note
                                    <select name="grade" defaultValue="10">
                                      {Array.from({ length: 10 }, (_, index) => 10 - index).map(value => <option key={value} value={value}>{value}/10</option>)}
                                    </select>
                                  </label>
                                  <label>Certification (facultatif)<input name="certification_number" maxLength="80" /></label>
                                  <label>Valeur personnelle (€)<input name="current_value_override" type="number" min="0" step="0.01" /></label>
                                  {!companies.length && <small>Les sociétés de gradation seront disponibles après leur ajout au référentiel.</small>}
                                  <button type="submit" disabled={savingGrade || !companies.length}>{savingGrade ? 'Enregistrement…' : 'Enregistrer la gradée'}</button>
                                </form>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </>
      )}
      {zoomedCard && <div className={styles.zoomBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setZoomedCard(null) }}>
        <section className={styles.zoomDialog} role="dialog" aria-modal="true" aria-label={'Image agrandie de ' + zoomedCard.card_name}>
          <button type="button" className={styles.zoomClose} aria-label="Fermer l’image agrandie" onClick={() => setZoomedCard(null)}>×</button>
          <img className={styles.zoomImage} src={imageUrl(zoomedCard, 'high')} alt={'Illustration agrandie de ' + zoomedCard.card_name} onError={event => { const fallback = imageUrl(zoomedCard, 'low'); if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback }} />
          <p><strong>{zoomedCard.card_name}</strong> · N° {zoomedCard.collector_number}{zoomedCard.seriesName ? ' · ' + zoomedCard.seriesName : ''}</p>
        </section>
      </div>}
    </main>
  )
}
