'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './cards.module.css'

const ALL_SERIES_FILTER = '__all_series__'

function collectMissingTargetVariantIds(variants, ownedByVariant = {}) {
  const ids = new Set()
  for (const variant of variants || []) {
    if (!variant?.id || !variant.is_master_set_target) continue
    if ((ownedByVariant[variant.id] || []).length) continue
    ids.add(variant.id)
  }
  return [...ids]
}

const FRENCH_SET_CODES = {
  swsh1: 'EB01', swsh2: 'EB02', swsh3: 'EB03', 'swsh3.5': 'EB03.5', swsh4: 'EB04', 'swsh4.5': 'EB04.5',
  'swsh4.5sv': 'EB04.5 SV', swsh5: 'EB05', swsh6: 'EB06', swsh7: 'EB07', cel25: 'EB07.5', cel25cc: 'EB07.5 CC',
  swsh8: 'EB08', swsh9: 'EB09', swsh9tg: 'EB09 TG', swsh10: 'EB10', swsh10tg: 'EB10 TG', 'swsh10.5': 'EB10.5',
  swsh11: 'EB11', swsh11tg: 'EB11 TG', swsh12: 'EB12', swsh12tg: 'EB12 TG', 'swsh12.5': 'EB12.5', 'swsh12.5gg': 'EB12.5 GG',
  sv01: 'EV01', sv02: 'EV02', sv03: 'EV03', 'sv03.5': 'EV03.5', sv04: 'EV04', 'sv04.5': 'EV04.5', sv05: 'EV05',
  sv06: 'EV06', 'sv06.5': 'EV06.5', sv07: 'EV07', sv08: 'EV08', 'sv08.5': 'EV08.5', sv09: 'EV09', sv10: 'EV10',
  'sv10.5b': 'EV10.5', 'sv10.5w': 'EV10.5', me01: 'ME01', me02: 'ME02', 'me02.5': 'ME02.5', me03: 'ME03',
  me04: 'ME04', me05: 'ME05', '30th': '30C', '30th-c': '30CC'
}

function seriesAbbreviation(set) {
  const code = (set?.set_code || '').trim()
  const normalized = code.toLowerCase()
  if (FRENCH_SET_CODES[normalized]) return FRENCH_SET_CODES[normalized]
  const prefixes = { hgss: 'HGSS', sm: 'SL', sl: 'SL', xy: 'XY', bw: 'NB', dp: 'DP', pl: 'PL' }
  for (const [prefix, abbreviation] of Object.entries(prefixes)) {
    const match = normalized.match(new RegExp('^' + prefix + '(\\d+(?:\\.\\d+)?)([a-z]*)

function seriesOptionLabel(set) {
  const abbreviation = seriesAbbreviation(set)
  const name = (set.set_name || '').replace(/Classique(?=30e)/i, 'Classique ')
  const masterSetSuffix = (set.set_code || '').toLowerCase() === 'swsh9' ? ' · Master Set' : ''
  return (abbreviation ? abbreviation + ' — ' : '') + name + masterSetSuffix + (set.is_public ? '' : ' · brouillon privé')
}

const RARITY_FILTERS = [
  { key: 'common', label: 'Commune' },
  { key: 'uncommon', label: 'Peu commune' },
  { key: 'rare', label: 'Rare' },
  { key: 'double', label: 'Double rare' },
  { key: 'ultra', label: 'Ultra rare' },
  { key: 'illustration', label: 'Illustration rare' },
  { key: 'specialIllustration', label: 'Illustration spéciale rare' },
  { key: 'hyper', label: 'Hyper rare' },
  { key: 'megaAttack', label: 'Méga attaque rare' },
  { key: 'megaHyper', label: 'Méga hyper rare' }
]

function rarityKey(label) {
  const value = (label || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '')
  if (value.includes('megaattack') || value.includes('attackmega')) return 'megaAttack'
  if (value.includes('megahyper') || value.includes('hypermega')) return 'megaHyper'
  if (value.includes('special') && value.includes('illustration')) return 'specialIllustration'
  if (value.includes('illustration')) return 'illustration'
  if (value.includes('double')) return 'double'
  if (value.includes('ultra')) return 'ultra'
  if (value.includes('hyper') || value.includes('secret')) return 'hyper'
  if (value.includes('uncommon') || value.includes('peucommune')) return 'uncommon'
  if (value === 'common' || value === 'commune') return 'common'
  if (value.includes('rare')) return 'rare'
  return ''
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
    'Hyper rare': 'Hyper rare',
    'Mega Attack Rare': 'Méga attaque rare',
    'Méga attaque rare': 'Méga attaque rare',
    'Mega Hyper Rare': 'Méga hyper rare',
    'Méga Hyper Rare': 'Méga hyper rare'
  }
  return labels[label] || label
}

function RarityFilterIcon({ rarityKey: type }) {
  const star = '16,2 19.6,11 29,11.5 21.8,17.5 24.4,27 16,21.5 7.6,27 10.2,17.5 3,11.5 12.4,11'
  let mark

  switch (type) {
    case 'common':
      mark = <circle cx="16" cy="16" r="6.5" fill="#111"/>
      break
    case 'uncommon':
      mark = <polygon points="16,5 27,16 16,27 5,16" fill="#111"/>
      break
    case 'rare':
      mark = <polygon points={star} fill="#fff" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>
      break
    case 'double':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#111"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#111"/></>
      break
    case 'ultra':
      mark = <polygon points={star} fill="#f3bd18" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
      break
    case 'illustration':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#a7adb4" stroke="#fff" strokeWidth="1"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#a7adb4" stroke="#fff" strokeWidth="1"/></>
      break
    case 'specialIllustration':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#f4bd16" stroke="#fff" strokeWidth="1"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#f4bd16" stroke="#fff" strokeWidth="1"/></>
      break
    case 'hyper':
      mark = <><polygon points="16,3 19.4,11.5 28,12 21.4,17.8 23.4,26 16,21.5 8.6,26 10.6,17.8 4,12 12.6,11.5" fill="#f3c21b" stroke="#151515" strokeWidth="1.6"/><path d="m16 7 1.8 6.1 6.2.3-4.8 4 1.4 6-5.2-3.3-5.2 3.3 1.4-6-4.8-4 6.2-.3L16 7Z" fill="#fff1a8"/></>
      break
    case 'megaAttack':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#e98ac8"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#72c98a"/></>
      break
    case 'megaHyper':
      mark = <><polygon points="16,3 27,16 16,29 5,16" fill="#f1c72c" stroke="#9d7c11" strokeWidth="1.5" strokeLinejoin="round"/><polygon points="16,8 17.8,13 23,13.3 19,16.5 20.5,22 16,19 11.5,22 13,16.5 9,13.3 14.2,13" fill="#fff8d6"/></>
      break
    default:
      mark = <polygon points={star} fill="#fff" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>
  }

  return <span className={styles.filterIcon + ' ' + styles.rarityFilterIcon} aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false">{mark}</svg>
  </span>
}

function elementTypeKey(label) {
  const normalized = (label || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '')
  const aliases = {
    grass: 'grass', plante: 'grass',
    fire: 'fire', feu: 'fire',
    water: 'water', eau: 'water',
    lightning: 'lightning', electric: 'lightning', electrik: 'lightning', electrique: 'lightning', electricite: 'lightning',
    psychic: 'psychic', psy: 'psychic',
    fighting: 'fighting', combat: 'fighting',
    darkness: 'darkness', obscurite: 'darkness', tenebres: 'darkness',
    metal: 'metal', acier: 'metal',
    dragon: 'dragon',
    fairy: 'fairy', fee: 'fairy',
    colorless: 'colorless', incolore: 'colorless', normal: 'colorless',
    special: 'special', energiespeciale: 'special'
  }
  return aliases[normalized] || 'colorless'
}

function elementTypeColor(type) {
  return {
    grass: '#36a852', fire: '#ed493b', water: '#3198e8', lightning: '#f0c629',
    psychic: '#995acb', fighting: '#e66a35', darkness: '#28364b', metal: '#828c98',
    dragon: '#d98b2b', fairy: '#ed91ca', colorless: '#9ba4ae', special: '#a05caa'
  }[type]
}

function ElementTypeIcon({ label }) {
  const type = elementTypeKey(label)
  const fill = elementTypeColor(type)
  let mark

  switch (type) {
    case 'grass':
      mark = <><path d="M8 22C8 11 14 6 25 6c0 11-5 17-16 17Z" fill="#fff"/><path d="M9 23 21 11" fill="none" stroke={fill} strokeWidth="1.8" strokeLinecap="round"/></>
      break
    case 'fire':
      mark = <path d="M17 5c1 5-3 6-2 10 1-2 3-3 4-5 4 4 6 7 4 11-1 3-4 5-8 5-5 0-8-3-8-7 0-4 3-7 6-10 0 3 1 4 2 5 2-3 2-6 2-9Z" fill="#fff"/>
      break
    case 'water':
      mark = <path d="M16 5C13 10 8 15 8 19a8 8 0 0 0 16 0c0-4-5-9-8-14Z" fill="#fff"/>
      break
    case 'lightning':
      mark = <path d="M18 4 8 17h7l-1 11 10-15h-7l1-9Z" fill="#fff"/>
      break
    case 'psychic':
      mark = <><path d="M4.5 16s4-7 11.5-7 11.5 7 11.5 7-4 7-11.5 7S4.5 16 4.5 16Z" fill="#fff"/><circle cx="16" cy="16" r="4" fill={fill}/><circle cx="16" cy="16" r="1.8" fill="#fff"/></>
      break
    case 'fighting':
      mark = <path d="M8 15h3v-5c0-2.5 3.5-2.5 3.5 0v4-7c0-2.5 3.5-2.5 3.5 0v7-5c0-2.5 3.5-2.5 3.5 0v6l1-2c1-2 3.7-.8 3 1.4l-1.8 5.4A6 6 0 0 1 18 24h-3c-2.3 0-4-1-5-3l-3-3c-1.4-1.4-.5-3 1-3Z" fill="#fff"/>
      break
    case 'darkness':
      mark = <><circle cx="17" cy="16" r="9" fill="#fff"/><circle cx="21" cy="12" r="8" fill={fill}/></>
      break
    case 'metal':
      mark = <><path d="m16 6 8 5v10l-8 5-8-5V11l8-5Z" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="16" cy="16" r="3" fill="#fff"/></>
      break
    case 'dragon':
      mark = <><path d="m5 19 8-12 3 7 5-8 6 13-9-3-7 6-6-3Z" fill="#fff"/><circle cx="19" cy="15" r="1" fill={fill}/></>
      break
    case 'special':
      mark = <><path d="m16 6 2.8 6.4 6.9.6-5.2 4.5 1.6 6.7-6.1-3.6-6.1 3.6 1.6-6.7-5.2-4.5 6.9-.6L16 6Z" fill="#fff"/><circle cx="16" cy="16" r="2" fill={fill}/></>
      break
    case 'fairy':
      mark = <><path d="m16 5 2.7 7 7.3 1-5.4 4.7 1.7 7.2-6.3-3.8-6.3 3.8 1.7-7.2L4 13l7.3-1L16 5Z" fill="#fff"/><circle cx="16" cy="16" r="2" fill={fill}/></>
      break
    default:
      mark = <path d="m16 5 3.2 7.1 7.8.7-5.9 5.1 1.8 7.6-6.9-4.1-6.9 4.1 1.8-7.6-5.9-5.1 7.8-.7L16 5Z" fill="#fff"/>
  }

  return <span className={styles.filterIcon + ' ' + styles.energyFilterIcon} aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false">
      <circle cx="16" cy="16" r="15" fill={fill}/>
      <circle cx="11" cy="9" r="3" fill="#fff" opacity=".2"/>
      {mark}
    </svg>
  </span>
}

function elementTypeDisplayLabel(label) {
  const labels = {
    grass: 'Plante', fire: 'Feu', water: 'Eau', lightning: 'Électrique',
    psychic: 'Psy', fighting: 'Combat', darkness: 'Obscurité', metal: 'Métal',
    dragon: 'Dragon', fairy: 'Fée', colorless: 'Incolore', special: 'Énergie spéciale'
  }
  return labels[elementTypeKey(label)] || label
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
  const [collectionFilter, setCollectionFilter] = useState('owned')
  const [checklistFilter, setChecklistFilter] = useState('main')
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyVariant, setBusyVariant] = useState('')
  const [selectedVariantIds, setSelectedVariantIds] = useState([])
  const [savingBulk, setSavingBulk] = useState(false)
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
      setRarity(requestedRarity ? requestedRarity.split(',').map(rarityKey).filter(Boolean) : [])
      const requestedCollectionFilter = params.get('collection') || 'owned'
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
      if (requestedSetId === ALL_SERIES_FILTER) setSetId(ALL_SERIES_FILTER)
      else if (availableSets.some(row => row.id === requestedSetId)) setSetId(requestedSetId)

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
      const selectedSet = sets.find(set => set.id === setId)
      const checklistSetIds = (selectedSet?.set_code || '').toLowerCase() === 'swsh9'
        ? sets.filter(set => ['swsh9', 'swsh9tg'].includes((set.set_code || '').toLowerCase())).map(set => set.id)
        : [setId]
      const { data: cardRows, error: cardError } = await supabase.from('cards')
        .select('id,collector_number,card_name,card_type,element_types,guide_category_label,guide_category_code,rarity_label,mechanic_label,image_url,image_source_url,guide_order,card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target)')
        .in('card_set_id', checklistSetIds).order('guide_order', { ascending: true })
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
  const rarities = RARITY_FILTERS
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
  const masterSetCards = useMemo(() => isCatalogOnlySet
    ? cards
    : cards.filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target)), [cards, isCatalogOnlySet])
  const checklistCards = isAllSeriesSelected ? cards : masterSetCards
  const baseFilteredCards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr')
    return checklistCards.filter(card => !normalized || (card.collector_number + ' ' + card.card_name).toLocaleLowerCase('fr').includes(normalized))
  }, [checklistCards, query])

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

  const visibleCards = baseFilteredCards.filter(card => matchesCollectionFilter(card, collectionFilter))
  const missingCardsForCopy = useMemo(
    () => baseFilteredCards.filter(card => matchesCollectionFilter(card, 'missing')),
    [baseFilteredCards, owned, checklistFilter, selectedVersions]
  )
  const missingCardNumbers = [...new Set(missingCardsForCopy.map(card => card.collector_number).filter(Boolean))]
  const formattedMissingCardNumbers = formatMissingCardNumbers(missingCardNumbers)

  const visibleTargetVariants = visibleCards.flatMap(card => (card.card_print_variants || []).filter(variant => isIncludedVariant(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && matchesVariantCollectionFilter(variant, collectionFilter)))
  const visibleMissingVariantIds = collectMissingTargetVariantIds(
    visibleCards.flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target)),
    owned
  )
  const visibleOwnedVariantCount = visibleTargetVariants.filter(variant => (owned[variant.id] || []).length > 0).length
  const selectedVariantCount = selectedVariantIds.length
  const selectedCardCount = masterSetCards.filter(card =>
    (card.card_print_variants || []).some(variant => variant.is_master_set_target && selectedVariantIds.includes(variant.id))
  ).length

  const targetVariants = cards.flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target))
  const cardsWithProgressTargets = cards.filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target))
  const ownedTargetCount = targetVariants.filter(variant => (owned[variant.id] || []).length > 0).length
  const completedCardCount = cardsWithProgressTargets.filter(card => {
    const targets = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
    return targets.every(variant => (owned[variant.id] || []).length > 0)
  }).length
  const completion = targetVariants.length ? Math.round(ownedTargetCount * 100 / targetVariants.length) : 0

  function selectSet(nextSetId) {
    setSetId(nextSetId)
    setSelectedVariantIds([])
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
    setSelectedVariantIds([])
    if (user) window.localStorage.setItem('pokevaleur-collection:' + user.id, nextProfileId)
  }

  function toggleVariantSelection(variant) {
    if (!variant?.is_master_set_target || (owned[variant.id] || []).length || savingBulk) return
    setSelectedVariantIds(current => current.includes(variant.id)
      ? current.filter(id => id !== variant.id)
      : [...current, variant.id])
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
        setSelectedVariantIds(current => current.filter(id => id !== variant.id))
        setNotice('Exemplaire brut ajouté à la collection.')
      }
    } catch (saveError) {
      setNotice('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setBusyVariant('')
    }
  }

  async function addSelectedVariants() {
    if (!user || !profileId || savingBulk) return
    const variantById = new Map(cards.flatMap(card => card.card_print_variants || []).map(variant => [variant.id, variant]))
    const cardByVariantId = new Map(cards.flatMap(card => (card.card_print_variants || []).map(variant => [variant.id, card.id])))
    const variantsToAdd = [...new Set(selectedVariantIds)]
      .map(id => variantById.get(id))
      .filter(variant => variant?.is_master_set_target && !(owned[variant.id] || []).length)
    if (!variantsToAdd.length) {
      setSelectedVariantIds([])
      setNotice('Aucune variante manquante à ajouter. Les doublons ont été ignorés.')
      return
    }

    const targetProfileId = profileId
    setSavingBulk(true)
    setNotice('')
    let addedCount = 0
    const addedCardIds = new Set()
    try {
      for (let offset = 0; offset < variantsToAdd.length; offset += 100) {
        const rows = variantsToAdd.slice(offset, offset + 100).map(variant => ({
          user_id: user.id,
          collection_profile_id: targetProfileId,
          card_print_variant_id: variant.id,
          ownership_type: 'raw'
        }))
        const { data, error: insertError } = await supabase.from('collection_cards').insert(rows)
          .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)')
        if (insertError) throw insertError
        addedCount += (data || []).length
        for (const copy of data || []) {
          const cardId = cardByVariantId.get(copy.card_print_variant_id)
          if (cardId) addedCardIds.add(cardId)
        }
        const addedIds = new Set((data || []).map(copy => copy.card_print_variant_id))
        setOwned(current => {
          const next = { ...current }
          for (const copy of data || []) next[copy.card_print_variant_id] = [...(next[copy.card_print_variant_id] || []), copy]
          return next
        })
        setSelectedVariantIds(current => current.filter(id => !addedIds.has(id)))
      }
      setNotice(addedCardIds.size + ' carte' + (addedCardIds.size > 1 ? 's ajoutées' : ' ajoutée') + ' à ta collection.')
    } catch (saveError) {
      setNotice(addedCardIds.size
        ? addedCardIds.size + ' carte(s) ajoutée(s) ; le reste n’a pas été enregistré : ' + (saveError.message || 'réessaie.')
        : 'Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setSavingBulk(false)
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
      setSelectedVariantIds(current => current.filter(id => id !== variant.id))
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
        <p className={styles.kicker}>Ma collection · Cartes</p>
        <h1>Mes cartes possédées</h1>
        <p>Consulte les impressions que tu possèdes et le nombre d’exemplaires. Pour ajouter une carte ou une variante, sélectionne-la dans le Catalogue.</p>
        <a className={styles.collectionCatalogueLink} href={'/catalogue/cartes' + (setId && setId !== ALL_SERIES_FILTER ? '?set=' + encodeURIComponent(setId) : '')}>Choisir des cartes dans le Catalogue →</a>
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
          <select value={profileId} onChange={event => selectProfile(event.target.value)} disabled={!profiles.length || savingBulk}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || (profile.profile_type === 'adult' ? 'Ma collection' : 'Collection familiale')}</option>)}
          </select>
        </label>
        {isAdmin && selectedSet && !selectedSet.is_public && <p className={styles.adminNote}>Série privée : visible ici pour la vérification administrateur uniquement.</p>}
      </section>

      {!sets.length && !error && <p className={styles.empty}>Aucune série de cartes n’est publiée pour le moment.</p>}
      {!isAllSeriesSelected && !selectedSet && !loading && <p className={styles.seriesPrompt}>Choisis une série pour afficher la liste complète de ses cartes de Master Set.</p>}
      {isAllSeriesSelected ? (
        <section className={styles.globalSearch} aria-label="Recherche dans toutes les séries">
          <label className={styles.globalSearchLabel}>
            Rechercher une carte dans toutes les séries
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom du Pokémon, par exemple Pikachu…" />
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
                      <span className={styles.zoomHint} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.3" fill="none" stroke="currentColor" strokeWidth="2.2"/><path d="m15.4 15.4 5.1 5.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>
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

          <section className={styles.filters} aria-label="Checklist de la série">
            <label className={styles.searchLabel}>
              Rechercher une carte
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Numéro ou nom…" />
            </label>
            <p className={styles.scope}>
              {visibleCards.length} carte{visibleCards.length > 1 ? 's' : ''} affichée{visibleCards.length > 1 ? 's' : ''} selon le filtre. Les ajouts se font depuis le Catalogue.
            </p>
          </section>

          {cardsLoading ? <p className={styles.status}>Chargement des cartes…</p> : (
            <section className={styles.masterChecklist} aria-label="Liste complète des cartes du Master Set">
              {!visibleCards.length && <div className={styles.emptyCollection}><p>{query.trim() ? 'Aucune carte ne correspond à cette recherche.' : collectionFilter === 'owned' ? 'Aucune carte de cette série dans cette collection pour le moment.' : 'Aucune carte ne correspond à ce filtre.'}</p><a className={styles.collectionCatalogueLink} href={'/catalogue/cartes' + (setId && setId !== ALL_SERIES_FILTER ? '?set=' + encodeURIComponent(setId) : '')}>Ajouter des cartes depuis le Catalogue →</a></div>}
              {visibleCards.map(card => {
                const targetVariants = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
                const cardImage = imageUrl(card)
                return <article className={styles.masterChecklistCard} key={card.id}>
                  <div className={styles.masterChecklistHead}>
                    <button
                      type="button"
                      className={styles.masterChecklistThumb}
                      aria-label={'Agrandir l’image de ' + card.card_name}
                      onClick={() => setZoomedCard({ ...card, seriesName: selectedSet?.set_name || '' })}
                      data-image-missing={!cardImage ? 'true' : undefined}
                    >
                      {cardImage
                        ? <img src={cardImage} alt={'Illustration de ' + card.card_name} loading="lazy" onError={event => { event.currentTarget.parentElement.dataset.imageMissing = 'true'; event.currentTarget.style.display = 'none' }} />
                        : <span aria-hidden="true">Image</span>}
                    </button>
                    <div className={styles.masterChecklistMeta}>
                      <span className={styles.masterChecklistNumber}>N° {card.collector_number}</span>
                      <h2 className={styles.masterChecklistName}><button type="button" className={styles.masterChecklistNameButton} onClick={() => setZoomedCard({ ...card, seriesName: selectedSet?.set_name || '' })} aria-label={'Voir la carte ' + card.card_name}>{card.card_name}</button></h2>
                      <span className={styles.masterChecklistRarity}>{rarityDisplayLabel(card.rarity_label || 'Rareté à préciser')}</span>
                    </div>
                  </div>
                  {targetVariants.length ? (
                    <div className={styles.ownedVariantList} aria-label={'Versions possédées de ' + card.card_name}>
                      {targetVariants.map(variant => {
                        const quantity = (owned[variant.id] || []).length
                        const label = variant.variant_label || variant.variant_key || variant.finish_code || 'Version'
                        return <div className={styles.ownedVariantRow} key={variant.id}>
                          <span>{label}</span>
                          <strong className={quantity ? styles.ownedQuantity : styles.missingQuantity}>{quantity ? quantity + ' ex.' : 'Non possédée'}</strong>
                        </div>
                      })}
                    </div>
                  ) : <p className={styles.masterChecklistStatus}>Aucune variante de Master Set répertoriée.</p>}
                </article>
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
))
    if (match) return abbreviation + String(Number(match[1])) + match[2].toUpperCase()
  }
  return code.toUpperCase()
}

function seriesOptionLabel(set) {
  const abbreviation = seriesAbbreviation(set)
  const name = (set.set_name || '').replace(/Classique(?=30e)/i, 'Classique ')
  return (abbreviation ? abbreviation + ' — ' : '') + name + (set.is_public ? '' : ' · brouillon privé')
}

const RARITY_FILTERS = [
  { key: 'common', label: 'Commune' },
  { key: 'uncommon', label: 'Peu commune' },
  { key: 'rare', label: 'Rare' },
  { key: 'double', label: 'Double rare' },
  { key: 'ultra', label: 'Ultra rare' },
  { key: 'illustration', label: 'Illustration rare' },
  { key: 'specialIllustration', label: 'Illustration spéciale rare' },
  { key: 'hyper', label: 'Hyper rare' },
  { key: 'megaAttack', label: 'Méga attaque rare' },
  { key: 'megaHyper', label: 'Méga hyper rare' }
]

function rarityKey(label) {
  const value = (label || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '')
  if (value.includes('megaattack') || value.includes('attackmega')) return 'megaAttack'
  if (value.includes('megahyper') || value.includes('hypermega')) return 'megaHyper'
  if (value.includes('special') && value.includes('illustration')) return 'specialIllustration'
  if (value.includes('illustration')) return 'illustration'
  if (value.includes('double')) return 'double'
  if (value.includes('ultra')) return 'ultra'
  if (value.includes('hyper') || value.includes('secret')) return 'hyper'
  if (value.includes('uncommon') || value.includes('peucommune')) return 'uncommon'
  if (value === 'common' || value === 'commune') return 'common'
  if (value.includes('rare')) return 'rare'
  return ''
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
    'Hyper rare': 'Hyper rare',
    'Mega Attack Rare': 'Méga attaque rare',
    'Méga attaque rare': 'Méga attaque rare',
    'Mega Hyper Rare': 'Méga hyper rare',
    'Méga Hyper Rare': 'Méga hyper rare'
  }
  return labels[label] || label
}

function RarityFilterIcon({ rarityKey: type }) {
  const star = '16,2 19.6,11 29,11.5 21.8,17.5 24.4,27 16,21.5 7.6,27 10.2,17.5 3,11.5 12.4,11'
  let mark

  switch (type) {
    case 'common':
      mark = <circle cx="16" cy="16" r="6.5" fill="#111"/>
      break
    case 'uncommon':
      mark = <polygon points="16,5 27,16 16,27 5,16" fill="#111"/>
      break
    case 'rare':
      mark = <polygon points={star} fill="#fff" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>
      break
    case 'double':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#111"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#111"/></>
      break
    case 'ultra':
      mark = <polygon points={star} fill="#f3bd18" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
      break
    case 'illustration':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#a7adb4" stroke="#fff" strokeWidth="1"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#a7adb4" stroke="#fff" strokeWidth="1"/></>
      break
    case 'specialIllustration':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#f4bd16" stroke="#fff" strokeWidth="1"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#f4bd16" stroke="#fff" strokeWidth="1"/></>
      break
    case 'hyper':
      mark = <><polygon points="16,3 19.4,11.5 28,12 21.4,17.8 23.4,26 16,21.5 8.6,26 10.6,17.8 4,12 12.6,11.5" fill="#f3c21b" stroke="#151515" strokeWidth="1.6"/><path d="m16 7 1.8 6.1 6.2.3-4.8 4 1.4 6-5.2-3.3-5.2 3.3 1.4-6-4.8-4 6.2-.3L16 7Z" fill="#fff1a8"/></>
      break
    case 'megaAttack':
      mark = <><polygon points="10,5 11.8,9 16,9.3 12.8,12 13.8,16 10,13.8 6.2,16 7.2,12 4,9.3 8.2,9" fill="#e98ac8"/><polygon points="22,14 23.8,18 28,18.3 24.8,21 25.8,25 22,22.8 18.2,25 19.2,21 16,18.3 20.2,18" fill="#72c98a"/></>
      break
    case 'megaHyper':
      mark = <><polygon points="16,3 27,16 16,29 5,16" fill="#f1c72c" stroke="#9d7c11" strokeWidth="1.5" strokeLinejoin="round"/><polygon points="16,8 17.8,13 23,13.3 19,16.5 20.5,22 16,19 11.5,22 13,16.5 9,13.3 14.2,13" fill="#fff8d6"/></>
      break
    default:
      mark = <polygon points={star} fill="#fff" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>
  }

  return <span className={styles.filterIcon + ' ' + styles.rarityFilterIcon} aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false">{mark}</svg>
  </span>
}

function elementTypeKey(label) {
  const normalized = (label || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '')
  const aliases = {
    grass: 'grass', plante: 'grass',
    fire: 'fire', feu: 'fire',
    water: 'water', eau: 'water',
    lightning: 'lightning', electric: 'lightning', electrik: 'lightning', electrique: 'lightning', electricite: 'lightning',
    psychic: 'psychic', psy: 'psychic',
    fighting: 'fighting', combat: 'fighting',
    darkness: 'darkness', obscurite: 'darkness', tenebres: 'darkness',
    metal: 'metal', acier: 'metal',
    dragon: 'dragon',
    fairy: 'fairy', fee: 'fairy',
    colorless: 'colorless', incolore: 'colorless', normal: 'colorless',
    special: 'special', energiespeciale: 'special'
  }
  return aliases[normalized] || 'colorless'
}

function elementTypeColor(type) {
  return {
    grass: '#36a852', fire: '#ed493b', water: '#3198e8', lightning: '#f0c629',
    psychic: '#995acb', fighting: '#e66a35', darkness: '#28364b', metal: '#828c98',
    dragon: '#d98b2b', fairy: '#ed91ca', colorless: '#9ba4ae', special: '#a05caa'
  }[type]
}

function ElementTypeIcon({ label }) {
  const type = elementTypeKey(label)
  const fill = elementTypeColor(type)
  let mark

  switch (type) {
    case 'grass':
      mark = <><path d="M8 22C8 11 14 6 25 6c0 11-5 17-16 17Z" fill="#fff"/><path d="M9 23 21 11" fill="none" stroke={fill} strokeWidth="1.8" strokeLinecap="round"/></>
      break
    case 'fire':
      mark = <path d="M17 5c1 5-3 6-2 10 1-2 3-3 4-5 4 4 6 7 4 11-1 3-4 5-8 5-5 0-8-3-8-7 0-4 3-7 6-10 0 3 1 4 2 5 2-3 2-6 2-9Z" fill="#fff"/>
      break
    case 'water':
      mark = <path d="M16 5C13 10 8 15 8 19a8 8 0 0 0 16 0c0-4-5-9-8-14Z" fill="#fff"/>
      break
    case 'lightning':
      mark = <path d="M18 4 8 17h7l-1 11 10-15h-7l1-9Z" fill="#fff"/>
      break
    case 'psychic':
      mark = <><path d="M4.5 16s4-7 11.5-7 11.5 7 11.5 7-4 7-11.5 7S4.5 16 4.5 16Z" fill="#fff"/><circle cx="16" cy="16" r="4" fill={fill}/><circle cx="16" cy="16" r="1.8" fill="#fff"/></>
      break
    case 'fighting':
      mark = <path d="M8 15h3v-5c0-2.5 3.5-2.5 3.5 0v4-7c0-2.5 3.5-2.5 3.5 0v7-5c0-2.5 3.5-2.5 3.5 0v6l1-2c1-2 3.7-.8 3 1.4l-1.8 5.4A6 6 0 0 1 18 24h-3c-2.3 0-4-1-5-3l-3-3c-1.4-1.4-.5-3 1-3Z" fill="#fff"/>
      break
    case 'darkness':
      mark = <><circle cx="17" cy="16" r="9" fill="#fff"/><circle cx="21" cy="12" r="8" fill={fill}/></>
      break
    case 'metal':
      mark = <><path d="m16 6 8 5v10l-8 5-8-5V11l8-5Z" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="16" cy="16" r="3" fill="#fff"/></>
      break
    case 'dragon':
      mark = <><path d="m5 19 8-12 3 7 5-8 6 13-9-3-7 6-6-3Z" fill="#fff"/><circle cx="19" cy="15" r="1" fill={fill}/></>
      break
    case 'special':
      mark = <><path d="m16 6 2.8 6.4 6.9.6-5.2 4.5 1.6 6.7-6.1-3.6-6.1 3.6 1.6-6.7-5.2-4.5 6.9-.6L16 6Z" fill="#fff"/><circle cx="16" cy="16" r="2" fill={fill}/></>
      break
    case 'fairy':
      mark = <><path d="m16 5 2.7 7 7.3 1-5.4 4.7 1.7 7.2-6.3-3.8-6.3 3.8 1.7-7.2L4 13l7.3-1L16 5Z" fill="#fff"/><circle cx="16" cy="16" r="2" fill={fill}/></>
      break
    default:
      mark = <path d="m16 5 3.2 7.1 7.8.7-5.9 5.1 1.8 7.6-6.9-4.1-6.9 4.1 1.8-7.6-5.9-5.1 7.8-.7L16 5Z" fill="#fff"/>
  }

  return <span className={styles.filterIcon + ' ' + styles.energyFilterIcon} aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false">
      <circle cx="16" cy="16" r="15" fill={fill}/>
      <circle cx="11" cy="9" r="3" fill="#fff" opacity=".2"/>
      {mark}
    </svg>
  </span>
}

function elementTypeDisplayLabel(label) {
  const labels = {
    grass: 'Plante', fire: 'Feu', water: 'Eau', lightning: 'Électrique',
    psychic: 'Psy', fighting: 'Combat', darkness: 'Obscurité', metal: 'Métal',
    dragon: 'Dragon', fairy: 'Fée', colorless: 'Incolore', special: 'Énergie spéciale'
  }
  return labels[elementTypeKey(label)] || label
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
  const [collectionFilter, setCollectionFilter] = useState('owned')
  const [checklistFilter, setChecklistFilter] = useState('main')
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyVariant, setBusyVariant] = useState('')
  const [selectedVariantIds, setSelectedVariantIds] = useState([])
  const [savingBulk, setSavingBulk] = useState(false)
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
      setRarity(requestedRarity ? requestedRarity.split(',').map(rarityKey).filter(Boolean) : [])
      const requestedCollectionFilter = params.get('collection') || 'owned'
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
      if (requestedSetId === ALL_SERIES_FILTER) setSetId(ALL_SERIES_FILTER)
      else if (availableSets.some(row => row.id === requestedSetId)) setSetId(requestedSetId)

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
  const rarities = RARITY_FILTERS
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
  const masterSetCards = useMemo(() => isCatalogOnlySet
    ? cards
    : cards.filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target)), [cards, isCatalogOnlySet])
  const checklistCards = isAllSeriesSelected ? cards : masterSetCards
  const baseFilteredCards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr')
    return checklistCards.filter(card => !normalized || (card.collector_number + ' ' + card.card_name).toLocaleLowerCase('fr').includes(normalized))
  }, [checklistCards, query])

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

  const visibleCards = baseFilteredCards.filter(card => matchesCollectionFilter(card, collectionFilter))
  const missingCardsForCopy = useMemo(
    () => baseFilteredCards.filter(card => matchesCollectionFilter(card, 'missing')),
    [baseFilteredCards, owned, checklistFilter, selectedVersions]
  )
  const missingCardNumbers = [...new Set(missingCardsForCopy.map(card => card.collector_number).filter(Boolean))]
  const formattedMissingCardNumbers = formatMissingCardNumbers(missingCardNumbers)

  const visibleTargetVariants = visibleCards.flatMap(card => (card.card_print_variants || []).filter(variant => isIncludedVariant(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && matchesVariantCollectionFilter(variant, collectionFilter)))
  const visibleMissingVariantIds = collectMissingTargetVariantIds(
    visibleCards.flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target)),
    owned
  )
  const visibleOwnedVariantCount = visibleTargetVariants.filter(variant => (owned[variant.id] || []).length > 0).length
  const selectedVariantCount = selectedVariantIds.length
  const selectedCardCount = masterSetCards.filter(card =>
    (card.card_print_variants || []).some(variant => variant.is_master_set_target && selectedVariantIds.includes(variant.id))
  ).length

  const targetVariants = cards.flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target))
  const cardsWithProgressTargets = cards.filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target))
  const ownedTargetCount = targetVariants.filter(variant => (owned[variant.id] || []).length > 0).length
  const completedCardCount = cardsWithProgressTargets.filter(card => {
    const targets = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
    return targets.every(variant => (owned[variant.id] || []).length > 0)
  }).length
  const completion = targetVariants.length ? Math.round(ownedTargetCount * 100 / targetVariants.length) : 0

  function selectSet(nextSetId) {
    setSetId(nextSetId)
    setSelectedVariantIds([])
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
    setSelectedVariantIds([])
    if (user) window.localStorage.setItem('pokevaleur-collection:' + user.id, nextProfileId)
  }

  function toggleVariantSelection(variant) {
    if (!variant?.is_master_set_target || (owned[variant.id] || []).length || savingBulk) return
    setSelectedVariantIds(current => current.includes(variant.id)
      ? current.filter(id => id !== variant.id)
      : [...current, variant.id])
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
        setSelectedVariantIds(current => current.filter(id => id !== variant.id))
        setNotice('Exemplaire brut ajouté à la collection.')
      }
    } catch (saveError) {
      setNotice('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setBusyVariant('')
    }
  }

  async function addSelectedVariants() {
    if (!user || !profileId || savingBulk) return
    const variantById = new Map(cards.flatMap(card => card.card_print_variants || []).map(variant => [variant.id, variant]))
    const cardByVariantId = new Map(cards.flatMap(card => (card.card_print_variants || []).map(variant => [variant.id, card.id])))
    const variantsToAdd = [...new Set(selectedVariantIds)]
      .map(id => variantById.get(id))
      .filter(variant => variant?.is_master_set_target && !(owned[variant.id] || []).length)
    if (!variantsToAdd.length) {
      setSelectedVariantIds([])
      setNotice('Aucune variante manquante à ajouter. Les doublons ont été ignorés.')
      return
    }

    const targetProfileId = profileId
    setSavingBulk(true)
    setNotice('')
    let addedCount = 0
    const addedCardIds = new Set()
    try {
      for (let offset = 0; offset < variantsToAdd.length; offset += 100) {
        const rows = variantsToAdd.slice(offset, offset + 100).map(variant => ({
          user_id: user.id,
          collection_profile_id: targetProfileId,
          card_print_variant_id: variant.id,
          ownership_type: 'raw'
        }))
        const { data, error: insertError } = await supabase.from('collection_cards').insert(rows)
          .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)')
        if (insertError) throw insertError
        addedCount += (data || []).length
        for (const copy of data || []) {
          const cardId = cardByVariantId.get(copy.card_print_variant_id)
          if (cardId) addedCardIds.add(cardId)
        }
        const addedIds = new Set((data || []).map(copy => copy.card_print_variant_id))
        setOwned(current => {
          const next = { ...current }
          for (const copy of data || []) next[copy.card_print_variant_id] = [...(next[copy.card_print_variant_id] || []), copy]
          return next
        })
        setSelectedVariantIds(current => current.filter(id => !addedIds.has(id)))
      }
      setNotice(addedCardIds.size + ' carte' + (addedCardIds.size > 1 ? 's ajoutées' : ' ajoutée') + ' à ta collection.')
    } catch (saveError) {
      setNotice(addedCardIds.size
        ? addedCardIds.size + ' carte(s) ajoutée(s) ; le reste n’a pas été enregistré : ' + (saveError.message || 'réessaie.')
        : 'Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setSavingBulk(false)
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
      setSelectedVariantIds(current => current.filter(id => id !== variant.id))
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
        <p className={styles.kicker}>Ma collection · Cartes</p>
        <h1>Mes cartes possédées</h1>
        <p>Consulte les impressions que tu possèdes et le nombre d’exemplaires. Pour ajouter une carte ou une variante, sélectionne-la dans le Catalogue.</p>
        <a className={styles.collectionCatalogueLink} href={'/catalogue/cartes' + (setId && setId !== ALL_SERIES_FILTER ? '?set=' + encodeURIComponent(setId) : '')}>Choisir des cartes dans le Catalogue →</a>
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
          <select value={profileId} onChange={event => selectProfile(event.target.value)} disabled={!profiles.length || savingBulk}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || (profile.profile_type === 'adult' ? 'Ma collection' : 'Collection familiale')}</option>)}
          </select>
        </label>
        {isAdmin && selectedSet && !selectedSet.is_public && <p className={styles.adminNote}>Série privée : visible ici pour la vérification administrateur uniquement.</p>}
      </section>

      {!sets.length && !error && <p className={styles.empty}>Aucune série de cartes n’est publiée pour le moment.</p>}
      {!isAllSeriesSelected && !selectedSet && !loading && <p className={styles.seriesPrompt}>Choisis une série pour afficher la liste complète de ses cartes de Master Set.</p>}
      {isAllSeriesSelected ? (
        <section className={styles.globalSearch} aria-label="Recherche dans toutes les séries">
          <label className={styles.globalSearchLabel}>
            Rechercher une carte dans toutes les séries
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom du Pokémon, par exemple Pikachu…" />
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
                      <span className={styles.zoomHint} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.3" fill="none" stroke="currentColor" strokeWidth="2.2"/><path d="m15.4 15.4 5.1 5.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>
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

          <section className={styles.filters} aria-label="Checklist de la série">
            <label className={styles.searchLabel}>
              Rechercher une carte
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Numéro ou nom…" />
            </label>
            <p className={styles.scope}>
              {visibleCards.length} carte{visibleCards.length > 1 ? 's' : ''} affichée{visibleCards.length > 1 ? 's' : ''} selon le filtre. Les ajouts se font depuis le Catalogue.
            </p>
          </section>

          {cardsLoading ? <p className={styles.status}>Chargement des cartes…</p> : (
            <section className={styles.masterChecklist} aria-label="Liste complète des cartes du Master Set">
              {!visibleCards.length && <div className={styles.emptyCollection}><p>{query.trim() ? 'Aucune carte ne correspond à cette recherche.' : collectionFilter === 'owned' ? 'Aucune carte de cette série dans cette collection pour le moment.' : 'Aucune carte ne correspond à ce filtre.'}</p><a className={styles.collectionCatalogueLink} href={'/catalogue/cartes' + (setId && setId !== ALL_SERIES_FILTER ? '?set=' + encodeURIComponent(setId) : '')}>Ajouter des cartes depuis le Catalogue →</a></div>}
              {visibleCards.map(card => {
                const targetVariants = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
                const cardImage = imageUrl(card)
                return <article className={styles.masterChecklistCard} key={card.id}>
                  <div className={styles.masterChecklistHead}>
                    <button
                      type="button"
                      className={styles.masterChecklistThumb}
                      aria-label={'Agrandir l’image de ' + card.card_name}
                      onClick={() => setZoomedCard({ ...card, seriesName: selectedSet?.set_name || '' })}
                      data-image-missing={!cardImage ? 'true' : undefined}
                    >
                      {cardImage
                        ? <img src={cardImage} alt={'Illustration de ' + card.card_name} loading="lazy" onError={event => { event.currentTarget.parentElement.dataset.imageMissing = 'true'; event.currentTarget.style.display = 'none' }} />
                        : <span aria-hidden="true">Image</span>}
                    </button>
                    <div className={styles.masterChecklistMeta}>
                      <span className={styles.masterChecklistNumber}>N° {card.collector_number}</span>
                      <h2 className={styles.masterChecklistName}><button type="button" className={styles.masterChecklistNameButton} onClick={() => setZoomedCard({ ...card, seriesName: selectedSet?.set_name || '' })} aria-label={'Voir la carte ' + card.card_name}>{card.card_name}</button></h2>
                      <span className={styles.masterChecklistRarity}>{rarityDisplayLabel(card.rarity_label || 'Rareté à préciser')}</span>
                    </div>
                  </div>
                  {targetVariants.length ? (
                    <div className={styles.ownedVariantList} aria-label={'Versions possédées de ' + card.card_name}>
                      {targetVariants.map(variant => {
                        const quantity = (owned[variant.id] || []).length
                        const label = variant.variant_label || variant.variant_key || variant.finish_code || 'Version'
                        return <div className={styles.ownedVariantRow} key={variant.id}>
                          <span>{label}</span>
                          <strong className={quantity ? styles.ownedQuantity : styles.missingQuantity}>{quantity ? quantity + ' ex.' : 'Non possédée'}</strong>
                        </div>
                      })}
                    </div>
                  ) : <p className={styles.masterChecklistStatus}>Aucune variante de Master Set répertoriée.</p>}
                </article>
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
