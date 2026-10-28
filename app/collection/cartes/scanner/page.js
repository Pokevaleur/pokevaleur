'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import styles from './scanner.module.css'

const TESSERACT_VERSION = '5.1.1'
const OCR_WORKER_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@' + TESSERACT_VERSION + '/dist/worker.min.js'
const OCR_CORE_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1'
const OCR_LANGUAGE_URL = 'https://tessdata.projectnaptha.com/4.0.0'
const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,card_type,rarity_label,image_url,image_source_url,card_sets!cards_card_set_id_fkey(set_name,set_code,language,release_date),card_print_variants(id,variant_key,variant_label,finish_code,is_master_set_target)'

function loadOcrLibrary() {
  if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract)
  if (window.pokevaleurOcrLibraryPromise) return window.pokevaleurOcrLibraryPromise

  window.pokevaleurOcrLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@' + TESSERACT_VERSION + '/dist/tesseract.min.js'
    script.async = true
    script.onload = () => window.Tesseract?.createWorker
      ? resolve(window.Tesseract)
      : reject(new Error('La bibliothèque de lecture de texte ne s’est pas chargée.'))
    script.onerror = () => reject(new Error('Impossible de charger la lecture de texte. Vérifie ta connexion puis réessaie.'))
    document.head.appendChild(script)
  }).catch(error => {
    window.pokevaleurOcrLibraryPromise = null
    throw error
  })

  return window.pokevaleurOcrLibraryPromise
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()
}

function normalizeCollectorToken(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '')
    .replace(/([a-z]*)([0-9oil]+)([a-z]*)/i, (_, prefix, digits, suffix) =>
      prefix + digits.replace(/o/g, '0').replace(/[il]/g, '1') + suffix)
}

function findCollectorNumbers(text) {
  const matches = [...String(text || '').matchAll(/\b([a-z]{0,4}[\dOIl]{1,5}[a-z]?)\s*[\/|\\]\s*([a-z]{0,4}[\dOIl]{1,5}[a-z]?)\b/gi)]
  return [...new Set(matches.map(match =>
    normalizeCollectorToken(match[1]) + '/' + normalizeCollectorToken(match[2])
  ))]
}

function fuzzySimilarity(left, right) {
  if (!left || !right) return 0
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0]
    previous[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column]
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      )
      diagonal = above
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length)
}

function findCopyrightYears(text) {
  return [...new Set([...String(text || '').matchAll(/(?:©|c)?\s*\b(20[0-3]\d)\b/gi)].map(match => Number(match[1])))]
}

function prepareOcrImages(file) {
  if (typeof createImageBitmap !== 'function') return Promise.resolve([file])
  return createImageBitmap(file).then(bitmap => {
    const width = bitmap.width
    const height = bitmap.height
    const regions = [
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0.06, y: 0.02, width: 0.88, height: 0.30 },
      { x: 0.16, y: 0.06, width: 0.58, height: 0.10 },
      { x: 0.10, y: 0.91, width: 0.52, height: 0.08 },
      { x: 0, y: 0.68, width: 1, height: 0.32 }
    ]
    const images = regions.map(region => {
      const sx = Math.floor(width * region.x)
      const sy = Math.floor(height * region.y)
      const sw = Math.max(1, Math.floor(width * region.width))
      const sh = Math.max(1, Math.floor(height * region.height))
      const scale = Math.min(3, Math.max(1, 1600 / Math.max(sw, sh)))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(sw * scale))
      canvas.height = Math.max(1, Math.round(sh * scale))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let index = 0; index < pixels.data.length; index += 4) {
        const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114
        const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128))
        pixels.data[index] = contrast
        pixels.data[index + 1] = contrast
        pixels.data[index + 2] = contrast
      }
      context.putImageData(pixels, 0, 0)
      return canvas
    })
    bitmap.close()
    return images
  }).catch(() => [file])
}

function visualFingerprint(file) {
  return createImageBitmap(file).then(bitmap => {
    const size = 32
    const low = 8
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(bitmap, 0, 0, size, size)
    bitmap.close()
    const rgba = context.getImageData(0, 0, size, size).data
    const pixels = new Float64Array(size * size)
    for (let i = 0; i < pixels.length; i += 1) {
      pixels[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114
    }
    const cosines = Array.from({ length: low }, (_, u) =>
      Array.from({ length: size }, (_, x) => Math.cos((2 * x + 1) * u * Math.PI / (2 * size))))
    const coefficients = []
    for (let v = 0; v < low; v += 1) {
      for (let u = 0; u < low; u += 1) {
        let total = 0
        for (let y = 0; y < size; y += 1) {
          let row = 0
          for (let x = 0; x < size; x += 1) row += pixels[y * size + x] * cosines[u][x]
          total += row * cosines[v][y]
        }
        coefficients.push(total)
      }
    }
    const medianValues = coefficients.slice(1).sort((a, b) => a - b)
    const median = medianValues[Math.floor(medianValues.length / 2)]
    return coefficients.map(value => value > median ? '1' : '0').join('')
  })
}

function loadVisualIndex() {
  if (window.pokevaleurVisualIndexPromise) return window.pokevaleurVisualIndexPromise
  window.pokevaleurVisualIndexPromise = fetch('/card-visual-index.json', { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error('L’index visuel du catalogue n’est pas encore disponible.')
      return response.json()
    })
    .then(payload => Array.isArray(payload.cards) ? payload.cards : [])
    .then(cards => {
      if (!cards.length) throw new Error('L’index visuel du catalogue est vide.')
      return cards
    })
    .catch(error => {
      window.pokevaleurVisualIndexPromise = null
      throw error
    })
  return window.pokevaleurVisualIndexPromise
}

function fingerprintDistance(left, right) {
  let distance = 0
  for (let index = 0; index < 64; index += 1) {
    if (left[index] !== right[index]) distance += 1
  }
  return distance
}

function preferredVariant(card, text) {
  const years = findCopyrightYears(text)
  const variants = card?.card_print_variants || []
  return variants.find(variant => years.some(year =>
    String(variant.variant_label || '').includes(String(year))
  )) || variants.find(variant => variant.is_master_set_target) || variants[0]
}

function rankCards(rows, text, collectorNumbers, copyrightYears) {
  const normalizedOcr = normalizeText(text)
  const words = new Set(normalizedOcr.split(/\s+/).filter(word => word.length >= 3))
  const byId = new Map()

  for (const card of rows || []) {
    const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
    const number = normalizeCollectorToken(card.collector_number)
    const exactNumber = collectorNumbers.some(value => number === normalizeCollectorToken(value))
    const numericPart = collectorNumbers.some(value => number.includes(normalizeCollectorToken(value.split('/')[0])))
    const codeNumberMatch = collectorNumbers.some(value => {
      const firstPart = normalizeCollectorToken(value.split('/')[0])
      return /[a-z]/i.test(firstPart) && number === firstPart
    })
    const name = normalizeText(card.card_name)
    const nameWords = name.split(/\s+/).filter(word => word.length >= 3)
    const matchedWords = nameWords.filter(word => words.has(word)).length
    const fullNameMatch = name.length > 3 && normalizedOcr.includes(name)
    const fuzzyNameScore = Math.max(0, ...nameWords.flatMap(nameWord =>
      [...words].filter(word => word.length >= 6).map(word => fuzzySimilarity(word, nameWord))
    ))
    const variants = card.card_print_variants || []
    const variantYears = variants.flatMap(variant => findCopyrightYears(variant.variant_label || ''))
    const releaseYear = set?.release_date ? Number(String(set.release_date).slice(0, 4)) : null
    const knownYears = [...variantYears, ...(releaseYear ? [releaseYear] : [])]
    const yearMatch = copyrightYears.some(year => knownYears.includes(year))
    const yearMismatch = copyrightYears.length > 0 && knownYears.length > 0 && !yearMatch
    const setCode = normalizeText(set?.set_code).replace(/\s+/g, '')
    const setCodeSuffix = setCode.match(/[a-z]{2,}$/)?.[0] || ''
    const compactOcr = normalizedOcr.replace(/\s+/g, '')
    const setCodeMatch = (setCode.length >= 3 && compactOcr.includes(setCode))
      || (setCodeSuffix.length >= 2 && compactOcr.includes(setCodeSuffix))
    const strongNumberMatch = exactNumber || codeNumberMatch || (numericPart && yearMatch)
    const strongNameMatch = fullNameMatch || matchedWords >= 2 || fuzzyNameScore >= 0.72
    const hasReliableEvidence = strongNumberMatch || strongNameMatch || setCodeMatch
    const score = (exactNumber ? 120 : codeNumberMatch ? 95 : numericPart ? 55 : 0)
      + (fullNameMatch ? 80 : 0) + Math.min(matchedWords, 2) * 10
      + Math.round(fuzzyNameScore * 70)
      + (yearMatch ? 25 : 0) + (setCodeMatch ? 35 : 0)
      - (yearMismatch ? 90 : 0)
    if (!hasReliableEvidence || score < 60) continue
    const previous = byId.get(card.id)
    if (!previous || score > previous.score) byId.set(card.id, { ...card, card_sets: set, score })
  }

  const ranked = [...byId.values()]
    .sort((a, b) => b.score - a.score || a.card_name.localeCompare(b.card_name, 'fr'))
  const bestScore = ranked[0]?.score || 0
  return ranked.filter(card => card.score >= Math.max(60, bestScore - 35)).slice(0, 6)
}

function meaningfulOcrWords(text) {
  const ignored = new Set([
    'pokemon', 'pokémon', 'carte', 'illustration', 'niveau', 'evolution', 'evolue',
    'pv', 'attaque', 'attaque', 'faiblesse', 'resistance', 'retraite', 'deck',
    'dresseur', 'energie', 'speciale', 'regle', 'regles', 'talent', 'capacite',
    'commune', 'rare', 'ultra', 'holo', 'reverse', 'ex'
  ])
  return [...new Set(normalizeText(text).split(/\s+/)
    .filter(word => word.length >= 4 && !ignored.has(word)))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 4)
}

export default function CardScannerPage() {
  const supabase = useMemo(() => createClient(), [])
  const workerRef = useRef(null)
  const [user, setUser] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [publicSetIds, setPublicSetIds] = useState([])
  const [publicSets, setPublicSets] = useState([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [candidates, setCandidates] = useState([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [manualQuery, setManualQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const selectedCard = candidates.find(card => card.id === selectedCardId) || null
  const selectedVariants = selectedCard?.card_print_variants || []

  useEffect(() => {
    let active = true
    async function initialize() {
      const { data: { user: signedInUser } } = await supabase.auth.getUser()
      if (!active) return
      setUser(signedInUser || null)

      const { data: setRows, error: setRowsError } = await supabase.from('card_sets')
        .select('id,set_name,set_code,language,release_date').eq('is_public', true)
      if (!active) return
      if (setRowsError) throw setRowsError
      setPublicSets(setRows || [])
      setPublicSetIds((setRows || []).map(row => row.id))

      if (signedInUser) {
        const { data: profileRows, error: profileError } = await supabase.from('collection_profiles')
          .select('id,display_name,is_default,profile_type').order('created_at')
        if (!active) return
        if (profileError) throw profileError

        const availableProfiles = profileRows || []
        setProfiles(availableProfiles)
        const savedProfileId = window.localStorage.getItem('pokevaleur-collection:' + signedInUser.id)
        const activeProfile = availableProfiles.find(row => row.id === savedProfileId)
          || availableProfiles.find(row => row.is_default)
          || availableProfiles[0]
        if (activeProfile) setProfileId(activeProfile.id)
        else setError('Aucun profil de collection disponible pour ce compte.')
      }
    }
    initialize().catch(loadError => {
      if (active) setError(loadError.message || 'Impossible de préparer le scanner.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      if (workerRef.current) workerRef.current.terminate().catch(() => {})
    }
  }, [supabase])

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  async function searchCatalog(text) {
    if (!publicSetIds.length) throw new Error('Le catalogue public est indisponible.')
    const numberCandidates = findCollectorNumbers(text)
    const copyrightYears = findCopyrightYears(text)
    const terms = meaningfulOcrWords(text)
    const rowsById = new Map()
    const cardQuery = () => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', publicSetIds)

    const requests = []
    const compactOcr = normalizeText(text).replace(/\s+/g, '')
    const hintedSets = publicSets.filter(set => {
      const code = normalizeText(set.set_code).replace(/\s+/g, '')
      const suffix = code.match(/[a-z]{2,}$/)?.[0] || ''
      return (code.length >= 3 && compactOcr.includes(code))
        || (suffix.length >= 2 && compactOcr.includes(suffix))
    })
    if (hintedSets.length) {
      requests.push(supabase.from('cards').select(CARD_FIELDS)
        .in('card_set_id', hintedSets.map(set => set.id)).limit(250))
    }
    for (const number of numberCandidates) {
      requests.push(cardQuery().ilike('collector_number', number).limit(80))
      requests.push(cardQuery().ilike('collector_number', '%' + number.split('/')[0] + '%').limit(80))
    }
    for (const term of terms) {
      requests.push(cardQuery().ilike('card_name', '%' + term + '%').limit(30))
    }
    for (const term of terms.filter(value => value.length >= 7).slice(0, 3)) {
      const fragments = new Set(Array.from({ length: term.length - 4 }, (_, index) => term.slice(index, index + 5)))
      for (const fragment of fragments) {
        requests.push(cardQuery().ilike('card_name', '%' + fragment + '%').limit(30))
      }
    }

    const results = await Promise.all(requests)
    const failed = results.find(result => result.error)
    if (failed) throw failed.error
    for (const result of results) {
      for (const card of result.data || []) rowsById.set(card.id, card)
    }

    return {
      numbers: numberCandidates,
      cards: rankCards([...rowsById.values()], text, numberCandidates, copyrightYears)
    }
  }

  async function searchVisualCatalog(file) {
    const index = await loadVisualIndex()
    const fingerprint = await visualFingerprint(file)
    const ranked = []
    for (const entry of index) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[1] !== 'string') continue
      const distance = fingerprintDistance(fingerprint, entry[1])
      if (distance <= 8) ranked.push({ card_id: entry[0], distance })
    }
    ranked.sort((a, b) => a.distance - b.distance)
    const matches = ranked.slice(0, 24)
    if (!matches.length) return []
    const { data: cards, error: cardsError } = await supabase.from('cards')
      .select(CARD_FIELDS).in('id', matches.map(match => match.card_id))
    if (cardsError) throw cardsError
    const byId = new Map((cards || []).map(card => [card.id, card]))
    return matches.map(match => {
      const card = byId.get(match.card_id)
      return card ? { ...card, visualDistance: match.distance } : null
    }).filter(Boolean).slice(0, 8)
  }

  async function scanPhoto(file) {
    setError('')
    setStatus('')
    setCandidates([])
    setSelectedCardId('')
    setSelectedVariantId('')
    setOcrText('')
    if (!file) return
    if (!file.type?.startsWith('image/')) return setError('Choisis une photo au format image.')
    if (file.size > 20 * 1024 * 1024) return setError('La photo dépasse 20 Mo. Choisis une image plus légère.')

    const nextUrl = URL.createObjectURL(file)
    setPhotoUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return nextUrl
    })
    setBusy(true)
    setStatus('Chargement du lecteur de texte…')

    let worker
    try {
      const Tesseract = await loadOcrLibrary()
      setStatus('Lecture du nom et du numéro de la carte…')
      worker = await Tesseract.createWorker('eng+fra', 1, {
        workerPath: OCR_WORKER_URL,
        corePath: OCR_CORE_URL,
        langPath: OCR_LANGUAGE_URL,
        logger: message => {
          if (message.status === 'recognizing text') {
            const percent = Math.round((message.progress || 0) * 100)
            setStatus('Lecture de la carte… ' + percent + '%')
          }
        }
      })
      workerRef.current = worker
      const ocrImages = await prepareOcrImages(file)
      const recognizedParts = []
      for (let index = 0; index < ocrImages.length; index += 1) {
        setStatus(ocrImages.length === 1
          ? 'Lecture de la carte…'
          : 'Lecture du nom, du numéro et des indices imprimés (' + (index + 1) + '/' + ocrImages.length + ')…')
        await worker.setParameters({
          tessedit_pageseg_mode: index === 0 ? '3' : index === 1 ? '6' : index === 2 ? '7' : index === 3 ? '7' : '11',
          preserve_interword_spaces: '1'
        })
        const result = await worker.recognize(ocrImages[index])
        const recognizedText = result?.data?.text || ''
        if (recognizedText) recognizedParts.push(recognizedText)
      }
      const text = recognizedParts.join('\n')
      setOcrText(text)
      setStatus('Recherche dans le catalogue avec le numéro, l’année et le code de série…')
      let visualCards = []
      let visualUnavailable = false
      try {
        setStatus('Comparaison de l’image avec le catalogue…')
        visualCards = await searchVisualCatalog(file)
      } catch (visualError) {
        visualUnavailable = true
      }
      const matchResult = await searchCatalog(text)
      const merged = []
      const seen = new Set()
      for (const card of [...visualCards, ...matchResult.cards]) {
        if (!seen.has(card.id) && merged.length < 8) {
          seen.add(card.id)
          merged.push(card)
        }
      }
      if (!merged.length) {
        setStatus('Aucune correspondance fiable. Essaie une photo cadrée sur la carte ou poursuis avec la recherche manuelle.')
      } else {
        setCandidates(merged)
        setSelectedCardId(merged[0].id)
        const firstVariant = preferredVariant(merged[0], text)
        setSelectedVariantId(firstVariant?.id || '')
        setStatus(visualCards.length
          ? 'Comparaison visuelle terminée. Vérifie la carte proposée avant de l’ajouter.'
          : visualUnavailable
            ? 'L’index visuel n’est pas encore disponible. Les propositions viennent du texte lu.'
            : 'Vérifie la bonne carte parmi les correspondances.')
      }
    } catch (scanError) {
      setError(scanError.message || 'La lecture de la photo a échoué. Réessaie ou utilise la recherche manuelle.')
      setStatus('')
    } finally {
      if (worker) {
        await worker.terminate().catch(() => {})
        if (workerRef.current === worker) workerRef.current = null
      }
      setBusy(false)
    }
  }

  async function searchManually(event) {
    event.preventDefault()
    const query = manualQuery.trim()
    if (!query || busy) return
    setBusy(true)
    setError('')
    setStatus('Recherche dans le catalogue…')
    try {
      const matchResult = await searchCatalog(query)
      setCandidates(matchResult.cards)
      if (!matchResult.cards.length) {
        setSelectedCardId('')
        setSelectedVariantId('')
        setStatus('Aucune carte ne correspond à ce nom ou numéro. Essaie une autre écriture.')
      } else {
        setSelectedCardId(matchResult.cards[0].id)
        const firstVariant = preferredVariant(matchResult.cards[0], query)
        setSelectedVariantId(firstVariant?.id || '')
        setStatus(matchResult.cards.length === 1
          ? 'Une carte correspond à ta recherche.'
          : 'Vérifie la bonne carte parmi les résultats.')
      }
    } catch (searchError) {
      setError(searchError.message || 'La recherche dans le catalogue a échoué.')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function chooseCard(card) {
    setSelectedCardId(card.id)
    const variant = preferredVariant(card, ocrText)
    setSelectedVariantId(variant?.id || '')
  }

  async function addToCollection() {
    if (!user || !profileId || !selectedVariantId || busy) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !currentUser || currentUser.id !== user.id) {
        throw new Error('Ta session a expiré. Reconnecte-toi avant d’ajouter la carte.')
      }
      const copies = Math.max(1, Math.min(20, Number(quantity) || 1))
      const rows = Array.from({ length: copies }, () => ({
        user_id: currentUser.id,
        collection_profile_id: profileId,
        card_print_variant_id: selectedVariantId,
        ownership_type: 'raw'
      }))
      const { error: insertError } = await supabase.from('collection_cards').insert(rows)
      if (insertError) throw insertError
      setStatus(copies === 1
        ? 'Carte ajoutée à la collection sélectionnée.'
        : copies + ' exemplaires ajoutés à la collection sélectionnée.')
      setCandidates([])
      setSelectedCardId('')
      setSelectedVariantId('')
      setPhotoUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return ''
      })
    } catch (saveError) {
      setError('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setBusy(false)
    }
  }

  function selectProfile(nextProfileId) {
    setProfileId(nextProfileId)
    if (user) window.localStorage.setItem('pokevaleur-collection:' + user.id, nextProfileId)
  }

  return (
    <main className={styles.page}>
      <a className={styles.backLink} href={user ? "/collection/cartes" : "/catalogue/cartes"}>{user ? "← Retour à Mes cartes" : "← Retour au catalogue"}</a>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>POKÉVALEUR · CATALOGUE CARTES</span>
          <h1>Scanner une carte</h1>
          <p>Photographie le recto : Pokévaleur compare l’image au catalogue et utilise le nom, le numéro, l’année et les codes imprimés comme indices complémentaires.</p>
        </div>
        <div className={styles.cameraBadge} aria-hidden="true">▣</div>
      </header>

      {loading ? (
        <section className={styles.panel}><p>Préparation du scanner…</p></section>
      ) : (
        <>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {profiles.length > 0 && (
            <label className={styles.profileSelect}>
              <span>Ajouter dans</span>
              <select value={profileId} onChange={event => selectProfile(event.target.value)} disabled={busy}>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name || (profile.profile_type === 'child' ? 'Collection enfant' : 'Ma collection')}
                  </option>
                ))}
              </select>
            </label>
          )}

          <section className={styles.scannerCard}>
            <div className={styles.captureArea}>
              {photoUrl ? (
                <img className={styles.preview} src={photoUrl} alt="Aperçu de la carte photographiée" />
              ) : (
                <div className={styles.emptyPreview}>
                  <span aria-hidden="true">📷</span>
                  <strong>Place une carte à plat, bien éclairée et bien cadrée</strong>
                  <small>La carte doit remplir le cadre; évite les reflets et garde son nom, son numéro, l’année © et le symbole de série visibles. La photo est lue dans ton navigateur et n’est pas enregistrée.</small>
                </div>
              )}
            </div>
            <label className={styles.captureButton}>
              <span aria-hidden="true">📷</span>
              <span>{photoUrl ? 'Prendre une autre photo' : 'Ouvrir l’appareil photo'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={event => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  scanPhoto(file)
                }}
                disabled={busy || loading}
              />
            </label>
            <p className={styles.helper}>Si ton téléphone le propose, tu peux aussi choisir une photo déjà prise.</p>
            {busy && <p className={styles.progress} role="status">{status || 'Lecture en cours…'}</p>}
            {!busy && status && <p className={styles.notice} role="status">{status}</p>}
          </section>

          {candidates.length > 0 && (
            <section className={styles.results}>
              <div className={styles.sectionHeading}>
                <div><span className={styles.eyebrow}>RÉSULTATS</span><h2>Confirme la carte</h2></div>
                <span>{candidates.length} proposition{candidates.length > 1 ? 's' : ''}</span>
              </div>
              <div className={styles.candidateList}>
                {candidates.map(card => {
                  const set = card.card_sets || {}
                  const active = card.id === selectedCardId
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={active ? styles.candidateActive : styles.candidate}
                      onClick={() => chooseCard(card)}
                      aria-pressed={active}
                    >
                      {card.image_url
                        ? <img src={card.image_url} alt="" loading="lazy" />
                        : <span className={styles.imagePlaceholder}>🃏</span>}
                      <span className={styles.candidateText}>
                        <strong>{card.card_name}</strong>
                        <small>{set.set_name || 'Série inconnue'} · {card.collector_number || 'Numéro inconnu'}</small>
                        <small>{set.language || 'FR'} · {card.card_type || 'Carte Pokémon'}{Number.isFinite(card.visualDistance) ? ' · écart visuel ' + card.visualDistance + '/64' : ''}</small>
                      </span>
                      {active && <span className={styles.selectedMark} aria-label="Sélectionnée">✓</span>}
                    </button>
                  )
                })}
              </div>

              {selectedCard && (
                user ? (
                  <div className={styles.confirmPanel}>
                    {profiles.length > 0 ? (
                      <>
                        <label>
                          <span>Version imprimée</span>
                          <select value={selectedVariantId} onChange={event => setSelectedVariantId(event.target.value)}>
                            {selectedVariants.map(variant => (
                              <option key={variant.id} value={variant.id}>
                                {variant.variant_label || variant.variant_key || variant.finish_code || 'Version catalogue'}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Nombre d’exemplaires</span>
                          <input type="number" min="1" max="20" value={quantity}
                            onChange={event => setQuantity(event.target.value)} />
                        </label>
                        <button className={styles.addButton} type="button" onClick={addToCollection}
                          disabled={busy || !selectedVariantId || !profileId}>
                          {busy ? 'Enregistrement…' : 'Ajouter à ma collection'}
                        </button>
                        <p>L’ajout se fait uniquement après ta confirmation. Les exemplaires déjà possédés restent inchangés.</p>
                      </>
                    ) : (
                      <p>Aucun profil de collection n’est disponible pour ce compte.</p>
                    )}
                  </div>
                ) : (
                  <div className={styles.confirmPanel}>
                    <div className={styles.guestMessage}>
                      <strong>La carte est reconnue.</strong>
                      <p>Tu peux utiliser le scanner sans compte. Connecte-toi seulement si tu veux enregistrer cette carte dans ta collection.</p>
                    </div>
                    <a className={styles.addButton} href="/login?next=%2Fcollection%2Fcartes%2Fscanner">Se connecter pour l’ajouter</a>
                  </div>
                )
              )}
            </section>
          )}

          <details className={styles.manualFallback}>
            <summary>La carte n’a pas été reconnue ?</summary>
            <p>Saisis son nom ou son numéro pour chercher dans le catalogue, sans quitter le scanner.</p>
            <form onSubmit={searchManually} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
                <span>Nom ou numéro de la carte</span>
                <input
                  type="search"
                  value={manualQuery}
                  onChange={event => setManualQuery(event.target.value)}
                  placeholder="Ex. Lugulabre ou TG04/TG30"
                  autoComplete="off"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #cfd8e3', borderRadius: 10, font: 'inherit' }}
                />
              </label>
              <button className={styles.addButton} type="submit" disabled={busy || !manualQuery.trim()}>
                {busy ? 'Recherche…' : 'Chercher dans le catalogue'}
              </button>
            </form>
            <a href={user ? "/collection/cartes" : "/catalogue/cartes"} style={{ marginTop: 12 }}>
              {user ? "Ouvrir Mes cartes" : "Ouvrir le catalogue"}
            </a>
            {ocrText && <small className={styles.ocrSummary}>Texte lu par le scanner : {ocrText.slice(0, 240)}</small>}
          </details>
        </>
      )}
    </main>
  )
}
