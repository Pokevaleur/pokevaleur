'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './graded-cards.module.css'

const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,rarity_label,image_url,card_sets!cards_card_set_id_fkey(id,set_name,set_code,language),card_print_variants(id,variant_key,variant_label,finish_code)'
const STORAGE_BUCKET = 'collection-images'

function setLabel(set) {
  return (set?.set_code ? set.set_code + ' — ' : '') + (set?.set_name || 'Série inconnue')
}
function money(value, currency) {
  if (value == null || value === '') return ''
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(Number(value))
}
function normalized(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function variantLabel(variant) {
  return variant?.variant_label === 'Carte (suivi de base)' ? 'Carte' : (variant?.variant_label || variant?.variant_key || 'Variante')
}
function nullableNumber(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export default function GradedCardsPage({ mode }) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [user, setUser] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [sets, setSets] = useState([])
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [matches, setMatches] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [variantId, setVariantId] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [form, setForm] = useState({
    companyId: '', grade: '', gradeLabel: '', certification: '', gradingDate: '', reportUrl: '',
    language: 'FR', purchaseDate: '', purchasePrice: '', declaredValue: '', quantity: '1',
    centeringFront: '', centeringBack: '', edges: '', corners: '', surface: '',
    frontNotes: '', backNotes: ''
  })
  const [photos, setPhotos] = useState([])
  const [items, setItems] = useState([])
  const [signedPhotos, setSignedPhotos] = useState({})
  const [filters, setFilters] = useState({ text: '', setId: '', companyId: '', grade: '', language: '' })

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const memberProfile = profiles.find(profile => profile.id === profileId)

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      setLoading(true)
      setError('')
      const { data: { user: signedInUser }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !signedInUser) {
        const next = mode === 'add' ? '/collection/cartes-gradees/ajouter' : '/collection/cartes-gradees/consulter'
        window.location.replace('/login?next=' + encodeURIComponent(next + window.location.search))
        return
      }
      setUser(signedInUser)
      const [{ data: profileRows, error: profileError }, { data: setRows, error: setError }, { data: companyRows, error: companyError }] = await Promise.all([
        supabase.from('collection_profiles').select('id,display_name,is_default,profile_type').order('created_at'),
        supabase.from('card_sets').select('id,set_name,set_code,language,is_public,release_date').eq('is_public', true).order('release_date', { ascending: false }),
        supabase.from('card_grading_companies').select('id,company_name,abbreviation').eq('is_active', true).order('company_name')
      ])
      if (cancelled) return
      if (profileError) throw profileError
      if (setError) throw setError
      if (companyError) throw companyError
      const availableProfiles = profileRows || []
      const saved = window.localStorage.getItem('pokevaleur-collection:' + signedInUser.id)
      const active = availableProfiles.find(row => row.id === saved) || availableProfiles.find(row => row.is_default) || availableProfiles[0]
      setProfiles(availableProfiles)
      setSets(setRows || [])
      setCompanies(companyRows || [])
      if (active) {
        setProfileId(active.id)
        window.localStorage.setItem('pokevaleur-collection:' + signedInUser.id, active.id)
      }
      if (mode === 'add') {
        const params = new URLSearchParams(window.location.search)
        const requestedVariant = params.get('variant_id')
        if (requestedVariant) {
          const { data: variant, error: variantError } = await supabase.from('card_print_variants')
            .select('id,card_id').eq('id', requestedVariant).maybeSingle()
          if (variantError) throw variantError
          if (variant) {
            const { data: card, error: cardError } = await supabase.from('cards').select(CARD_FIELDS).eq('id', variant.card_id).maybeSingle()
            if (cardError) throw cardError
            if (card) {
              setSelectedCard(card)
              setVariantId(variant.id)
              setCardQuery(card.card_name + ' · ' + setLabel(card.card_sets) + ' · n° ' + card.collector_number)
              setForm(current => ({ ...current, language: card.card_sets?.language || 'FR' }))
            }
          }
        }
      }
    }
    initialize().catch(loadError => { if (!cancelled) setError(loadError.message || 'Le chargement a échoué.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase, mode])

  useEffect(() => {
    if (mode !== 'add' || !profileId) return
    const term = cardQuery.trim()
    if (selectedCard || term.length < 2 || !sets.length) {
      setMatches([])
      setSearching(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const pattern = '%' + term.replace(/[%_]/g, '\\$&') + '%'
        let query = supabase.from('cards').select(CARD_FIELDS).order('card_name').limit(80)
        query = query.in('card_set_id', sets.map(set => set.id))
        if (setFilter) query = query.eq('card_set_id', setFilter)
        const [names, numbers] = await Promise.all([
          query.ilike('card_name', pattern),
          (() => {
            let numberQuery = supabase.from('cards').select(CARD_FIELDS).order('card_name').limit(80)
            numberQuery = numberQuery.in('card_set_id', sets.map(set => set.id))
            if (setFilter) numberQuery = numberQuery.eq('card_set_id', setFilter)
            return numberQuery.ilike('collector_number', pattern)
          })()
        ])
        if (names.error) throw names.error
        if (numbers.error) throw numbers.error
        if (!cancelled) {
          const unique = new Map()
          ;[...(names.data || []), ...(numbers.data || [])].forEach(card => unique.set(card.id, card))
          setMatches([...unique.values()].sort((a, b) => setLabel(a.card_sets).localeCompare(setLabel(b.card_sets), 'fr') || String(a.collector_number).localeCompare(String(b.collector_number), 'fr', { numeric: true })).slice(0, 80))
        }
      } catch (searchError) {
        if (!cancelled) setError(searchError.message || 'Recherche impossible.')
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [cardQuery, setFilter, selectedCard, profileId, mode, sets, supabase])

  useEffect(() => {
    if (mode !== 'add' || !variantId || !form.companyId || !form.grade) {
      setEstimate(null)
      return
    }
    let cancelled = false
    async function loadEstimate() {
      const { data, error: estimateError } = await supabase.from('card_price_observations')
        .select('amount,currency,observed_at,source,source_url')
        .eq('card_print_variant_id', variantId)
        .eq('price_kind', 'graded')
        .eq('grading_company_id', form.companyId)
        .eq('grade', Number(form.grade))
        .eq('observation_type', 'estimate')
        .order('observed_at', { ascending: false }).limit(1).maybeSingle()
      if (cancelled) return
      if (estimateError) {
        setEstimate(null)
        return
      }
      setEstimate(data || null)
    }
    loadEstimate()
    return () => { cancelled = true }
  }, [mode, variantId, form.companyId, form.grade, supabase])

  const loadCollection = useCallback(async () => {
    if (mode !== 'consult' || !profileId) return
    setLoading(true)
    setError('')
    try {
      const rows = []
      const pageSize = 500
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: listError } = await supabase.from('collection_cards')
          .select('id,card_print_variant_id,grade,grade_label,certification_number,grading_company_id,subgrades,graded_language,grading_date,grading_report_url,grading_front_notes,grading_back_notes,purchase_date,purchase_price,current_value_override,photo_path,created_at,card_grading_companies(company_name,abbreviation),card_print_variants!inner(id,variant_label,variant_key,cards!card_print_variants_card_id_fkey!inner(id,card_name,collector_number,rarity_label,card_sets!cards_card_set_id_fkey(id,set_name,set_code,language)))')
          .eq('collection_profile_id', profileId).eq('ownership_type', 'graded')
          .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        if (listError) throw listError
        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
      }
      const photoRows = await Promise.all(rows.map(async row => {
        const path = row.photo_path
        if (!path) return [row.id, '']
        const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600)
        return [row.id, data?.signedUrl || '']
      }))
      setItems(rows)
      setSignedPhotos(Object.fromEntries(photoRows))
    } catch (listError) {
      setError(listError.message || 'Impossible de charger les cartes gradées.')
    } finally {
      setLoading(false)
    }
  }, [mode, profileId, supabase])

  useEffect(() => { loadCollection() }, [loadCollection])

  async function saveCard(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!user || !profileId || !selectedCard || !variantId) {
      setError('Choisis d’abord la carte et sa variante.')
      return
    }
    if (!form.companyId || !form.grade || Number(form.grade) < 1 || Number(form.grade) > 10) {
      setError('Choisis la société de gradation et une note entre 1 et 10.')
      return
    }
    const quantity = Math.max(1, Math.min(99, Number.parseInt(form.quantity, 10) || 1))
    const certifications = form.certification.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    if (certifications.length > 1 && certifications.length !== quantity) {
      setError('Pour plusieurs numéros de certification, indique un numéro par ligne, ou laisse le champ vide.')
      return
    }
    const subgrades = {
      centering_front: nullableNumber(form.centeringFront),
      centering_back: nullableNumber(form.centeringBack),
      edges: nullableNumber(form.edges),
      corners: nullableNumber(form.corners),
      surface: nullableNumber(form.surface)
    }
    setBusy(true)
    try {
      const sharedId = crypto.randomUUID()
      const base = {
        user_id: user.id,
        collection_profile_id: profileId,
        card_print_variant_id: variantId,
        ownership_type: 'graded',
        grading_company_id: form.companyId,
        grade: Number(form.grade),
        grade_label: form.gradeLabel.trim() || (String(form.grade) + '/10'),
        subgrades,
        graded_language: form.language.trim().toUpperCase() || selectedCard.card_sets?.language || 'FR',
        grading_date: form.gradingDate || null,
        grading_report_url: form.reportUrl.trim() || null,
        grading_front_notes: form.frontNotes.trim() || null,
        grading_back_notes: form.backNotes.trim() || null,
        purchase_date: form.purchaseDate || null,
        purchase_price: nullableNumber(form.purchasePrice),
        current_value_override: nullableNumber(form.declaredValue)
      }
      const rows = Array.from({ length: quantity }, (_, index) => ({
        ...base,
        certification_number: certifications.length === quantity ? certifications[index] : (certifications.length === 1 && index === 0 ? certifications[0] : null)
      }))
      const { data: inserted, error: insertError } = await supabase.from('collection_cards').insert(rows).select('id')
      if (insertError) throw insertError
      let photoWarning = ''
      if (photos.length) {
        try {
          const uploaded = []
          for (let index = 0; index < photos.length; index += 1) {
            const file = photos[index]
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90) || 'photo.jpg'
            const path = user.id + '/' + profileId + '/graded/' + sharedId + '/' + index + '-' + safeName
            const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
            if (uploadError) throw uploadError
            uploaded.push({ path, caption: file.name })
          }
          const photoEntries = inserted.flatMap(row => uploaded.map((photo, index) => ({
            user_id: user.id, collection_profile_id: profileId, collection_card_id: row.id,
            photo_path: photo.path, caption: photo.caption, sort_order: index
          })))
          const { error: photoError } = await supabase.from('collection_card_photos').insert(photoEntries)
          if (photoError) throw photoError
          const { error: pathError } = await supabase.from('collection_cards').update({ photo_path: uploaded[0].path }).in('id', inserted.map(row => row.id))
          if (pathError) throw pathError
        } catch (photoError) {
          photoWarning = ' Les fiches sont enregistrées, mais les photos n’ont pas toutes pu être associées : ' + (photoError.message || 'réessaie depuis la page Consulter.')
        }
      }
      setNotice(quantity + ' exemplaire' + (quantity > 1 ? 's' : '') + ' gradé' + (quantity > 1 ? 's' : '') + ' ajouté' + (quantity > 1 ? 's' : '') + ' à la collection.' + photoWarning)
      setSelectedCard(null)
      setVariantId('')
      setCardQuery('')
      setPhotos([])
      setForm(current => ({ ...current, grade: '', gradeLabel: '', certification: '', gradingDate: '', reportUrl: '', purchaseDate: '', purchasePrice: '', declaredValue: '', quantity: '1', centeringFront: '', centeringBack: '', edges: '', corners: '', surface: '', frontNotes: '', backNotes: '' }))
    } catch (saveError) {
      setError('Enregistrement interrompu : ' + (saveError.message || 'réessaie. Si une carte a été créée avant une erreur photo, vérifie la page Consulter avant de recommencer.'))
    } finally {
      setBusy(false)
    }
  }

  const filteredItems = items.filter(item => {
    const variant = item.card_print_variants
    const card = variant?.cards
    const set = card?.card_sets
    const text = normalized([card?.card_name, card?.collector_number, item.certification_number, item.grade_label, item.card_grading_companies?.company_name].join(' '))
    return (!filters.text || text.includes(normalized(filters.text)))
      && (!filters.setId || set?.id === filters.setId)
      && (!filters.companyId || item.grading_company_id === filters.companyId)
      && (!filters.grade || String(item.grade) === filters.grade)
      && (!filters.language || normalized(item.graded_language) === normalized(filters.language))
  })

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement des cartes gradées…</p></main>

  return <main className={styles.page}>
    <div className={styles.topLine}>
      <a className={styles.backLink} href="/collection">← Ma collection</a>
      <span className={styles.privateBadge}>Espace membre</span>
    </div>
    <header className={styles.header}>
      <p className={styles.kicker}>Ma collection · Mes cartes gradées</p>
      <h1>{mode === 'add' ? 'Ajouter une carte gradée' : 'Consulter mes cartes gradées'}</h1>
      <p>{mode === 'add' ? 'Choisis la carte du catalogue, puis renseigne les informations visibles sur son certificat. Les champs détaillés restent facultatifs.' : 'Retrouve chaque exemplaire et filtre ta collection par carte, série, société, note ou langue.'}</p>
      <nav className={styles.tabs} aria-label="Cartes gradées">
        <a className={mode === 'add' ? styles.activeTab : styles.tab} href="/collection/cartes-gradees/ajouter">Ajouter</a>
        <a className={mode === 'consult' ? styles.activeTab : styles.tab} href="/collection/cartes-gradees/consulter">Consulter</a>
      </nav>
    </header>
    {profiles.length > 1 && <label className={styles.profilePicker}>Collection
      <select value={profileId} onChange={event => setProfileId(event.target.value)}>
        {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
      </select>
    </label>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}

    {mode === 'add' ? <form className={styles.panel} onSubmit={saveCard}>
      <section>
        <h2>1. Choisir la carte</h2>
        <div className={styles.searchGrid}>
          <label>Série
            <select value={setFilter} onChange={event => { setSetFilter(event.target.value); setSelectedCard(null); setVariantId('') }}>
              <option value="">Toutes les séries</option>
              {sets.map(set => <option key={set.id} value={set.id}>{setLabel(set)} · {set.language || 'FR'}</option>)}
            </select>
          </label>
          <label>Nom ou numéro de la carte
            <input value={cardQuery} onChange={event => { setCardQuery(event.target.value); setSelectedCard(null); setVariantId('') }} minLength="2" placeholder="Ex. Dracaufeu ou 280" autoComplete="off" />
          </label>
        </div>
        {searching && <p className={styles.muted} role="status">Recherche…</p>}
        {matches.length > 0 && !selectedCard && <div className={styles.results} role="listbox" aria-label="Résultats de cartes">
          {matches.map(card => <button className={styles.result} type="button" key={card.id} onClick={() => {
            setSelectedCard(card)
            setVariantId(card.card_print_variants?.[0]?.id || '')
            setForm(current => ({ ...current, language: card.card_sets?.language || 'FR' }))
            setCardQuery(card.card_name + ' · ' + setLabel(card.card_sets) + ' · n° ' + card.collector_number)
            setMatches([])
          }}>
            <strong>{card.card_name}</strong><span>{setLabel(card.card_sets)} · n° {card.collector_number} · {card.card_sets?.language || 'FR'}{card.rarity_label ? ' · ' + card.rarity_label : ''}</span>
          </button>)}
        </div>}
        {selectedCard && <div className={styles.selectedCard}>
          <div><strong>{selectedCard.card_name}</strong><span>{setLabel(selectedCard.card_sets)} · n° {selectedCard.collector_number} · {selectedCard.card_sets?.language || 'FR'}</span></div>
          <button type="button" className={styles.textButton} onClick={() => { setSelectedCard(null); setVariantId(''); setCardQuery('') }}>Changer</button>
        </div>}
        {selectedCard && <label className={styles.variantChoice}>Version imprimée de la carte
          <select value={variantId} onChange={event => setVariantId(event.target.value)} required>
            <option value="">Choisir une version</option>
            {(selectedCard.card_print_variants || []).map(variant => <option key={variant.id} value={variant.id}>{variantLabel(variant)}</option>)}
          </select>
        </label>}
      </section>

      <section>
        <h2>2. Informations de gradation</h2>
        <div className={styles.formGrid}>
          <label>Société de gradation *
            <select required value={form.companyId} onChange={event => update('companyId', event.target.value)}>
              <option value="">Choisir</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.company_name}{company.abbreviation ? ' (' + company.abbreviation + ')' : ''}</option>)}
            </select>
          </label>
          <label>Note finale sur 10 *
            <input type="number" required min="1" max="10" step="0.5" value={form.grade} onChange={event => update('grade', event.target.value)} placeholder="10" />
          </label>
          <label>Libellé de la note (facultatif)
            <input value={form.gradeLabel} onChange={event => update('gradeLabel', event.target.value)} placeholder="Ex. NEUF+, PARFAIT" />
          </label>
          <label>Numéro de certification
            <textarea value={form.certification} onChange={event => update('certification', event.target.value)} rows="2" placeholder="Un numéro par ligne si tu ajoutes plusieurs exemplaires" />
          </label>
          <label>Lien du certificat ou QR code
            <input type="url" value={form.reportUrl} onChange={event => update('reportUrl', event.target.value)} placeholder="https://…" />
          </label>
          <label>Date de gradation
            <input type="date" value={form.gradingDate} onChange={event => update('gradingDate', event.target.value)} />
          </label>
          <label>Langue de la carte
            <input value={form.language} onChange={event => update('language', event.target.value)} maxLength="8" placeholder="FR, EN, JP…" />
          </label>
          <label>Quantité
            <input type="number" min="1" max="99" step="1" inputMode="numeric" required value={form.quantity} onChange={event => update('quantity', event.target.value)} />
          </label>
        </div>
        <fieldset className={styles.subgrades}>
          <legend>Sous-notes (facultatives)</legend>
          <div className={styles.formGrid}>
            <label>Centrage recto<input type="number" min="1" max="10" step="0.5" value={form.centeringFront} onChange={event => update('centeringFront', event.target.value)} /></label>
            <label>Centrage verso<input type="number" min="1" max="10" step="0.5" value={form.centeringBack} onChange={event => update('centeringBack', event.target.value)} /></label>
            <label>Côtés<input type="number" min="1" max="10" step="0.5" value={form.edges} onChange={event => update('edges', event.target.value)} /></label>
            <label>Coins<input type="number" min="1" max="10" step="0.5" value={form.corners} onChange={event => update('corners', event.target.value)} /></label>
            <label>Surface<input type="number" min="1" max="10" step="0.5" value={form.surface} onChange={event => update('surface', event.target.value)} /></label>
          </div>
        </fieldset>
        <div className={styles.formGrid}>
          <label>Observations recto
            <textarea rows="3" value={form.frontNotes} onChange={event => update('frontNotes', event.target.value)} placeholder="Usures, défauts ou mention du certificat" />
          </label>
          <label>Observations verso
            <textarea rows="3" value={form.backNotes} onChange={event => update('backNotes', event.target.value)} placeholder="Usures, défauts ou mention du certificat" />
          </label>
        </div>
      </section>

      <section>
        <h2>3. Achat, valeurs et photos</h2>
        <div className={styles.formGrid}>
          <label>Date d’achat
            <input type="date" value={form.purchaseDate} onChange={event => update('purchaseDate', event.target.value)} />
          </label>
          <label>Prix d’achat (€)
            <input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={event => update('purchasePrice', event.target.value)} />
          </label>
          <label>Valeur estimée par le collectionneur (€)
            <input type="number" min="0" step="0.01" value={form.declaredValue} onChange={event => update('declaredValue', event.target.value)} />
          </label>
          <div className={styles.estimateBox}>
            <strong>Estimation PokéValeur</strong>
            {estimate ? <span>{money(estimate.amount, estimate.currency)} · source : {estimate.source || 'donnée de marché'}</span> : <span>Indisponible pour cette variante, cette société et cette note.</span>}
            {estimate?.source_url && <a href={estimate.source_url} target="_blank" rel="noreferrer">Voir la source</a>}
          </div>
        </div>
        <div className={styles.photoUpload}>
          <label>Photos de la carte (recto, verso, certificat)
            <input type="file" accept="image/*" capture="environment" multiple onChange={event => setPhotos(current => [...current, ...Array.from(event.target.files || [])])} />
          </label>
          <small>Si plusieurs exemplaires sont créés avec Quantité, les photos sélectionnées seront associées à chacun.</small>
          {photos.length > 0 && <div className={styles.photoList}>{photos.map((file, index) => <span key={file.name + file.lastModified + index}>{file.name}<button type="button" aria-label={'Retirer ' + file.name} onClick={() => setPhotos(current => current.filter((_, i) => i !== index))}>×</button></span>)}</div>}
        </div>
      </section>
      <button className={styles.primaryButton} type="submit" disabled={busy || !profileId}>{busy ? 'Enregistrement…' : 'Ajouter à ma collection'}</button>
    </form> : <>
      <section className={styles.filterPanel} aria-label="Filtres de cartes gradées">
        <label>Recherche<input value={filters.text} onChange={event => setFilters(current => ({ ...current, text: event.target.value }))} placeholder="Nom, numéro, certification…" /></label>
        <label>Série<select value={filters.setId} onChange={event => setFilters(current => ({ ...current, setId: event.target.value }))}><option value="">Toutes</option>{sets.map(set => <option key={set.id} value={set.id}>{setLabel(set)}</option>)}</select></label>
        <label>Société<select value={filters.companyId} onChange={event => setFilters(current => ({ ...current, companyId: event.target.value }))}><option value="">Toutes</option>{companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label>
        <label>Note<input type="number" min="1" max="10" step="0.5" value={filters.grade} onChange={event => setFilters(current => ({ ...current, grade: event.target.value }))} placeholder="Toutes" /></label>
        <label>Langue<input value={filters.language} onChange={event => setFilters(current => ({ ...current, language: event.target.value }))} placeholder="Toutes" /></label>
      </section>
      <p className={styles.resultCount}>{filteredItems.length} exemplaire{filteredItems.length === 1 ? '' : 's'} affiché{filteredItems.length === 1 ? '' : 's'} sur {items.length}</p>
      {filteredItems.length ? <div className={styles.cardsList}>{filteredItems.map(item => {
        const variant = item.card_print_variants
        const card = variant?.cards
        const set = card?.card_sets
        const company = item.card_grading_companies
        const subs = item.subgrades || {}
        return <article className={styles.cardItem} key={item.id}>
          {signedPhotos[item.id] && <img className={styles.cardPhoto} src={signedPhotos[item.id]} alt={'Photo de ' + (card?.card_name || 'la carte gradée')} loading="lazy" />}
          <div className={styles.cardInfo}>
            <h2>{card?.card_name || 'Carte du catalogue indisponible'}</h2>
            <p>{setLabel(set)} · n° {card?.collector_number || '—'} · {variantLabel(variant)} · {item.graded_language || set?.language || 'FR'}</p>
            <p><strong>{company?.abbreviation || company?.company_name || 'Société inconnue'} {item.grade_label || item.grade}</strong>{item.certification_number ? ' · Certificat ' + item.certification_number : ''}</p>
            <p className={styles.detailLine}>Centrage recto {subs.centering_front ?? '—'} · verso {subs.centering_back ?? '—'} · côtés {subs.edges ?? '—'} · coins {subs.corners ?? '—'} · surface {subs.surface ?? '—'}</p>
            {(item.grading_front_notes || item.grading_back_notes) && <p className={styles.detailLine}>Recto : {item.grading_front_notes || '—'} · Verso : {item.grading_back_notes || '—'}</p>}
            {item.grading_report_url && <p className={styles.detailLine}><a href={item.grading_report_url} target="_blank" rel="noreferrer">Ouvrir le certificat / QR code</a></p>}
            <p className={styles.detailLine}>{item.grading_date ? 'Gradée le ' + new Date(item.grading_date + 'T00:00:00').toLocaleDateString('fr-FR') : 'Date de gradation non renseignée'}{item.purchase_date ? ' · achetée le ' + new Date(item.purchase_date + 'T00:00:00').toLocaleDateString('fr-FR') : ''}{item.purchase_price != null ? ' · achat ' + money(item.purchase_price, 'EUR') : ''}</p>
            <p className={styles.detailLine}>{item.current_value_override != null ? 'Valeur déclarée : ' + money(item.current_value_override, 'EUR') : 'Valeur manuelle non renseignée'}</p>
          </div>
        </article>
      })}</div> : <div className={styles.emptyState}><p>Aucune carte gradée ne correspond à ces filtres.</p><a href="/collection/cartes-gradees/ajouter">Ajouter une carte gradée →</a></div>}
    </>}
    <footer className={styles.footerLinks}><a href="/collection/cartes">← Mes cartes</a>{memberProfile && <span>Collection : {memberProfile.display_name}</span>}</footer>
  </main>
}
