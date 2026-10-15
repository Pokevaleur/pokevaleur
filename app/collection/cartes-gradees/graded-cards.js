'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { supabaseAnonKey, supabaseUrl } from '../../../lib/supabase-config'
import styles from './graded-cards.module.css'

const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,rarity_label,image_url,card_sets!cards_card_set_id_fkey(id,set_name,set_code,language),card_print_variants(id,variant_key,variant_label,finish_code)'
const STORAGE_BUCKET = 'collection-images'
const BINDER_PAGE_SIZE = 12
const GRADE_OPTIONS = Array.from({ length: 19 }, (_, index) => {
  const grade = 10 - index * 0.5
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(1)
})

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
  const [galleryPhotos, setGalleryPhotos] = useState({})
  const [activeItemId, setActiveItemId] = useState('')
  const [detailForm, setDetailForm] = useState({})
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailNotice, setDetailNotice] = useState('')
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const [filters, setFilters] = useState({ text: '', setId: '', companyId: '', grade: '', language: '' })
  const [selectedBinderId, setSelectedBinderId] = useState('')
  const [openedBinderId, setOpenedBinderId] = useState('')
  const [binderPage, setBinderPage] = useState(0)
  const gradedBinderViewRef = useRef(null)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const [gradePickerOpen, setGradePickerOpen] = useState(false)
  const seriesPickerRef = useRef(null)
  const gradePickerRef = useRef(null)

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const memberProfile = profiles.find(profile => profile.id === profileId)
  const selectedSet = sets.find(set => set.id === setFilter)
  const activeItem = items.find(item => item.id === activeItemId) || null
  const activeItemPhotos = activeItem ? (galleryPhotos[activeItem.id] || []) : []

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
      const [{ data: profileRows, error: profileError }, { data: setRows, error: setRowsError }, { data: companyRows, error: companyError }] = await Promise.all([
        supabase.from('collection_profiles').select('id,display_name,is_default,profile_type').order('created_at'),
        supabase.from('card_sets').select('id,set_name,set_code,language,is_public,release_date').eq('is_public', true).order('release_date', { ascending: false }),
        supabase.from('card_grading_companies').select('id,company_name,abbreviation').eq('is_active', true).order('company_name')
      ])
      if (cancelled) return
      if (profileError) throw profileError
      if (setRowsError) throw setRowsError
      let availableCompanies = companyRows || []
      if (companyError || availableCompanies.length === 0) {
        const companyUrl = new URL('/rest/v1/card_grading_companies', supabaseUrl)
        companyUrl.searchParams.set('select', 'id,company_name,abbreviation')
        companyUrl.searchParams.set('is_active', 'eq.true')
        companyUrl.searchParams.set('order', 'company_name')
        const companyResponse = await fetch(companyUrl.toString(), {
          headers: { apikey: supabaseAnonKey, Authorization: 'Bearer ' + supabaseAnonKey },
          cache: 'no-store'
        })
        if (!companyResponse.ok) throw new Error('Impossible de charger les sociétés de gradation.')
        availableCompanies = await companyResponse.json()
      }
      if (!availableCompanies.length) throw new Error('Aucune société de gradation active n’est disponible pour le moment.')
      const availableProfiles = profileRows || []
      const saved = window.localStorage.getItem('pokevaleur-collection:' + signedInUser.id)
      const active = availableProfiles.find(row => row.id === saved) || availableProfiles.find(row => row.is_default) || availableProfiles[0]
      setProfiles(availableProfiles)
      setSets(setRows || [])
      setCompanies(availableCompanies)
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
    if (!seriesPickerOpen && !gradePickerOpen) return
    function closeOutside(event) {
      if (!seriesPickerRef.current?.contains(event.target)) setSeriesPickerOpen(false)
      if (!gradePickerRef.current?.contains(event.target)) setGradePickerOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setSeriesPickerOpen(false)
        setGradePickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [seriesPickerOpen, gradePickerOpen])

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
          .select('id,card_print_variant_id,grade,grade_label,certification_number,grading_company_id,subgrades,graded_language,grading_date,grading_report_url,grading_front_notes,grading_back_notes,purchase_date,purchase_price,current_value_override,photo_path,created_at,collection_card_photos(id,photo_path,caption,sort_order),card_grading_companies(company_name,abbreviation),card_print_variants!inner(id,variant_label,variant_key,image_url,cards!card_print_variants_card_id_fkey!inner(id,card_name,collector_number,rarity_label,image_url,card_sets!cards_card_set_id_fkey(id,set_name,set_code,language)))')
          .eq('collection_profile_id', profileId).eq('ownership_type', 'graded')
          .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        if (listError) throw listError
        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
      }
      const photosByItem = await Promise.all(rows.map(async row => {
        const references = (row.collection_card_photos || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(photo => ({ id: photo.id, path: photo.photo_path, caption: photo.caption || 'Photo de la carte' }))
        if (row.photo_path && !references.some(photo => photo.path === row.photo_path)) {
          references.unshift({ id: 'legacy-' + row.id, path: row.photo_path, caption: 'Photo de la carte' })
        }
        const photos = await Promise.all(references.map(async photo => {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(photo.path, 3600)
          return data?.signedUrl ? { ...photo, url: data.signedUrl } : null
        }))
        return [row.id, photos.filter(Boolean)]
      }))
      const photoMap = Object.fromEntries(photosByItem)
      setItems(rows)
      setGalleryPhotos(photoMap)
      setSignedPhotos(Object.fromEntries(Object.entries(photoMap).map(([id, photos]) => [id, photos[0]?.url || ''])))
    } catch (listError) {
      setError(listError.message || 'Impossible de charger les cartes gradées.')
    } finally {
      setLoading(false)
    }
  }, [mode, profileId, supabase])

  useEffect(() => { loadCollection() }, [loadCollection])

  useEffect(() => {
    if (mode !== 'consult' || !openedBinderId || openedBinderId !== selectedBinderId) return
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        gradedBinderViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [mode, openedBinderId, selectedBinderId, binderPage])

  function openGradedDetails(item) {
    const subs = item.subgrades || {}
    setDetailForm({
      companyId: item.grading_company_id || '',
      grade: item.grade == null ? '' : String(item.grade),
      gradeLabel: item.grade_label || '',
      certification: item.certification_number || '',
      reportUrl: item.grading_report_url || '',
      gradingDate: item.grading_date || '',
      language: item.graded_language || '',
      purchaseDate: item.purchase_date || '',
      purchasePrice: item.purchase_price == null ? '' : String(item.purchase_price),
      declaredValue: item.current_value_override == null ? '' : String(item.current_value_override),
      centeringFront: subs.centering_front == null ? '' : String(subs.centering_front),
      centeringBack: subs.centering_back == null ? '' : String(subs.centering_back),
      edges: subs.edges == null ? '' : String(subs.edges),
      corners: subs.corners == null ? '' : String(subs.corners),
      surface: subs.surface == null ? '' : String(subs.surface),
      frontNotes: item.grading_front_notes || '',
      backNotes: item.grading_back_notes || ''
    })
    setDetailError('')
    setDetailNotice('')
    setConfirmRemoval(false)
    setActiveItemId(item.id)
  }

  function updateDetail(key, value) {
    setDetailForm(current => ({ ...current, [key]: value }))
  }

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

  async function saveGradedDetails(event) {
    event.preventDefault()
    if (!activeItem) return
    setDetailError('')
    setDetailNotice('')
    if (detailForm.grade && (Number(detailForm.grade) < 1 || Number(detailForm.grade) > 10)) {
      setDetailError('La note doit être comprise entre 1 et 10.')
      return
    }
    setDetailBusy(true)
    const subgrades = {
      centering_front: nullableNumber(detailForm.centeringFront),
      centering_back: nullableNumber(detailForm.centeringBack),
      edges: nullableNumber(detailForm.edges),
      corners: nullableNumber(detailForm.corners),
      surface: nullableNumber(detailForm.surface)
    }
    const updates = {
      grading_company_id: detailForm.companyId || null,
      grade: nullableNumber(detailForm.grade),
      grade_label: detailForm.gradeLabel.trim() || null,
      certification_number: detailForm.certification.trim() || null,
      grading_report_url: detailForm.reportUrl.trim() || null,
      grading_date: detailForm.gradingDate || null,
      graded_language: detailForm.language.trim().toUpperCase() || null,
      purchase_date: detailForm.purchaseDate || null,
      purchase_price: nullableNumber(detailForm.purchasePrice),
      current_value_override: nullableNumber(detailForm.declaredValue),
      subgrades,
      grading_front_notes: detailForm.frontNotes.trim() || null,
      grading_back_notes: detailForm.backNotes.trim() || null
    }
    try {
      const { data, error: updateError } = await supabase.from('collection_cards')
        .update(updates)
        .eq('id', activeItem.id)
        .eq('collection_profile_id', profileId)
        .eq('ownership_type', 'graded')
        .select('id')
      if (updateError) throw updateError
      if (!data?.length) throw new Error('La fiche n’a pas pu être modifiée. Vérifie que tu as accès à cette collection.')
      const company = companies.find(row => row.id === updates.grading_company_id) || null
      setItems(current => current.map(item => item.id === activeItem.id
        ? { ...item, ...updates, card_grading_companies: company }
        : item))
      setDetailNotice('Les informations de cette carte ont été enregistrées.')
    } catch (saveError) {
      setDetailError(saveError.message || 'Impossible d’enregistrer les modifications.')
    } finally {
      setDetailBusy(false)
    }
  }

  async function removeGradedCard() {
    if (!activeItem || !confirmRemoval) return
    setDetailBusy(true)
    setDetailError('')
    setDetailNotice('')
    try {
      const paths = [...new Set([
        activeItem.photo_path,
        ...activeItemPhotos.map(photo => photo.path)
      ].filter(Boolean))]
      const { data, error: deleteError } = await supabase.from('collection_cards')
        .delete()
        .eq('id', activeItem.id)
        .eq('collection_profile_id', profileId)
        .eq('ownership_type', 'graded')
        .select('id')
      if (deleteError) throw deleteError
      if (!data?.length) throw new Error('La carte n’a pas été retirée. Vérifie que tu as accès à cette collection.')
      setItems(current => current.filter(item => item.id !== activeItem.id))
      setGalleryPhotos(current => { const next = { ...current }; delete next[activeItem.id]; return next })
      setSignedPhotos(current => { const next = { ...current }; delete next[activeItem.id]; return next })
      setActiveItemId('')
      setConfirmRemoval(false)
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
        if (storageError) {
          setNotice('La carte a été retirée. Une photo associée n’a pas pu être supprimée du stockage.')
          return
        }
      }
      setNotice('La carte gradée a été retirée de ta collection.')
    } catch (removeError) {
      setDetailError(removeError.message || 'Impossible de retirer cette carte de la collection.')
    } finally {
      setDetailBusy(false)
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

  const gradedCountsBySet = items.reduce((counts, item) => {
    const setId = item.card_print_variants?.cards?.card_sets?.id
    if (setId) counts[setId] = (counts[setId] || 0) + 1
    return counts
  }, {})
  const gradedBinderSets = sets.filter(set => gradedCountsBySet[set.id] > 0)
  const gradedCountsByCompany = items.reduce((counts, item) => {
    const companyId = item.grading_company_id
    if (companyId) counts[companyId] = (counts[companyId] || 0) + 1
    return counts
  }, {})
  const gradedBinderCompanies = companies.filter(company => gradedCountsByCompany[company.id] > 0)
  const selectedBinderSetId = selectedBinderId.startsWith('series:') ? selectedBinderId.slice(7) : ''
  const selectedBinderCompanyId = selectedBinderId.startsWith('company:') ? selectedBinderId.slice(8) : ''
  const selectedBinderSet = gradedBinderSets.find(set => set.id === selectedBinderSetId) || null
  const selectedBinderCompany = gradedBinderCompanies.find(company => company.id === selectedBinderCompanyId) || null
  const selectedBinderItems = selectedBinderId === 'all'
    ? filteredItems
    : selectedBinderSetId
      ? filteredItems.filter(item => item.card_print_variants?.cards?.card_sets?.id === selectedBinderSetId)
      : selectedBinderCompanyId
        ? filteredItems.filter(item => item.grading_company_id === selectedBinderCompanyId)
        : []
  const binderTotalPages = Math.ceil(selectedBinderItems.length / BINDER_PAGE_SIZE)
  const visibleBinderItems = openedBinderId && openedBinderId === selectedBinderId ? selectedBinderItems.slice(binderPage * BINDER_PAGE_SIZE, (binderPage + 1) * BINDER_PAGE_SIZE) : []
  const binderCoverItem = selectedBinderItems[0] || items[0] || null
  const binderCoverArt = binderCoverItem ? signedPhotos[binderCoverItem.id] || binderCoverItem.card_print_variants?.image_url || binderCoverItem.card_print_variants?.cards?.image_url : ''
  const selectedBinderName = selectedBinderId === 'all' ? 'Toutes les séries' : selectedBinderSet?.set_name || selectedBinderCompany?.company_name
  const selectedBinderCount = selectedBinderItems.length
  const selectedBinderHue = selectedBinderId === 'all'
    ? 220
    : Array.from(selectedBinderSet?.set_code || selectedBinderCompany?.abbreviation || selectedBinderSet?.id || selectedBinderCompany?.id || '').reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360

  function selectGradedBinder(id, type = 'all') {
    const binderId = type === 'series' ? 'series:' + id : type === 'company' ? 'company:' + id : 'all'
    setSelectedBinderId(binderId)
    setOpenedBinderId('')
    setBinderPage(0)
    setFilters(current => ({
      ...current,
      setId: type === 'series' ? id : '',
      companyId: type === 'company' ? id : ''
    }))
  }

  function updateConsultFilter(key, value) {
    setFilters(current => ({ ...current, [key]: value }))
    setBinderPage(0)
    if (key === 'setId' || key === 'companyId') {
      setSelectedBinderId(value ? (key === 'setId' ? 'series:' : 'company:') + value : 'all')
      setOpenedBinderId('')
    }
  }

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement des cartes gradées…</p></main>

  return <main className={styles.page}>
    <div className={styles.topLine}>
      <a className={styles.backLink} href="/collection">← Ma collection</a>
      <span className={styles.privateBadge}>Espace membre</span>
    </div>
    <header className={styles.header}>
      <h1>{mode === 'add' ? 'Ajouter une carte gradée' : 'Consulter mes cartes gradées'}</h1>
      <p>{mode === 'add' ? 'Choisis la carte du catalogue, puis renseigne les informations visibles sur son certificat. Les champs détaillés restent facultatifs.' : 'Retrouve chaque exemplaire et filtre ta collection par carte, série, société, note ou langue.'}</p>
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
            <div className={styles.customPicker} ref={seriesPickerRef}>
              <button
                type="button"
                className={styles.customPickerTrigger}
                aria-haspopup="listbox"
                aria-expanded={seriesPickerOpen}
                aria-label="Choisir une série"
                onClick={() => { setGradePickerOpen(false); setSeriesPickerOpen(open => !open) }}
                disabled={!sets.length}
              >
                <span>{setFilter ? (selectedSet ? setLabel(selectedSet) + ' · ' + (selectedSet.language || 'FR') : 'Choisir une série') : 'Toutes les séries'}</span>
                <span className={styles.customPickerChevron} aria-hidden="true">▾</span>
              </button>
              {seriesPickerOpen && (
                <div className={styles.customPickerOptions} role="listbox" aria-label="Séries de cartes">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!setFilter}
                    className={!setFilter ? styles.customPickerOptionActive : styles.customPickerOption}
                    onClick={() => { setSetFilter(''); setSelectedCard(null); setVariantId(''); setSeriesPickerOpen(false) }}
                  >Toutes les séries</button>
                  {sets.map(set => {
                    const selected = set.id === setFilter
                    return <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={selected ? styles.customPickerOptionActive : styles.customPickerOption}
                      key={set.id}
                      onClick={() => { setSetFilter(set.id); setSelectedCard(null); setVariantId(''); setSeriesPickerOpen(false) }}
                    >{setLabel(set)} · {set.language || 'FR'}</button>
                  })}
                </div>
              )}
            </div>
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
            <div className={styles.customPicker} ref={gradePickerRef}>
              <button
                type="button"
                className={styles.customPickerTrigger}
                aria-haspopup="listbox"
                aria-expanded={gradePickerOpen}
                aria-label="Choisir une note finale"
                onClick={() => { setSeriesPickerOpen(false); setGradePickerOpen(open => !open) }}
                aria-required="true"
              >
                <span>{form.grade ? Number(form.grade).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : 'Choisir une note'}</span>
                <span className={styles.customPickerChevron} aria-hidden="true">▾</span>
              </button>
              {gradePickerOpen && (
                <div className={styles.customPickerOptions} role="listbox" aria-label="Notes de 1 à 10">
                  {GRADE_OPTIONS.map(grade => {
                    const selected = form.grade === grade
                    return <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={selected ? styles.customPickerOptionActive : styles.customPickerOption}
                      key={grade}
                      onClick={() => { update('grade', grade); setGradePickerOpen(false) }}
                    >{Number(grade).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</button>
                  })}
                </div>
              )}
            </div>
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
      <section className={styles.gradedLibrarySection} aria-label="Classeurs de cartes gradées par série">
        <div className={styles.gradedLibraryHeading}>
          <h2>Classeurs par série</h2>
          <span>{gradedBinderSets.length} série{gradedBinderSets.length === 1 ? '' : 's'}</span>
        </div>
        <div className={styles.gradedLibrary}>
          <button type="button"
            className={selectedBinderId === 'all' ? styles.gradedBinderActive : styles.gradedBinderAll}
            aria-pressed={selectedBinderId === 'all'} onClick={() => selectGradedBinder('', 'all')}>
            <strong>Toutes</strong><span>{items.length}</span>
          </button>
          {gradedBinderSets.map(set => {
            const hue = Array.from(set.set_code || set.id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360
            const binderId = 'series:' + set.id
            const active = selectedBinderId === binderId
            return <button key={binderId} type="button"
              className={active ? styles.gradedBinderActive : styles.gradedBinder}
              style={{ '--binder-hue': hue }} aria-pressed={active}
              aria-label={set.set_name + ', ' + gradedCountsBySet[set.id] + ' carte' + (gradedCountsBySet[set.id] === 1 ? '' : 's') + ' gradée' + (gradedCountsBySet[set.id] === 1 ? '' : 's')}
              onClick={() => selectGradedBinder(set.id, 'series')}>
              <span className={styles.gradedBinderCode}>{set.set_code || set.set_name}</span>
              <span className={styles.gradedBinderName}>{set.set_name}</span>
              <span className={styles.gradedBinderCount}>{gradedCountsBySet[set.id]}</span>
            </button>
          })}
        </div>
      </section>
      <section className={styles.gradedLibrarySection} aria-label="Classeurs de cartes gradées par société">
        <div className={styles.gradedLibraryHeading}>
          <h2>Classeurs par société de gradation</h2>
          <span>{gradedBinderCompanies.length} société{gradedBinderCompanies.length === 1 ? '' : 's'}</span>
        </div>
        <div className={styles.gradedLibrary}>
          {gradedBinderCompanies.map(company => {
            const binderId = 'company:' + company.id
            const label = company.abbreviation || company.company_name
            const hue = Array.from(label).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360
            const active = selectedBinderId === binderId
            return <button key={binderId} type="button"
              className={active ? styles.gradedBinderActive : styles.gradedBinder}
              style={{ '--binder-hue': hue }} aria-pressed={active}
              aria-label={company.company_name + ', ' + gradedCountsByCompany[company.id] + ' carte' + (gradedCountsByCompany[company.id] === 1 ? '' : 's') + ' gradée' + (gradedCountsByCompany[company.id] === 1 ? '' : 's')}
              onClick={() => selectGradedBinder(company.id, 'company')}>
              <span className={styles.gradedBinderCode}>{label}</span>
              <span className={styles.gradedBinderName}>{company.company_name}</span>
              <span className={styles.gradedBinderCount}>{gradedCountsByCompany[company.id]}</span>
            </button>
          })}
        </div>
      </section>
      {selectedBinderId && !openedBinderId && (selectedBinderId === 'all' || selectedBinderSet || selectedBinderCompany) && <section className={styles.gradedCoverStage} aria-label="Couverture du classeur">
        <div className={styles.gradedCoverBook} style={{ '--cover-hue': selectedBinderHue }}>
          {binderCoverArt && <img src={binderCoverArt} alt="" className={styles.gradedCoverArtwork} />}
          <div className={styles.gradedCoverSpine}>{selectedBinderId === 'all' ? 'POKÉVALEUR' : (selectedBinderSet?.set_code || selectedBinderCompany?.abbreviation || 'SÉRIE')}</div>
          <div className={styles.gradedCoverFace}>
            <span>POKÉVALEUR · CLASSEUR GRADÉ</span>
            <strong>{selectedBinderName}</strong>
            <small>{selectedBinderCount} exemplaire{selectedBinderCount === 1 ? '' : 's'}</small>
          </div>
        </div>
        <div className={styles.gradedCoverDetails}>
          <p className={styles.gradedCoverKicker}>Ta collection, mise en classeur</p>
          <h2>{selectedBinderName}</h2>
          <p>{selectedBinderId === 'all' ? 'Toutes les séries de tes cartes gradées sont réunies ici.' : selectedBinderCompany ? 'Retrouve tes cartes gradées par cette société.' : 'Retrouve les cartes gradées de cette série, dans leur boîtier.'}</p>
          <button className={styles.gradedOpenButton} type="button" onClick={() => { setOpenedBinderId(selectedBinderId); setBinderPage(0) }}>
            Ouvrir le classeur <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>}
      <section className={styles.filterPanel} aria-label="Filtres de cartes gradées">
        <label>Recherche<input value={filters.text} onChange={event => updateConsultFilter('text', event.target.value)} placeholder="Nom, numéro, certification…" /></label>
        <label>Série<select value={filters.setId} onChange={event => updateConsultFilter('setId', event.target.value)}><option value="">Toutes</option>{sets.map(set => <option key={set.id} value={set.id}>{setLabel(set)}</option>)}</select></label>
        <label>Société<select value={filters.companyId} onChange={event => updateConsultFilter('companyId', event.target.value)}><option value="">Toutes</option>{companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label>
        <label>Note<input type="number" min="1" max="10" step="0.5" value={filters.grade} onChange={event => updateConsultFilter('grade', event.target.value)} placeholder="Toutes" /></label>
        <label>Langue<input value={filters.language} onChange={event => updateConsultFilter('language', event.target.value)} placeholder="Toutes" /></label>
      </section>
      {openedBinderId && openedBinderId === selectedBinderId && <section className={styles.gradedBinderView} ref={gradedBinderViewRef}>
        <div className={styles.gradedOpenHeader}>
          <div><h2>{selectedBinderName}</h2><p>{selectedBinderItems.length} cartes gradées</p></div>
          <button className={styles.gradedBackToCover} type="button" onClick={() => setOpenedBinderId('')}>← Retour à la couverture</button>
        </div>
        {selectedBinderItems.length ? <>
          <nav className={styles.gradedPageNav} aria-label="Pages du classeur">
            <button type="button" onClick={() => setBinderPage(page => Math.max(0, page - 1))} disabled={binderPage === 0} aria-label="Page précédente">←</button>
            <span>Page {binderPage + 1} / {binderTotalPages}</span>
            <button type="button" onClick={() => setBinderPage(page => Math.min(binderTotalPages - 1, page + 1))} disabled={binderPage >= binderTotalPages - 1} aria-label="Page suivante">→</button>
          </nav>
          <div className={styles.gradedBookSpread}>
            <section className={styles.gradedBookPage} aria-label={'Page ' + (binderPage + 1) + ' du classeur'}>
              <div className={styles.gradedPageTop}><span>{selectedBinderName}</span><span>{binderPage + 1}</span></div>
              
              <div className={styles.gradedCardsGrid}>
                {Array.from({ length: BINDER_PAGE_SIZE }, (_, slotIndex) => {
                  const item = visibleBinderItems[slotIndex]
                  if (!item) return <div className={styles.gradedEmptySlot} key={'empty-' + binderPage + '-' + slotIndex} aria-label={'Emplacement libre ' + (slotIndex + 1)}><span>Emplacement libre</span></div>
                  const variant = item.card_print_variants
                  const card = variant?.cards
                  const company = item.card_grading_companies
                  const artwork = signedPhotos[item.id] || variant?.image_url || card?.image_url
                  const companyLabel = company?.abbreviation || company?.company_name || 'GRADÉE'
                  return <button type="button" key={item.id} className={styles.gradedSlabButton}
                    onClick={() => openGradedDetails(item)}
                    aria-label={'Ouvrir la fiche de ' + (card?.card_name || 'la carte') + ', ' + companyLabel + ' note ' + (item.grade_label || item.grade || 'non renseignée')}>
                    <span className={styles.gradedSlab}>
                      <span className={styles.gradedSlabLabel}><span>{companyLabel}</span><strong>{item.grade == null ? '—' : Number(item.grade).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</strong></span>
                      <span className={styles.gradedSlabWindow}>{artwork ? <img src={artwork} alt="" loading="lazy" /> : <span>{card?.card_name || 'Carte gradée'}</span>}</span>
                    </span>
                    <span className={styles.gradedSlabName}>{card?.card_name || 'Carte gradée'}</span>
                    <span className={styles.gradedSlabMeta}>{card?.collector_number ? 'n° ' + card.collector_number : setLabel(card?.card_sets)}</span>
                  </button>
                })}
              </div>
            </section>
          </div>
        </> : <div className={styles.emptyState}><p>Aucune carte gradée ne correspond à ces filtres.</p></div>}
      </section>}
      {!selectedBinderId && <p className={styles.emptyState}>Choisis un classeur pour afficher sa couverture et ouvrir les cartes gradées de la série.</p>}


    </>}
    {mode === 'consult' && activeItem && <div className={styles.detailBackdrop} onClick={() => { if (!detailBusy) setActiveItemId('') }}>
      <section
        className={styles.detailDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="graded-detail-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.detailHeader}>
          <div>
            <h2 id="graded-detail-title">{activeItem.card_print_variants?.cards?.card_name || 'Carte gradée'}</h2>
            <p>{setLabel(activeItem.card_print_variants?.cards?.card_sets)} · n° {activeItem.card_print_variants?.cards?.collector_number || '—'}</p>
          </div>
          <button type="button" className={styles.detailClose} aria-label="Fermer la fiche" onClick={() => setActiveItemId('')} disabled={detailBusy}>×</button>
        </div>
        {activeItemPhotos.length ? <div className={styles.photoGallery} aria-label="Photos associées à cette carte">
          {activeItemPhotos.map(photo => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
            <img src={photo.url} alt={photo.caption || 'Photo de la carte gradée'} />
            <span>{photo.caption || 'Voir la photo en grand'}</span>
          </a>)}
        </div> : <p className={styles.noPhotos}>Aucune photo n’est encore associée à cette carte.</p>}
        {detailError && <p className={styles.error} role="alert">{detailError}</p>}
        {detailNotice && <p className={styles.notice} role="status">{detailNotice}</p>}
        <form className={styles.detailForm} onSubmit={saveGradedDetails}>
          <section>
            <h3>Informations de gradation</h3>
            <div className={styles.formGrid}>
              <label>Société de gradation
                <select value={detailForm.companyId || ''} onChange={event => updateDetail('companyId', event.target.value)}>
                  <option value="">Non renseignée</option>
                  {companies.map(company => <option key={company.id} value={company.id}>{company.company_name}{company.abbreviation ? ' (' + company.abbreviation + ')' : ''}</option>)}
                </select>
              </label>
              <label>Note finale sur 10
                <select value={detailForm.grade || ''} onChange={event => updateDetail('grade', event.target.value)}>
                  <option value="">Non renseignée</option>
                  {GRADE_OPTIONS.map(grade => <option key={grade} value={grade}>{Number(grade).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</option>)}
                </select>
              </label>
              <label>Libellé de la note
                <input value={detailForm.gradeLabel || ''} onChange={event => updateDetail('gradeLabel', event.target.value)} placeholder="Ex. PARFAIT, GEM MINT" />
              </label>
              <label>Numéro de certification
                <input value={detailForm.certification || ''} onChange={event => updateDetail('certification', event.target.value)} />
              </label>
              <label>Lien du certificat ou QR code
                <input type="url" value={detailForm.reportUrl || ''} onChange={event => updateDetail('reportUrl', event.target.value)} placeholder="https://…" />
              </label>
              <label>Date de gradation
                <input type="date" value={detailForm.gradingDate || ''} onChange={event => updateDetail('gradingDate', event.target.value)} />
              </label>
              <label>Langue de la carte
                <input value={detailForm.language || ''} onChange={event => updateDetail('language', event.target.value)} maxLength="8" placeholder="FR, EN, JP…" />
              </label>
              <label>Date d’achat
                <input type="date" value={detailForm.purchaseDate || ''} onChange={event => updateDetail('purchaseDate', event.target.value)} />
              </label>
              <label>Prix d’achat (€)
                <input type="number" min="0" step="0.01" value={detailForm.purchasePrice || ''} onChange={event => updateDetail('purchasePrice', event.target.value)} />
              </label>
              <label>Valeur donnée par le collectionneur (€)
                <input type="number" min="0" step="0.01" value={detailForm.declaredValue || ''} onChange={event => updateDetail('declaredValue', event.target.value)} />
              </label>
            </div>
            <fieldset className={styles.subgrades}>
              <legend>Sous-notes</legend>
              <div className={styles.formGrid}>
                <label>Centrage recto<input type="number" min="1" max="10" step="0.5" value={detailForm.centeringFront || ''} onChange={event => updateDetail('centeringFront', event.target.value)} /></label>
                <label>Centrage verso<input type="number" min="1" max="10" step="0.5" value={detailForm.centeringBack || ''} onChange={event => updateDetail('centeringBack', event.target.value)} /></label>
                <label>Côtés<input type="number" min="1" max="10" step="0.5" value={detailForm.edges || ''} onChange={event => updateDetail('edges', event.target.value)} /></label>
                <label>Coins<input type="number" min="1" max="10" step="0.5" value={detailForm.corners || ''} onChange={event => updateDetail('corners', event.target.value)} /></label>
                <label>Surface<input type="number" min="1" max="10" step="0.5" value={detailForm.surface || ''} onChange={event => updateDetail('surface', event.target.value)} /></label>
              </div>
            </fieldset>
            <div className={styles.formGrid}>
              <label>Observations recto<textarea rows="3" value={detailForm.frontNotes || ''} onChange={event => updateDetail('frontNotes', event.target.value)} /></label>
              <label>Observations verso<textarea rows="3" value={detailForm.backNotes || ''} onChange={event => updateDetail('backNotes', event.target.value)} /></label>
            </div>
          </section>
          <div className={styles.detailActions}>
            <button className={styles.primaryButton} type="submit" disabled={detailBusy}>{detailBusy ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
            <button className={styles.removeButton} type="button" onClick={() => { setConfirmRemoval(true); setDetailError('') }} disabled={detailBusy}>Retirer de la collection</button>
          </div>
          {confirmRemoval && <div className={styles.removeConfirm} role="alertdialog" aria-label="Confirmer le retrait de la carte">
            <p>Retirer cette carte gradée et ses photos associées de ta collection ? Cette action ne pourra pas être annulée.</p>
            <div>
              <button className={styles.removeButton} type="button" onClick={removeGradedCard} disabled={detailBusy}>{detailBusy ? 'Retrait…' : 'Confirmer le retrait'}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => setConfirmRemoval(false)} disabled={detailBusy}>Annuler</button>
            </div>
          </div>}
        </form>
      </section>
    </div>}
    <footer className={styles.footerLinks}><a href="/collection/cartes">← Mes cartes</a>{memberProfile && <span>Collection : {memberProfile.display_name}</span>}</footer>
  </main>
}
