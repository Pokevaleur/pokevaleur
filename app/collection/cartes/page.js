'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import CardProvenanceButton from '../../components/card-provenance'
import styles from './cards.module.css'

const ALL_SERIES_FILTER = '__all_series__'
const ENERGY_SERIES_FILTER = '__energies_by_year__'
const ALL_LANGUAGES_FILTER = 'all'

function collectMissingTargetVariantIds(variants, ownedByVariant = {}) {
  const ids = new Set()
  for (const variant of variants || []) {
    if (!variant?.id || !variant.is_master_set_target) continue
    if ((ownedByVariant[variant.id] || []).length) continue
    ids.add(variant.id)
  }
  return [...ids]
}

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

function energyCollectionYear(card, variant) {
  const copyrightYear = Number(variant?.copyright_year)
  if (copyrightYear) return copyrightYear
  const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
  const setCode = String(set?.set_code || '').toLowerCase()
  const collectorNumber = Number(String(card?.collector_number || '').replace(/^0+/, ''))
  if (setCode === 'sve' && variant?.variant_key === 'catalog_base' && collectorNumber >= 9 && collectorNumber <= 16) return 2024
  return Number(String(set?.release_date || '').slice(0, 4)) || null
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

const SVE_ENERGY_IMAGE_HASHES = {
  '001': '76', '002': '3c', '003': 'a2', '004': '2f', '005': 'fc', '006': '9b',
  '007': '5a', '008': '85', '009': '1a', '010': '4e', '011': '5e', '012': '7b',
  '013': 'cd', '014': '80', '015': '2d', '016': 'bc', '017': 'eb', '018': '1f',
  '019': 'e9', '020': '74', '021': 'b7', '022': '90', '023': '23', '024': 'e7',
}

function sveEnergyImageUrl(card, set) {
  const cardSet = set || (Array.isArray(card?.card_sets) ? card.card_sets[0] : card?.card_sets)
  if (card?.card_type !== 'Énergie' || String(cardSet?.set_code || '').toLowerCase() !== 'sve') return ''
  const number = String(card?.collector_number || '').match(/\d+/)?.[0]?.padStart(3, '0')
  const hash = SVE_ENERGY_IMAGE_HASHES[number]
  if (!hash) return ''
  const filename = 'Carte_Écarlate_et_Violet_Énergie_de_base_' + number + '.png'
  return 'https://www.pokepedia.fr/images/' + hash[0] + '/' + hash + '/' + encodeURIComponent(filename)
}

function imageUrl(card, quality = 'low') {
  const energyImage = sveEnergyImageUrl(card)
  if (energyImage) return energyImage
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

function loadPdfArtwork(url) {
  if (!url || typeof window === 'undefined') return Promise.resolve(null)
  return new Promise(resolve => {
    const image = new Image()
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(value)
    }
    const timeout = window.setTimeout(() => finish(null), 5000)
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const maxSide = 520
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) return finish(null)
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        finish({ data: canvas.toDataURL('image/jpeg', 0.84), width: canvas.width, height: canvas.height })
      } catch { finish(null) }
    }
    image.onerror = () => finish(null)
    try { image.src = url } catch { finish(null) }
  })
}

function duplicateVariantsForCard(card, displayedOwned) {
  return (card?.card_print_variants || [])
    .map(variant => ({ variant, copies: displayedOwned[variant.id] || [] }))
    .filter(entry => entry.copies.length > 1)
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

function missingVariantLabel(variant) {
  const key = String(variant?.variant_key || '').toLocaleLowerCase('fr')
  const knownLabels = {
    standard: 'Normale', normal: 'Normale', reverse: 'Reverse', holo: 'Holo',
    holofoil: 'Holo', reverse_pokeball: 'Reverse Poké Ball', reverse_masterball: 'Reverse Master Ball',
    holo_cosmos: 'Holo Cosmos', cosmos_holo: 'Holo Cosmos', holo_galaxy: 'Holo Galaxy',
    holo_pattern: 'Holo à motif', catalog_base: 'Variante de base'
  }
  if (knownLabels[key]) return knownLabels[key]
  return variant?.variant_label || variant?.variant_key || variant?.finish_code || 'Autre variante'
}

function normalizeCardSearch(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function accentInsensitiveCardNamePattern(value) {
  const normalized = normalizeCardSearch(value)
  if (!normalized || !/[aeiouyc]/.test(normalized)) return null

  const pattern = [...normalized].map(character => {
    if (/[aeiouyc]/.test(character)) return '_'
    if (character === '%' || character === '_' || character === '\\') return '\\' + character
    return character
  }).join('')

  return '%' + pattern + '%'
}

function cardSearchText(card) {
  const artistNames = (card.card_illustrators || []).flatMap(link => {
    const illustrators = link.illustrators
    return Array.isArray(illustrators) ? illustrators.map(item => item?.name) : [illustrators?.name]
  }).filter(Boolean)
  return normalizeCardSearch([card.collector_number, card.card_name, ...(card.search_aliases || []), ...artistNames].join(' '))
}

function normalizeCollectionLanguage(value) {
  const language = String(value || 'FR').trim().toUpperCase().replace(/_/g, '-')
  if (language === 'JA' || language === 'JPN') return 'JP'
  if (language === 'ZH-HANT' || language === 'ZH-TW' || language === 'TW') return 'ZH-HANT'
  if (language === 'ZH-HANS' || language === 'ZH-CN' || language === 'CN') return 'ZH-HANS'
  return language || 'FR'
}

function collectionLanguageLabel(value) {
  const code = normalizeCollectionLanguage(value)
  const labels = {
    FR: 'Français', EN: 'Anglais', JP: 'Japonais', DE: 'Allemand', IT: 'Italien',
    ES: 'Espagnol', PT: 'Portugais', KO: 'Coréen', 'ZH-HANT': 'Chinois traditionnel',
    'ZH-HANS': 'Chinois simplifié'
  }
  return labels[code] || code
}

function ownedEditionRows(card, owned) {
  const set = Array.isArray(card?.card_sets) ? card.card_sets[0] : card?.card_sets
  const groups = new Map()
  for (const variant of card?.card_print_variants || []) {
    const label = variant.variant_label || variant.variant_key || variant.finish_code || 'Version'
    for (const copy of owned[variant.id] || []) {
      const language = normalizeCollectionLanguage(copy.edition_language_code || set?.language || 'FR')
      const editionName = copy.edition_set_name || set?.set_name || 'Série'
      const number = copy.edition_collector_number || card.collector_number
      const cardName = copy.edition_card_name || card.card_name
      const key = [language, editionName, number, cardName, label].join('|')
      const current = groups.get(key) || {
        language, editionName, number, cardName, variantLabel: label, quantity: 0
      }
      current.quantity += 1
      groups.set(key, current)
    }
  }
  return [...groups.values()]
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
  const [languageFilter, setLanguageFilter] = useState(ALL_LANGUAGES_FILTER)
  const [checklistFilter, setChecklistFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyVariant, setBusyVariant] = useState('')
  const [selectedVariantIds, setSelectedVariantIds] = useState([])
  const [savingBulk, setSavingBulk] = useState(false)
  const [duplicatePdfBusy, setDuplicatePdfBusy] = useState(false)
  const [duplicatePdfPreview, setDuplicatePdfPreview] = useState(null)
  const [gradingVariant, setGradingVariant] = useState('')
  const [savingGrade, setSavingGrade] = useState(false)
  const [zoomedCard, setZoomedCard] = useState(null)
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0)
  const lastForegroundRefreshRef = useRef(0)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const seriesPickerRef = useRef(null)

  function openCardZoom(card, seriesName = '') {
    const ownedVersions = (card.card_print_variants || []).map(variant => ({
      label: variant.variant_label || variant.variant_key || variant.finish_code || 'Version',
      quantity: (displayedOwned[variant.id] || []).length
    })).filter(version => version.quantity > 0)

    setZoomedCard({ ...card, seriesName, ownedVersions })
  }

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastForegroundRefreshRef.current < 1500) return
      lastForegroundRefreshRef.current = now
      setChecklistRefreshKey(key => key + 1)
    }
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () => {
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
    }
  }, [])

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
      const requestedLanguage = params.get('language')
      if (requestedLanguage) setLanguageFilter(requestedLanguage.toLowerCase() === ALL_LANGUAGES_FILTER ? ALL_LANGUAGES_FILTER : normalizeCollectionLanguage(requestedLanguage))
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
      if (requestedSetId === ALL_SERIES_FILTER || requestedSetId === ENERGY_SERIES_FILTER) setSetId(requestedSetId)
      else if (availableSets.some(row => row.id === requestedSetId)) setSetId(requestedSetId)
      else setSetId(ALL_SERIES_FILTER)

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
      const cardFields = 'id,card_set_id,collector_number,card_name,card_type,element_types,guide_category_label,guide_category_code,rarity_label,mechanic_label,image_url,image_source_url,guide_order,card_sets!cards_card_set_id_fkey(set_name,set_code,language,release_date),card_illustrators(illustrators(name)),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target,copyright_year)'
      let cardRows = []
      if (setId === ENERGY_SERIES_FILTER) {
        const energySetIds = sets.filter(row => row.is_public && row.language === 'FR').map(row => row.id)
        for (let offset = 0; ; offset += 500) {
          const { data, error: cardError } = await supabase.from('cards').select(cardFields)
            .in('card_set_id', energySetIds).eq('card_type', 'Énergie')
            .order('guide_order', { ascending: true }).range(offset, offset + 499)
          if (cardError) throw cardError
          cardRows = cardRows.concat(data || [])
          if (!data || data.length < 500) break
        }
      } else {
        const { data, error: cardError } = await supabase.from('cards').select(cardFields)
          .eq('card_set_id', setId).order('guide_order', { ascending: true })
        if (cardError) throw cardError
        cardRows = data || []
      }
      if (cancelled) return
      const copyRows = []
      const copyPageSize = 500
      for (let offset = 0; ; offset += copyPageSize) {
        const { data, error: copyError } = await supabase.from('collection_cards')
          .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,edition_language_code,edition_market_code,edition_set_name,edition_collector_number,edition_card_name,card_grading_companies(company_name,abbreviation)')
          .eq('collection_profile_id', profileId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + copyPageSize - 1)
        if (copyError) throw copyError
        copyRows.push(...(data || []))
        if (!data || data.length < copyPageSize) break
      }
      if (cancelled) return
      const ownership = {}
      for (const copy of copyRows) {
        if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
        ownership[copy.card_print_variant_id].push(copy)
      }
      setCards(cardRows || [])
      setOwned(ownership)
    }
    loadChecklist().catch(loadError => { if (!cancelled) setError(loadError.message || 'Impossible de charger les cartes.') })
      .finally(() => { if (!cancelled) setCardsLoading(false) })
    return () => { cancelled = true }
  }, [supabase, setId, profileId, checklistRefreshKey, sets])

  useEffect(() => {
    if (!profileId || (setId !== ALL_SERIES_FILTER && setId !== '')) return
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
        const pattern = '%' + escapedTerm + '%'
        const fields = 'id,card_set_id,collector_number,card_name,card_type,element_types,rarity_label,image_url,image_source_url,card_sets!cards_card_set_id_fkey(set_name,set_code,language),card_illustrators(illustrators(name)),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target)'
        const accentNamePattern = accentInsensitiveCardNamePattern(term)
        const [nameResult, numberResult, accentNameResult] = await Promise.all([
          supabase.from('cards').select(fields).in('card_set_id', searchableSetIds)
            .ilike('card_name', pattern).order('card_name', { ascending: true }).limit(500),
          supabase.from('cards').select(fields).in('card_set_id', searchableSetIds)
            .ilike('collector_number', pattern).order('card_name', { ascending: true }).limit(500),
          accentNamePattern
            ? supabase.from('cards').select(fields).in('card_set_id', searchableSetIds)
              .ilike('card_name', accentNamePattern).order('card_name', { ascending: true }).limit(500)
            : Promise.resolve({ data: [], error: null })
        ])
        if (nameResult.error) throw nameResult.error
        if (numberResult.error) throw numberResult.error
        if (accentNameResult.error) throw accentNameResult.error
        if (cancelled) return
        const artistCardIds = new Set()
        for (let offset = 0; artistCardIds.size < 500; offset += 1000) {
          const { data: artistLinks, error: artistError } = await supabase.from('card_illustrators')
            .select('card_id,illustrators!inner(name)')
            .ilike('illustrators.name', pattern)
            .order('card_id', { ascending: true })
            .range(offset, offset + 999)
          if (artistError) throw artistError
          for (const link of artistLinks || []) artistCardIds.add(link.card_id)
          if (!artistLinks || artistLinks.length < 1000) break
        }
        let artistRows = []
        const artistIds = [...artistCardIds]
        for (let offset = 0; offset < artistIds.length; offset += 100) {
          const { data, error: artistCardError } = await supabase.from('cards')
            .select(fields).in('card_set_id', searchableSetIds).in('id', artistIds.slice(offset, offset + 100))
            .order('card_name', { ascending: true }).limit(500)
          if (artistCardError) throw artistCardError
          artistRows = artistRows.concat(data || [])
        }
        const cardsById = new Map()
        for (const card of [...(nameResult.data || []), ...(numberResult.data || []), ...(accentNameResult.data || []), ...artistRows]) cardsById.set(card.id, card)

        const { data: editionNameRows, error: editionNameError } = await supabase.from('collection_cards')
          .select('card_print_variant_id')
          .eq('collection_profile_id', profileId)
          .ilike('edition_card_name', pattern)
          .limit(500)
        if (editionNameError) throw editionNameError
        const editionVariantIds = [...new Set((editionNameRows || []).map(row => row.card_print_variant_id).filter(Boolean))]
        if (editionVariantIds.length) {
          const { data: editionVariants, error: editionVariantError } = await supabase.from('card_print_variants')
            .select('id,card_id').in('id', editionVariantIds)
          if (editionVariantError) throw editionVariantError
          const canonicalCardIds = [...new Set((editionVariants || []).map(row => row.card_id).filter(Boolean))]
          if (canonicalCardIds.length) {
            const { data: editionCards, error: editionCardError } = await supabase.from('cards')
              .select(fields).in('card_set_id', searchableSetIds).in('id', canonicalCardIds)
              .order('card_name', { ascending: true }).limit(500)
            if (editionCardError) throw editionCardError
            for (const card of editionCards || []) cardsById.set(card.id, { ...card, search_aliases: [...(card.search_aliases || []), term] })
          }
        }
        const cardRows = [...cardsById.values()].sort((a, b) => a.card_name.localeCompare(b.card_name, 'fr')).slice(0, 500)
        const variantIds = cardRows.flatMap(card => (card.card_print_variants || []).map(variant => variant.id))
        let copyRows = []
        for (let offset = 0; offset < variantIds.length; offset += 100) {
          const { data, error: copyError } = await supabase.from('collection_cards')
            .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,edition_language_code,edition_market_code,edition_set_name,edition_collector_number,edition_card_name,card_grading_companies(company_name,abbreviation)')
            .eq('collection_profile_id', profileId).in('card_print_variant_id', variantIds.slice(offset, offset + 100))
          if (copyError) throw copyError
          copyRows = copyRows.concat(data || [])
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
  const isEnergyYearView = setId === ENERGY_SERIES_FILTER
  const energySeriesOption = { id: ENERGY_SERIES_FILTER, set_name: 'Énergies · par année', set_code: '', language: 'FR', is_public: true }
  const selectedSet = isEnergyYearView ? energySeriesOption : sets.find(row => row.id === setId)
  const displayedOwned = useMemo(() => {
    if (languageFilter === ALL_LANGUAGES_FILTER) return owned
    const fallbackByVariant = new Map()
    for (const card of cards) {
      const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
      const fallbackLanguage = set?.language || selectedSet?.language || 'FR'
      for (const variant of card.card_print_variants || []) fallbackByVariant.set(variant.id, fallbackLanguage)
    }
    const filtered = {}
    for (const [variantId, copies] of Object.entries(owned)) {
      const fallbackLanguage = fallbackByVariant.get(variantId) || selectedSet?.language || 'FR'
      filtered[variantId] = copies.filter(copy =>
        normalizeCollectionLanguage(copy.edition_language_code || fallbackLanguage) === languageFilter
      )
    }
    return filtered
  }, [owned, languageFilter, cards, selectedSet])
  const languageOptions = useMemo(() => {
    const known = ['FR', 'EN', 'JP', 'DE', 'IT', 'ES', 'PT', 'KO', 'ZH-HANT', 'ZH-HANS']
    const observed = Object.values(owned).flat().map(copy => normalizeCollectionLanguage(copy.edition_language_code))
    const fromSets = sets.map(set => normalizeCollectionLanguage(set.language))
    return [...new Set([...known, ...fromSets, ...observed])].filter(Boolean)
      .sort((a, b) => (known.indexOf(a) < 0 ? 999 : known.indexOf(a)) - (known.indexOf(b) < 0 ? 999 : known.indexOf(b)) || a.localeCompare(b, 'fr'))
  }, [owned, sets])
  const isGlobalSearchView = !isEnergyYearView && (isAllSeriesSelected || !selectedSet)
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
    const normalized = normalizeCardSearch(query.trim())
    return checklistCards.filter(card => !normalized || cardSearchText(card).includes(normalized))
  }, [checklistCards, query])

  function matchesVariantCollectionFilter(variant, filter) {
    const count = (displayedOwned[variant.id] || []).length
    if (filter === 'owned') return count > 0
    if (filter === 'missing') return count === 0
    if (filter === 'duplicates') return count > 1
    return true
  }

  function matchesCollectionFilter(card, filter) {
    const variants = (card.card_print_variants || []).filter(variant => !selectedVersions.length || selectedVersions.includes(variant.variant_key))
    if (filter === 'duplicates') {
      return variants.some(variant => (displayedOwned[variant.id] || []).length > 1)
    }
    const targets = variants.filter(isProgressTarget)
    return targets.some(variant => matchesVariantCollectionFilter(variant, filter))
  }

  const visibleCards = baseFilteredCards.filter(card => matchesCollectionFilter(card, collectionFilter))
  const energyYearGroups = useMemo(() => {
    if (!isEnergyYearView) return []
    const groups = new Map()
    for (const card of visibleCards) {
      const variants = (card.card_print_variants || []).filter(variant => collectionFilter === 'duplicates'
        ? (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && (displayedOwned[variant.id] || []).length > 1
        : isProgressTarget(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)))
      for (const variant of variants) {
        const year = energyCollectionYear(card, variant)
        if (!year) continue
        if (!groups.has(year)) groups.set(year, new Map())
        const entries = groups.get(year)
        if (!entries.has(card.id)) entries.set(card.id, { card, variantIds: [] })
        entries.get(card.id).variantIds.push(variant.id)
      }
    }
    return [...groups.entries()].sort(([a], [b]) => b - a).map(([year, entries]) => ({
      year,
      entries: [...entries.values()].sort((a, b) => {
        const aSet = Array.isArray(a.card.card_sets) ? a.card.card_sets[0] : a.card.card_sets
        const bSet = Array.isArray(b.card.card_sets) ? b.card.card_sets[0] : b.card.card_sets
        return String(bSet?.release_date || '').localeCompare(String(aSet?.release_date || ''))
          || String(a.card.collector_number || '').localeCompare(String(b.card.collector_number || ''), 'fr', { numeric: true })
          || String(a.card.card_name || '').localeCompare(String(b.card.card_name || ''), 'fr')
      })
    }))
  }, [isEnergyYearView, visibleCards, collectionFilter, selectedVersions, displayedOwned, isProgressTarget])
  const duplicateVariantRows = collectionFilter === 'duplicates'
    ? visibleCards.flatMap(card => duplicateVariantsForCard(card, displayedOwned)
      .filter(({ variant }) => !selectedVersions.length || selectedVersions.includes(variant.variant_key))
      .map(({ variant, copies }) => ({ card, variant, copies, availableCopies: copies.length - 1 })))
      .sort((a, b) => {
        const aSet = Array.isArray(a.card.card_sets) ? a.card.card_sets[0] : a.card.card_sets
        const bSet = Array.isArray(b.card.card_sets) ? b.card.card_sets[0] : b.card.card_sets
        return String(aSet?.set_name || '').localeCompare(String(bSet?.set_name || ''), 'fr')
          || String(a.card.card_name || '').localeCompare(String(b.card.card_name || ''), 'fr')
          || String(a.card.collector_number || '').localeCompare(String(b.card.collector_number || ''), 'fr', { numeric: true })
          || String(a.variant.variant_label || a.variant.variant_key || '').localeCompare(String(b.variant.variant_label || b.variant.variant_key || ''), 'fr')
      })
    : []
  const availableDuplicateCopyCount = duplicateVariantRows.reduce((sum, row) => sum + row.availableCopies, 0)
  const duplicateCardCount = new Set(duplicateVariantRows.map(row => row.card.id)).size
  const duplicateCardCountForPill = baseFilteredCards.filter(card => (card.card_print_variants || []).some(variant =>
    (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && (displayedOwned[variant.id] || []).length > 1
  )).length
  const duplicateDocumentTitle = isGlobalSearchView ? query.trim() : (selectedSet?.set_name || query.trim())
  const visibleOwnedCopyCount = visibleCards.reduce((total, card) => total +
    (card.card_print_variants || [])
      .filter(variant => variant.is_master_set_target)
      .reduce((cardTotal, variant) => cardTotal + (displayedOwned[variant.id] || []).length, 0), 0
  )
  const missingVariantRows = cards.flatMap(card => (card.card_print_variants || [])
    .filter(variant => isProgressTarget(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && !(displayedOwned[variant.id] || []).length)
    .map(variant => ({ card, variant, label: missingVariantLabel(variant) })))
  const missingCardsForCopy = collectionFilter === 'missing' && isGlobalSearchView
    ? visibleCards.map(card => {
      const cardMissingVariants = (card.card_print_variants || [])
        .filter(variant => isProgressTarget(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && !(displayedOwned[variant.id] || []).length)
      return { card, variants: cardMissingVariants }
    }).filter(entry => entry.variants.length)
      .sort((a, b) => {
        const aSet = Array.isArray(a.card.card_sets) ? a.card.card_sets[0] : a.card.card_sets
        const bSet = Array.isArray(b.card.card_sets) ? b.card.card_sets[0] : b.card.card_sets
        const aReleaseDate = sets.find(set => set.id === a.card.card_set_id)?.release_date || ''
        const bReleaseDate = sets.find(set => set.id === b.card.card_set_id)?.release_date || ''
        return (aReleaseDate && bReleaseDate ? aReleaseDate.localeCompare(bReleaseDate) : aReleaseDate ? -1 : bReleaseDate ? 1 : 0)
          || String(aSet?.set_name || '').localeCompare(String(bSet?.set_name || ''), 'fr')
          || String(a.card.collector_number || '').localeCompare(String(b.card.collector_number || ''), 'fr', { numeric: true })
          || String(a.card.card_name || '').localeCompare(String(b.card.card_name || ''), 'fr')
      })
    : []
  const missingVariantGroups = [...new Map(missingVariantRows.map(row => [row.variant.variant_key, {
    key: row.variant.variant_key,
    label: row.label,
    rows: missingVariantRows.filter(candidate => candidate.variant.variant_key === row.variant.variant_key)
  }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  const visibleTargetVariants = visibleCards.flatMap(card => (card.card_print_variants || []).filter(variant => isProgressTarget(variant) && (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && matchesVariantCollectionFilter(variant, collectionFilter)))
  const visibleMissingVariantIds = collectMissingTargetVariantIds(
    visibleCards.flatMap(card => (card.card_print_variants || []).filter(isProgressTarget)),
    owned
  )
  const visibleOwnedVariantCount = visibleTargetVariants.filter(variant => (displayedOwned[variant.id] || []).length > 0).length
  const selectedVariantCount = selectedVariantIds.length
  const selectedCardCount = masterSetCards.filter(card =>
    (card.card_print_variants || []).some(variant => variant.is_master_set_target && selectedVariantIds.includes(variant.id))
  ).length

  const targetVariants = cards.flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target))
  const cardsWithProgressTargets = cards.filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target))
  const ownedTargetCount = targetVariants.filter(variant => (displayedOwned[variant.id] || []).length > 0).length
  const selectedSetVariantIds = new Set(cards.flatMap(card => card.card_print_variants || []).map(variant => variant.id))
  const ownedCopyCount = Object.entries(displayedOwned).reduce((sum, [variantId, copies]) =>
    sum + (selectedSetVariantIds.has(variantId) ? copies.length : 0), 0
  )
  const completedCardCount = cardsWithProgressTargets.filter(card => {
    const targets = (card.card_print_variants || []).filter(variant => variant.is_master_set_target)
    return targets.every(variant => (displayedOwned[variant.id] || []).length > 0)
  }).length
  const completion = targetVariants.length ? Math.round(ownedTargetCount * 100 / targetVariants.length) : 0

  function selectSet(nextSetId) {
    setSetId(nextSetId)
    setSelectedVariantIds([])
    setRarity([])
    setSelectedCardTypes([])
    setSelectedElementTypes([])
    setSelectedVersions([])
    setCollectionFilter('owned')
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
    if (nextFilter === 'all' || nextFilter === 'missing') setLanguageFilter(ALL_LANGUAGES_FILTER)
    const url = new URL(window.location.href)
    if (nextFilter === 'all') url.searchParams.delete('collection')
    else url.searchParams.set('collection', nextFilter)
    url.searchParams.delete('owned')
    if (nextFilter === 'all' || nextFilter === 'missing') url.searchParams.delete('language')
    window.history.replaceState({}, '', url)
  }

  function selectLanguage(nextLanguage) {
    setLanguageFilter(nextLanguage)
    if (collectionFilter === 'all' || collectionFilter === 'missing') setCollectionFilter('owned')
    const url = new URL(window.location.href)
    if (nextLanguage === ALL_LANGUAGES_FILTER) url.searchParams.delete('language')
    else url.searchParams.set('language', nextLanguage)
    if (collectionFilter === 'all' || collectionFilter === 'missing') url.searchParams.set('collection', 'owned')
    window.history.replaceState({}, '', url)
  }

  async function copyDuplicateCardNumbers() {
    if (!duplicateVariantRows.length) {
      setNotice('Aucun exemplaire en double dans les résultats.')
      return
    }
    const lines = duplicateVariantRows.map(({ card, variant, availableCopies }) => {
      const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
      const label = variant.variant_label || variant.variant_key || 'Variante'
      return [set?.set_code || set?.set_name, card.collector_number, card.card_name + ' · ' + label, availableCopies + ' en double'].filter(Boolean).join(' · ')
    })
    const textToCopy = lines.join('\n')
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
      setNotice(duplicateVariantRows.length + ' variante' + (duplicateVariantRows.length === 1 ? '' : 's') + ' en double copiée' + (duplicateVariantRows.length === 1 ? '' : 's') + '.')
    } catch (copyError) {
      setNotice('Copie impossible : ' + (copyError.message || 'sélectionne les numéros manuellement.'))
    }
  }

  async function createDuplicateBinderPdf() {
    if (!duplicateVariantRows.length || duplicatePdfBusy) return
    setDuplicatePdfBusy(true)
    setNotice('')
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imageUrls = [...new Set(duplicateVariantRows.map(row => imageUrl(row.card, 'high')).filter(Boolean))]
      const artworkByUrl = new Map()
      for (let offset = 0; offset < imageUrls.length; offset += 10) {
        const batch = await Promise.all(imageUrls.slice(offset, offset + 10).map(async url => [url, await loadPdfArtwork(url)]))
        for (const [url, artwork] of batch) artworkByUrl.set(url, artwork)
      }

      pdf.setProperties({
        title: 'Mes doubles Pokémon · ' + duplicateDocumentTitle,
        subject: 'Cartes Pokémon disponibles à l’échange',
        author: profiles.find(profile => profile.id === profileId)?.display_name || 'PokéValeur',
        creator: 'PokéValeur'
      })
      pdf.setFillColor(15, 31, 54)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      pdf.setFillColor(245, 184, 46)
      pdf.rect(0, 0, pageWidth, 7, 'F')
      pdf.setTextColor(245, 184, 46)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('POKÉVALEUR · PARTAGE COLLECTION', pageWidth / 2, 36, { align: 'center' })
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(30)
      const coverTitle = pdf.splitTextToSize('Mes doubles · ' + duplicateDocumentTitle, pageWidth - 32)
      pdf.text(coverTitle.slice(0, 2), pageWidth / 2, 74, { align: 'center' })
      pdf.setDrawColor(245, 184, 46)
      pdf.setLineWidth(0.8)
      pdf.line(28, 103, pageWidth - 28, 103)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(13)
      pdf.setTextColor(224, 232, 241)
      pdf.text('Cartes proposées à l’échange', pageWidth / 2, 119, { align: 'center' })
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(28, 143, pageWidth - 56, 54, 5, 5, 'F')
      pdf.setTextColor(23, 54, 84)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(String(duplicateCardCount) + ' cartes différentes', pageWidth / 2, 163, { align: 'center' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(String(duplicateVariantRows.length) + ' variantes · ' + String(availableDuplicateCopyCount) + ' exemplaires en double', pageWidth / 2, 181, { align: 'center' })
      pdf.setTextColor(224, 232, 241)
      pdf.setFontSize(10)
      pdf.text('Les quantités proposées correspondent aux exemplaires au-delà d’un exemplaire conservé par variante.', pageWidth / 2, 225, { align: 'center', maxWidth: pageWidth - 40 })
      pdf.setFontSize(9)
      pdf.text(new Date().toLocaleDateString('fr-FR'), pageWidth / 2, pageHeight - 18, { align: 'center' })

      const margin = 12
      const columnGap = 6
      const cardWidth = (pageWidth - margin * 2 - columnGap) / 2
      const cardHeight = 77
      const rowGap = 7
      const firstY = 31
      for (let index = 0; index < duplicateVariantRows.length; index += 1) {
        const position = index % 6
        if (position === 0) {
          pdf.addPage()
          pdf.setFillColor(247, 249, 252)
          pdf.rect(0, 0, pageWidth, pageHeight, 'F')
          pdf.setFillColor(15, 31, 54)
          pdf.rect(0, 0, pageWidth, 23, 'F')
          pdf.setTextColor(255, 255, 255)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(12)
          pdf.text('MES DOUBLES · ' + duplicateDocumentTitle, margin, 15)
        }
        const row = duplicateVariantRows[index]
        const column = position % 2
        const rowIndex = Math.floor(position / 2)
        const x = margin + column * (cardWidth + columnGap)
        const y = firstY + rowIndex * (cardHeight + rowGap)
        const set = Array.isArray(row.card.card_sets) ? row.card.card_sets[0] : row.card.card_sets
        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(218, 225, 234)
        pdf.setLineWidth(0.35)
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD')
        const url = imageUrl(row.card, 'high')
        const artwork = url ? artworkByUrl.get(url) : null
        const imageBox = { x: x + 5, y: y + 7, width: 27, height: 39 }
        if (artwork) {
          const scale = Math.min(imageBox.width / artwork.width, imageBox.height / artwork.height)
          const imageWidth = artwork.width * scale
          const imageHeight = artwork.height * scale
          try { pdf.addImage(artwork.data, 'JPEG', imageBox.x + (imageBox.width - imageWidth) / 2, imageBox.y + (imageBox.height - imageHeight) / 2, imageWidth, imageHeight) } catch { /* Keep the card readable if a remote image cannot be embedded. */ }
        } else {
          pdf.setFillColor(240, 243, 247)
          pdf.roundedRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height, 2, 2, 'F')
          pdf.setTextColor(128, 139, 153)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7)
          pdf.text('Image', imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2, { align: 'center' })
        }
        const textX = x + 36
        const textWidth = cardWidth - 41
        pdf.setTextColor(23, 39, 57)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        const cardTitle = pdf.splitTextToSize(row.card.card_name || 'Carte Pokémon', textWidth)
        pdf.text(cardTitle.slice(0, 2), textX, y + 12)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(91, 105, 121)
        const seriesLine = pdf.splitTextToSize((set?.set_code ? set.set_code + ' · ' : '') + (set?.set_name || 'Série') + ' · N° ' + (row.card.collector_number || '—'), textWidth)
        pdf.text(seriesLine.slice(0, 2), textX, y + 24)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(49, 68, 91)
        const variantLines = pdf.splitTextToSize(row.variant.variant_label || row.variant.variant_key || 'Variante', textWidth)
        pdf.text(variantLines.slice(0, 2), textX, y + 37)
        pdf.setFillColor(239, 247, 241)
        pdf.roundedRect(textX - 1, y + 53, textWidth + 2, 16, 2, 2, 'F')
        pdf.setTextColor(37, 103, 69)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.text(String(row.availableCopies) + ' exemplaire' + (row.availableCopies === 1 ? '' : 's') + ' en double', textX + 2, y + 63)
      }
      for (let pageIndex = 1; pageIndex < pdf.getNumberOfPages(); pageIndex += 1) {
        pdf.setPage(pageIndex + 1)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(115, 127, 143)
        pdf.text('PokéValeur · ' + (pageIndex + 1) + '/' + pdf.getNumberOfPages(), pageWidth - 12, pageHeight - 8, { align: 'right' })
      }
      const slug = normalizeCardSearch(query).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection'
      const file = new File([pdf.output('blob')], 'pokevaleur-doubles-' + slug + '.pdf', { type: 'application/pdf' })
      const previewUrl = URL.createObjectURL(file)
      const previewRows = duplicateVariantRows.map(row => {
        const set = Array.isArray(row.card.card_sets) ? row.card.card_sets[0] : row.card.card_sets
        const url = imageUrl(row.card, 'high')
        const artwork = url ? artworkByUrl.get(url) : null
        return {
          name: row.card.card_name || 'Carte Pokémon',
          number: row.card.collector_number || '—',
          setCode: set?.set_code || '',
          setName: set?.set_name || 'Série',
          variant: row.variant.variant_label || row.variant.variant_key || 'Variante',
          copies: row.availableCopies,
          image: artwork?.data || url || ''
        }
      })
      setDuplicatePdfPreview({
        file,
        url: previewUrl,
        title: duplicateDocumentTitle,
        date: new Date().toLocaleDateString('fr-FR'),
        cardCount: duplicateCardCount,
        variantCount: duplicateVariantRows.length,
        copyCount: availableDuplicateCopyCount,
        rows: previewRows
      })
      setNotice('Aperçu prêt : vérifie les cartes et quantités avant de partager ou télécharger le PDF.')
    } catch (pdfError) {
      setNotice('Impossible de créer le classeur PDF : ' + (pdfError.message || 'réessaie.'))
    } finally {
      setDuplicatePdfBusy(false)
    }
  }

  function closeDuplicatePdfPreview() {
    if (duplicatePdfPreview?.url) URL.revokeObjectURL(duplicatePdfPreview.url)
    setDuplicatePdfPreview(null)
  }

  function downloadDuplicatePdf() {
    if (!duplicatePdfPreview) return
    const link = document.createElement('a')
    link.href = duplicatePdfPreview.url
    link.download = duplicatePdfPreview.file.name
    link.click()
    setNotice('Ton classeur PDF a été téléchargé.')
  }

  async function shareDuplicatePdf() {
    if (!duplicatePdfPreview) return
    try {
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [duplicatePdfPreview.file] })) {
        await navigator.share({ files: [duplicatePdfPreview.file], title: 'Mes doubles · ' + duplicateDocumentTitle, text: 'Mes cartes Pokémon en double, disponibles à l’échange.' })
        setNotice('Ton classeur PDF a été partagé.')
        return
      }
      downloadDuplicatePdf()
      setNotice('Le partage de fichiers n’est pas disponible ici : le PDF a été téléchargé.')
    } catch (shareError) {
      if (shareError?.name === 'AbortError') {
        setNotice('Partage annulé. L’aperçu reste ouvert.')
        return
      }
      setNotice('Impossible de partager le PDF. Tu peux le télécharger depuis cet aperçu.')
    }
  }

  async function copyGlobalMissingCards() {
    if (!missingCardsForCopy.length) {
      setNotice('Aucune carte manquante dans les résultats.')
      return
    }
    const textToCopy = missingCardsForCopy.map(({ card, variants }) => {
      const cardSet = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
      const missingLabels = [...new Set(variants.map(missingVariantLabel))]
      return 'N° ' + card.collector_number + ' — ' + card.card_name + ' — ' + (cardSet?.set_name || 'Série inconnue') + ' — Manque : ' + missingLabels.join(', ')
    }).join('\n')
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
      setNotice(missingCardsForCopy.length + ' carte' + (missingCardsForCopy.length > 1 ? 's' : '') + ' manquante' + (missingCardsForCopy.length > 1 ? 's' : '') + ' copiée' + (missingCardsForCopy.length > 1 ? 's' : '') + ', avec les variantes.')
    } catch (copyError) {
      setNotice('Copie impossible : ' + (copyError.message || 'sélectionne les cartes manuellement.'))
    }
  }

  async function copyMissingCardNumbers(variantKey = null) {
    const rows = variantKey
      ? missingVariantRows.filter(row => row.variant.variant_key === variantKey)
      : missingVariantRows
    if (!rows.length) {
      setNotice('Aucune variante manquante dans cette série avec les filtres actuels.')
      return
    }
    const numbers = [...new Set(rows.map(row => row.card.collector_number).filter(Boolean))]
    const textToCopy = variantKey
      ? formatMissingCardNumbers(numbers)
      : rows.map(row => row.card.collector_number + ' (' + row.label + ')').join(', ')
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
      setNotice((variantKey ? numbers.length : rows.length) + ' variante' + ((variantKey ? numbers.length : rows.length) > 1 ? 's' : '') + ' manquante' + ((variantKey ? numbers.length : rows.length) > 1 ? 's' : '') + ' copiée' + ((variantKey ? numbers.length : rows.length) > 1 ? 's' : '') + '.')
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
    if (!variant?.is_master_set_target || (owned[variant.id] || []).length || savingBulk)
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

  function removeOneCopy(variant) {
    const copies = owned[variant.id] || []
    const rawCopies = copies.filter(copy => copy.ownership_type === 'raw')
    if (rawCopies.length) {
      changeRawCopies(variant, 'remove')
      return
    }
    const gradedCopy = copies.find(copy => copy.ownership_type === 'graded')
    if (gradedCopy) removeGradedCopy(variant.id, gradedCopy)
  }

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement de la collection de cartes…</p></main>

  function renderChecklistCard(card, variantIds = null, year = null) {
    const targetVariants = (card.card_print_variants || []).filter(variant =>
      (!variantIds || variantIds.includes(variant.id)) && (collectionFilter === 'duplicates'
        ? (!selectedVersions.length || selectedVersions.includes(variant.variant_key)) && (displayedOwned[variant.id] || []).length > 1
        : variant.is_master_set_target)
    )
    const cardImage = imageUrl(card)
    return <article className={styles.masterChecklistCard} key={card.id + (year ? '-' + year : '')}>
      <div className={styles.masterChecklistHead}>
        <button type="button" className={styles.masterChecklistThumb} aria-label={'Agrandir l’image de ' + card.card_name} onClick={() => openCardZoom(card, selectedSet?.set_name || '')} data-image-missing={!cardImage ? 'true' : undefined}>
          {cardImage ? <img src={cardImage} alt={'Illustration de ' + card.card_name} loading="lazy" onError={event => { event.currentTarget.parentElement.dataset.imageMissing = 'true'; event.currentTarget.style.display = 'none' }} /> : <span aria-hidden="true">Image</span>}
        </button>
        <div className={styles.masterChecklistMeta}>
          <span className={styles.masterChecklistNumber}>N° {card.collector_number}</span>
          <h2 className={styles.masterChecklistName}><button type="button" className={styles.masterChecklistNameButton} onClick={() => openCardZoom(card, selectedSet?.set_name || '')} aria-label={'Voir la carte ' + card.card_name}>{card.card_name}</button></h2>
          <span className={styles.masterChecklistRarity}>{rarityDisplayLabel(card.rarity_label || 'Rareté à préciser')}</span>
        </div>
      </div>
      {targetVariants.length ? <div className={styles.ownedVariantList} aria-label={'Versions possédées de ' + card.card_name}>
        {targetVariants.map(variant => {
          const quantity = (displayedOwned[variant.id] || []).length
          const label = variant.variant_label || variant.variant_key || variant.finish_code || 'Version'
          return <div className={styles.ownedVariantRow} key={variant.id}>
            <span>{label}</span>
            <strong className={quantity ? styles.ownedQuantity : styles.missingQuantity}>{quantity ? quantity + ' ex.' : 'Non possédée'}</strong>
            {quantity > 0 && <button type="button" className={styles.removeCopyButton} onClick={() => removeOneCopy(variant)} disabled={busyVariant === variant.id || savingBulk} aria-label={'Retirer un exemplaire de ' + card.card_name + ' (' + label + ')'} title="Retirer un exemplaire">−</button>}
          </div>
        })}
      </div> : <p className={styles.masterChecklistStatus}>Aucune variante de Master Set répertoriée.</p>}
    </article>
  }

  return (
    <main className={styles.page}>
      <div className={styles.topLine}>
        <a className={styles.backLink} href="/collection">← Ma collection</a>
        <span className={styles.privateBadge}>Espace membre</span>
      </div>
      <header className={styles.header}>
        <p className={styles.kicker}>Ma collection · Cartes</p>
        <h1>Mes cartes</h1>
        {selectedSet && !cardsLoading && !isCatalogOnlySet && <p className={styles.ownedSummary}>{ownedCopyCount} exemplaire{ownedCopyCount === 1 ? '' : 's'} possédé{ownedCopyCount === 1 ? '' : 's'} dans cette série</p>}
        <p>Choisis une série pour afficher tes cartes possédées, en double ou non possédées. Pour en ajouter, sélectionne-les dans le Catalogue.</p>
        <a className={styles.collectionCatalogueLink} href={'/catalogue/cartes' + (setId && setId !== ALL_SERIES_FILTER && setId !== ENERGY_SERIES_FILTER ? '?set=' + encodeURIComponent(setId) : '')}>Choisir des cartes dans le Catalogue →</a>
        <a className={styles.scannerLink} href="/collection/cartes/scanner"><span aria-hidden="true">📷</span> Scanner une carte</a>
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
                <button
                  type="button"
                  role="option"
                  aria-selected={isEnergyYearView}
                  className={isEnergyYearView ? styles.seriesPickerOptionActive : styles.seriesPickerOption}
                  onClick={() => { selectSet(ENERGY_SERIES_FILTER); setSeriesPickerOpen(false) }}
                >Énergies · par année</button>
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
        <label>
          Langue des cartes
          <select value={languageFilter} onChange={event => selectLanguage(event.target.value)} disabled={collectionFilter === 'all' || collectionFilter === 'missing'}>
            <option value={ALL_LANGUAGES_FILTER}>Toutes les langues</option>
            {languageOptions.map(language => <option key={language} value={language}>{collectionLanguageLabel(language)}</option>)}
          </select>
        </label>
        {isAdmin && selectedSet && !selectedSet.is_public && <p className={styles.adminNote}>Série privée : visible ici pour la vérification administrateur uniquement.</p>}
      </section>

      {(selectedSet || (isGlobalSearchView && query.trim())) && <div className={styles.collectionCardFilters} role="group" aria-label={isGlobalSearchView ? 'Filtrer les cartes recherchées dans le catalogue' : 'Filtrer les cartes de cette série'}>
        {(isGlobalSearchView
          ? [
            ['all', 'Toutes'],
            ['owned', 'Possédées'],
            ['missing', 'Manquantes'],
            ['duplicates', 'En double']
          ]
          : [
            ['owned', 'Possédées'],
            ['duplicates', 'En double'],
            ['missing', 'Non possédées']
          ]
        ).map(([filter, label]) => (
          <button
            key={filter}
            type="button"
            className={collectionFilter === filter ? styles.collectionCardFilterActive : styles.collectionCardFilter}
            aria-pressed={collectionFilter === filter}
            onClick={() => selectCollectionFilter(filter)}
            aria-label={filter === 'duplicates' ? 'En double, ' + duplicateCardCountForPill + ' cartes' : label}
          >{filter === 'duplicates' ? label + ' · ' + duplicateCardCountForPill : label}</button>
        ))}
      </div>}

      {selectedSet && collectionFilter === 'duplicates' && !cardsLoading && <section className={styles.duplicateSharePanel} aria-label="Partager les cartes en double de la série">
        <div>
          <strong>Partager les doubles de {selectedSet.set_name}</strong>
          <p>Le PDF présentera toutes les variantes en double de cette série, avec les exemplaires disponibles au-delà d’un exemplaire conservé.</p>
        </div>
        <div className={styles.duplicateShareActions}>
          <button type="button" className={styles.copyMissingButton} onClick={copyDuplicateCardNumbers} disabled={!duplicateVariantRows.length}>
            Copier les numéros ({duplicateVariantRows.length})
          </button>
          <button type="button" className={styles.duplicatePdfButton} onClick={createDuplicateBinderPdf} disabled={!duplicateVariantRows.length || duplicatePdfBusy}>
            {duplicatePdfBusy ? 'Création du classeur…' : 'Générer le classeur PDF'}
          </button>
        </div>
      </section>}

      {selectedSet && collectionFilter !== 'duplicates' && !isCatalogOnlySet && !cardsLoading && <section className={styles.copyMissingPanel} aria-label="Copier les variantes manquantes">
        <div>
          <strong>Copier les cartes manquantes</strong>
          <p>Choisis une action pour copier toutes les cartes manquantes ou seulement une variante.</p>
        </div>
        <div className={styles.copyMissingActions}>
          <button type="button" className={styles.copyMissingButton} onClick={() => copyMissingCardNumbers()} disabled={!missingVariantRows.length}>
            Copier toutes les manquantes ({missingVariantRows.length})
          </button>
          {missingVariantGroups.map(group => <button type="button" key={group.key} className={styles.copyMissingButton} onClick={() => copyMissingCardNumbers(group.key)}>
            Copier {group.label} ({group.rows.length})
          </button>)}
        </div>
      </section>}

      {!sets.length && !error && <p className={styles.empty}>Aucune série de cartes n’est publiée pour le moment.</p>}
      {!isAllSeriesSelected && !selectedSet && !loading && !query.trim() && <p className={styles.seriesPrompt}>Choisis une série pour afficher la liste complète de ses cartes de Master Set, ou lance une recherche dans ta collection.</p>}
      {isAllSeriesSelected || !selectedSet ? (
        <section className={styles.globalSearch} aria-label="Recherche dans la collection">
          <label className={styles.globalSearchLabel}>
            Rechercher dans ma collection
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, numéro ou artiste…" />
          </label>
          {isGlobalSearchView && query.trim() && <div className={styles.collectionCardFilters} role="group" aria-label="Filtrer les résultats de recherche">
            {[
              ['owned', 'Possédées'],
              ['duplicates', 'En double']
            ].map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                className={collectionFilter === filter ? styles.collectionCardFilterActive : styles.collectionCardFilter}
                aria-pressed={collectionFilter === filter}
                onClick={() => selectCollectionFilter(filter)}
              >{label}</button>
            ))}
          </div>}
          {!query.trim() && <p className={styles.scope}>Saisis un nom, un numéro ou un artiste pour retrouver tes cartes possédées, quelle que soit leur langue.</p>}
          {!!query.trim() && <p className={styles.resultCount} aria-live="polite">{collectionFilter === 'duplicates' && isGlobalSearchView
            ? <><strong>{duplicateCardCount}</strong> carte{duplicateCardCount === 1 ? '' : 's'} avec des doubles pour « {query.trim()} » · <strong>{availableDuplicateCopyCount}</strong> exemplaire{availableDuplicateCopyCount === 1 ? '' : 's'} en double</>
            : <><strong>{visibleCards.length}</strong> carte{visibleCards.length > 1 ? 's différentes' : ' différente'} pour « {query.trim()} » · <strong>{visibleOwnedCopyCount}</strong> exemplaire{visibleOwnedCopyCount > 1 ? 's possédés' : ' possédé'}</>
          }</p>}
          {isGlobalSearchView && query.trim() && collectionFilter === 'missing' && !cardsLoading && <section className={styles.copyMissingPanel} aria-label="Copier les cartes manquantes">
            <div>
              <strong>Copier les cartes manquantes</strong>
              <p>Une ligne par carte, avec ses variantes manquantes, triées par série de la plus ancienne à la plus récente.</p>
            </div>
            <div className={styles.copyMissingActions}>
              <button type="button" className={styles.copyMissingButton} onClick={copyGlobalMissingCards} disabled={!missingCardsForCopy.length}>
                Copier numéro, nom, série et variantes ({missingCardsForCopy.length})
              </button>
            </div>
          </section>}
          {cardsLoading ? <p className={styles.status}>Recherche dans toutes les séries…</p> : query.trim() && (
            <section className={styles.cardGrid} aria-label="Résultats toutes séries">
              {!visibleCards.length && !error && <p className={styles.empty}>Aucune carte ne correspond à « {query.trim()} ».</p>}
              {visibleCards.map(card => {
                const cardSet = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
                const cardImage = imageUrl(card)
                const editions = ownedEditionRows(card, displayedOwned)
                return <article className={styles.card} key={card.id}>
                  <div className={styles.cardTop}>
                    <div className={styles.artFrame}>
                      {cardImage && <button type="button" className={styles.artZoomButton} aria-label={'Agrandir l’image de ' + card.card_name} onClick={() => openCardZoom(card, cardSet?.set_name || '')}>
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
                  {editions.length > 0 && <div className={styles.ownedVariantList} aria-label={'Éditions possédées de ' + card.card_name}>
                    {editions.map((edition, index) => <div className={styles.ownedVariantRow} key={index}>
                      <span>{collectionLanguageLabel(edition.language)} · {edition.editionName} · N° {edition.number} · {edition.cardName} · {edition.variantLabel}</span>
                      <strong className={styles.ownedQuantity}>{edition.quantity} ex.</strong>
                    </div>)}
                  </div>}
                  {collectionFilter === 'duplicates' && isGlobalSearchView && duplicateVariantsForCard(card, displayedOwned).length > 0 && <div className={styles.duplicateVariantList} aria-label={'Variantes en double de ' + card.card_name}>
                    {duplicateVariantsForCard(card, displayedOwned).map(({ variant, copies }) => <div className={styles.duplicateVariantRow} key={variant.id}>
                      <span>{variant.variant_label || variant.variant_key || 'Variante'}</span>
                      <strong>{copies.length - 1} en double</strong>
                    </div>)}
                  </div>}
                </article>
              })}
            </section>
          )}
          {isGlobalSearchView && query.trim() && collectionFilter === 'duplicates' && !cardsLoading && <section className={styles.duplicateSharePanel} aria-label="Partager les cartes en double">
            <div>
              <strong>Partager ces doubles</strong>
              <p>Le PDF présente les cartes, leurs variantes et les exemplaires en plus d’un exemplaire conservé par variante.</p>
            </div>
            <div className={styles.duplicateShareActions}>
              <button type="button" className={styles.copyMissingButton} onClick={copyDuplicateCardNumbers} disabled={!duplicateVariantRows.length}>
                Copier les numéros ({duplicateVariantRows.length})
              </button>
              <button type="button" className={styles.duplicatePdfButton} onClick={createDuplicateBinderPdf} disabled={!duplicateVariantRows.length || duplicatePdfBusy}>
                {duplicatePdfBusy ? 'Création du classeur…' : 'Générer le classeur PDF'}
              </button>
            </div>
          </section>}
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
              <div><strong>{ownedTargetCount} / {targetVariants.length}</strong><span>{selectedSet.set_code === 'SV09' ? 'variantes Ultra Master possédées' : 'variantes possédées'}</span></div>
              <div><strong>{completedCardCount} / {cardsWithProgressTargets.length}</strong><span>cartes complètes</span></div>
              <strong className={styles.percent}>{completion}%</strong>
            </div>
            <div className={styles.progressTrack} role="progressbar" aria-valuenow={completion} aria-valuemin="0" aria-valuemax="100" aria-label={selectedSet.set_code === 'SV09' ? "Progression de l’Ultra Master Set" : "Progression de la checklist"}>
              <span style={{ width: completion + '%' }} />
            </div>
            {selectedSet.set_code === 'SV09' ? (
              <div className={styles.scope} aria-label="Périmètre retenu pour EV9">
                <p><strong>Cartes suivies :</strong> 190 cartes de la série + 9 promos françaises = 199.</p>
                <p><strong>Master Set :</strong> 333 variantes.</p>
                <p><strong>Ultra Master Set :</strong> 386 variantes maximum.</p>
              </div>
            ) : (
              <details className={styles.scopeDetails}>
                <summary>Détails du calcul</summary>
                <p className={styles.scope}>{selectedSet.checklist_scope_note} Les variantes (Normale, Reverse, tamponnée…) comptent séparément. Une carte est complète seulement lorsque toutes ses variantes sont possédées.</p>
              </details>
            )}
          </section>
          )}

          <section className={styles.filters} aria-label="Checklist de la série">
            <label className={styles.searchLabel}>
              Rechercher une carte
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, numéro ou artiste…" />
            </label>
            <p className={styles.scope}>
              {visibleCards.length} carte{visibleCards.length > 1 ? 's différentes' : ' différente'} affichée{visibleCards.length > 1 ? 's' : ''} selon le filtre · {visibleOwnedCopyCount} exemplaire{visibleOwnedCopyCount > 1 ? 's possédés' : ' possédé'} sur ces cartes. Les ajouts se font depuis le Catalogue.
            </p>
          </section>

          {cardsLoading ? <p className={styles.status}>Chargement des cartes…</p> : (
            <section className={styles.masterChecklist} aria-label="Liste complète des cartes du Master Set">
              {!visibleCards.length && <div className={styles.emptyCollection}><p>{query.trim() ? 'Aucune carte ne correspond à cette recherche.' : collectionFilter === 'owned' ? 'Aucune carte de cette série dans cette collection pour le moment.' : 'Aucune carte ne correspond à ce filtre.'}</p><a className={styles.collectionCatalogueLink} href={'/catalogue/cartes' + (setId && setId !== ALL_SERIES_FILTER && setId !== ENERGY_SERIES_FILTER ? '?set=' + encodeURIComponent(setId) : '')}>Ajouter des cartes depuis le Catalogue →</a></div>}
              {isEnergyYearView
                ? energyYearGroups.map(group => <div className={styles.energyYearGroup} key={'energy-year-' + group.year}>
                  <h2 className={styles.energyYearHeading}>{group.year}</h2>
                  {group.entries.map(({ card, variantIds }) => renderChecklistCard(card, variantIds, group.year))}
                </div>)
                : visibleCards.map(card => renderChecklistCard(card))}
            </section>
          )}
        </>
      )}
      {duplicatePdfPreview && <div className={styles.duplicatePdfBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDuplicatePdfPreview() }}>
        <section className={styles.duplicatePdfDialog} role="dialog" aria-modal="true" aria-labelledby="duplicate-pdf-title">
          <header className={styles.duplicatePdfHeader}>
            <div>
              <h2 id="duplicate-pdf-title">Aperçu de ton classeur</h2>
              <p>Vérifie les cartes et les quantités avant de l’envoyer.</p>
            </div>
            <button type="button" className={styles.duplicatePdfClose} aria-label="Fermer l’aperçu" onClick={closeDuplicatePdfPreview}>×</button>
          </header>
          <div className={styles.duplicatePdfPreviewContent} aria-label="Contenu du PDF des cartes en double">
            <section className={styles.duplicatePdfPreviewCover}>
              <span>POKÉVALEUR · PARTAGE COLLECTION</span>
              <h3>Mes doubles · {duplicatePdfPreview.title}</h3>
              <p>Cartes proposées à l’échange</p>
              <strong>{duplicatePdfPreview.cardCount} cartes différentes</strong>
              <small>{duplicatePdfPreview.variantCount} variantes · {duplicatePdfPreview.copyCount} exemplaires en double</small>
              <time>{duplicatePdfPreview.date}</time>
            </section>
            <section className={styles.duplicatePdfPreviewCards} aria-label="Cartes incluses dans le PDF">
              {duplicatePdfPreview.rows.map((row, index) => <article className={styles.duplicatePdfPreviewCard} key={index}>
                {row.image ? <img src={row.image} alt={'Illustration de ' + row.name} /> : <div className={styles.duplicatePdfPreviewNoImage}>Image indisponible</div>}
                <div className={styles.duplicatePdfPreviewCardInfo}>
                  <strong>{row.name}</strong>
                  <span>{row.setCode ? row.setCode + ' · ' : ''}{row.setName} · N° {row.number}</span>
                  <b>{row.variant}</b>
                  <em>{row.copies} exemplaire{row.copies === 1 ? '' : 's'} en double</em>
                </div>
              </article>)}
            </section>
          </div>
          <div className={styles.duplicatePdfFooter}>
            <button type="button" className={styles.duplicatePdfSecondary} onClick={downloadDuplicatePdf}>Télécharger le PDF</button>
            <button type="button" className={styles.duplicatePdfButton} onClick={shareDuplicatePdf}>Partager le PDF</button>
          </div>
        </section>
      </div>}
      {zoomedCard && <div className={styles.zoomBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setZoomedCard(null) }}>
        <section className={styles.zoomDialog} role="dialog" aria-modal="true" aria-label={'Image agrandie de ' + zoomedCard.card_name}>
          <button type="button" className={styles.zoomClose} aria-label="Fermer l’image agrandie" onClick={() => setZoomedCard(null)}>×</button>
          <img className={styles.zoomImage} src={imageUrl(zoomedCard, 'high')} alt={'Illustration agrandie de ' + zoomedCard.card_name} onError={event => { const fallback = imageUrl(zoomedCard, 'low'); if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback }} />
          <p><strong>{zoomedCard.card_name}</strong> · N° {zoomedCard.collector_number}{zoomedCard.seriesName ? ' · ' + zoomedCard.seriesName : ''}</p>
          {zoomedCard.ownedVersions?.length > 0 && <div className={styles.zoomOwnedVersions} aria-label={'Versions possédées de ' + zoomedCard.card_name}>
            <strong>Dans ma collection</strong>
            <ul>{zoomedCard.ownedVersions.map((version, index) => <li key={index}><span>{version.label}</span><b>{version.quantity} exemplaire{version.quantity > 1 ? 's' : ''}</b></li>)}</ul>
          </div>}
          <CardProvenanceButton supabase={supabase} cardId={zoomedCard.id} setCode={zoomedCard.card_sets?.set_code || selectedSet?.set_code || ''} collectorNumber={zoomedCard.collector_number} />
        </section>
      </div>}
    </main>
  )
}
