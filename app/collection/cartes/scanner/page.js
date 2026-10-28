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
    const name = normalizeText(card.card_name)
    const nameWords = name.split(/\s+/).filter(word => word.length >= 3)
    const matchedWords = nameWords.filter(word => words.has(word)).length
    const fullNameMatch = name.length > 3 && normalizedOcr.includes(name)
    const variantYearMatch = (card.card_print_variants || []).some(variant =>
      copyrightYears.some(year => String(variant.variant_label || '').includes(String(year)))
    )
    const releaseYear = set?.release_date ? Number(String(set.release_date).slice(0, 4)) : null
    const setYearMatch = releaseYear && copyrightYears.includes(releaseYear)
    const setCode = normalizeText(set?.set_code).replace(/\s+/g, '')
    const setCodeMatch = setCode.length >= 2 && normalizedOcr.replace(/\s+/g, '').includes(setCode)
    const score = (exactNumber ? 100 : numericPart ? 45 : 0)
      + matchedWords * 12 + (fullNameMatch ? 25 : 0)
      + (variantYearMatch ? 32 : 0) + (setYearMatch ? 12 : 0) + (setCodeMatch ? 24 : 0)
    if (!score) continue
    const previous = byId.get(card.id)
    if (!previous || score > previous.score) byId.set(card.id, { ...card, card_sets: set, score })
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.card_name.localeCompare(b.card_name, 'fr'))
    .slice(0, 12)
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
      return code.length >= 3 && compactOcr.includes(code)
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
        const result = await worker.recognize(ocrImages[index])
        const recognizedText = result?.data?.text || ''
        if (recognizedText) recognizedParts.push(recognizedText)
      }
      const text = recognizedParts.join('\n')
      setOcrText(text)
      setStatus('Recherche dans le catalogue avec le numéro, l’année et le code de série…')
      const matchResult = await searchCatalog(text)
      if (!matchResult.cards.length) {
        setStatus('Aucune correspondance certaine. Essaie une photo plus nette ou poursuis avec la recherche manuelle.')
      } else {
        setCandidates(matchResult.cards)
        setSelectedCardId(matchResult.cards[0].id)
        const firstVariant = preferredVariant(matchResult.cards[0], text)
        setSelectedVariantId(firstVariant?.id || '')
        setStatus(matchResult.cards.length === 1 ? 'Une carte correspond au texte lu.' : 'Vérifie la bonne carte parmi les correspondances.')
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
          <p>Photographie le recto : Pokévaleur lit le nom, le numéro, l’année et les codes imprimés, puis cherche les cartes correspondantes dans son catalogue.</p>
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
                  <strong>Place une carte à plat, bien éclairée</strong>
                  <small>Garde le nom en haut et le numéro, l’année © et le symbole de série en bas bien visibles. La photo est lue dans ton navigateur et n’est pas enregistrée.</small>
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
                        <small>{set.language || 'FR'} · {card.card_type || 'Carte Pokémon'}</small>
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
            <p>Tu peux la retrouver avec la recherche habituelle de la checklist.</p>
            <a href={user ? "/collection/cartes" : "/catalogue/cartes"}>{user ? "Rechercher dans Mes cartes" : "Rechercher dans le catalogue"}</a>
            {ocrText && <small className={styles.ocrSummary}>Texte lu : {ocrText.slice(0, 240)}</small>}
          </details>
        </>
      )}
    </main>
  )
}
