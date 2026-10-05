'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { ProfileAvatar } from '../../lib/profile-avatars'
import { fetchAllRows } from '../../lib/supabase-pagination'
import { createProductMatcher, normalizeSearch } from '../../lib/product-search.mjs'
import { filterCollectionItems } from '../../lib/collection-search.mjs'
import { calculateCollectionStatistics, calculateCollectionItemCounts, hasPurchasePrice } from '../../lib/collection-statistics.mjs'
import { saveUploadedPhotoBatch, uploadUnlinkedPhotoBatch } from '../../lib/collection-photo-save.mjs'

const emptyForm = {
  custom_name: '',
  quantity: 1,
  purchase_price: '',
  purchase_date: '',
  purchase_place: '',
  seller_name: '',
  product_id: '',
  current_value_override: '',
  sealed_condition: 'standard',
  booster_configuration: '',
  variant_note: ''
}

export default function CollectionPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [profileIdentity, setProfileIdentity] = useState(null)
  const [collectionProfiles, setCollectionProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState(null)
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false)
  const activeProfileIdRef = useRef(null)
  const loadRequestRef = useRef(0)
  const [childName, setChildName] = useState('')
  const [familyMessage, setFamilyMessage] = useState('')
  const [transferLink, setTransferLink] = useState('')
  const [items, setItems] = useState([])
  const [collectionCardCopies, setCollectionCardCopies] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [showCollectionItems, setShowCollectionItems] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [conditionFilter, setConditionFilter] = useState('all')
  const [catalog, setCatalog] = useState([])
  const [catalogMatches, setCatalogMatches] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const catalogIndexRef = useRef(null)
  const preselectedProductRef = useRef(null)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [editPhotoFiles, setEditPhotoFiles] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [photoGallery, setPhotoGallery] = useState({ itemId: null, photos: [], loading: false, busy: false, message: '' })
  const photoOrderPendingRef = useRef(false)
  const [photoStepDone, setPhotoStepDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loginNext, setLoginNext] = useState('/collection')
  const addItemPendingRef = useRef(false)
  const [photoUploadState, setPhotoUploadState] = useState({})
  const [collectionVoiceListening, setCollectionVoiceListening] = useState(false)
  const activeCollectionProfile = collectionProfiles.find(profile => profile.id === activeProfileId)

  const editPhotoUploadStatus = photoUploadState[editingId]?.status
  useEffect(() => {
    if (!editingId || editPhotoUploadStatus === 'uploading') return
    let cancelled = false
    setPhotoGallery({ itemId: editingId, photos: [], loading: true, busy: false, message: '' })
    async function fetchGallery() {
      try {
        const { data, error } = await fetchAllRows(() => supabase.from('collection_item_photos')
          .select('id,photo_path,sort_order').eq('collection_item_id', editingId)
          .order('sort_order').order('id'))
        if (error) throw error
        const photos = await Promise.all((data || []).map(async photo => {
          const { data: signed } = await supabase.storage.from('collection-images').createSignedUrl(photo.photo_path, 3600)
          return { ...photo, url: signed?.signedUrl || null }
        }))
        if (!cancelled) setPhotoGallery({ itemId: editingId, photos, loading: false, busy: false, message: '' })
      } catch {
        if (!cancelled) setPhotoGallery({ itemId: editingId, photos: [], loading: false, busy: false, message: 'Impossible de charger les photos. Ferme puis rouvre la fiche pour réessayer.' })
      }
    }
    fetchGallery()
    return () => { cancelled = true }
  }, [editingId, activeProfileId, editPhotoUploadStatus, supabase])

  async function changePhotoOrder(itemId, index, targetIndex) {
    if (photoOrderPendingRef.current || photoGallery.loading || editPhotoUploadStatus === 'uploading' || photoGallery.itemId !== itemId) return
    const next = [...photoGallery.photos]
    if (index < 0 || targetIndex < 0 || index >= next.length || targetIndex >= next.length) return
    const [photo] = next.splice(index, 1)
    next.splice(targetIndex, 0, photo)
    const profileId = activeProfileIdRef.current
    photoOrderPendingRef.current = true
    setPhotoGallery(prev => ({ ...prev, busy: true, message: 'Enregistrement de l’ordre…' }))
    try {
      const { error } = await supabase.rpc('set_collection_item_photo_order', { p_item_id: itemId, p_photo_ids: next.map(entry => entry.id) })
      if (error) throw error
      if (activeProfileIdRef.current !== profileId) return
      setPhotoGallery(prev => prev.itemId === itemId ? { ...prev, photos: next, busy: false, message: '✓ Ordre et photo principale enregistrés.' } : prev)
      await load(profileId)
    } catch (error) {
      setPhotoGallery(prev => prev.itemId === itemId ? { ...prev, busy: false, message: `Impossible de changer l’ordre : ${error.message || 'réessaie après avoir rouvert la fiche.'}` } : prev)
    } finally {
      photoOrderPendingRef.current = false
    }
  }

  async function load(preferredProfileId = activeProfileIdRef.current) {
    const requestId = ++loadRequestRef.current
    const isCurrentRequest = () => requestId === loadRequestRef.current
    const { data: { user } } = await supabase.auth.getUser()
    if (!isCurrentRequest()) return
    setUser(user)
    if (!user) return

    const { data: identity } = await supabase.from('profiles')
      .select('display_name,avatar_key').eq('id', user.id).maybeSingle()
    if (!isCurrentRequest()) return
    setProfileIdentity(identity || null)

    const { data: profileRows, error: profilesError } = await supabase
      .from('collection_profiles')
      .select('id,profile_type,is_default,display_name,avatar_key,transferred_at')
      .order('created_at')
    if (!isCurrentRequest()) return
    if (profilesError) {
      setMessage(profilesError.message)
      return
    }
    const availableProfiles = profileRows || []
    setCollectionProfiles(availableProfiles)
    const savedProfileId = typeof window !== 'undefined' ? window.localStorage.getItem(`pokevaleur-collection:${user.id}`) : null
    const selectedProfile = availableProfiles.find(profile => profile.id === preferredProfileId)
      || availableProfiles.find(profile => profile.id === savedProfileId)
      || availableProfiles.find(profile => profile.is_default)
    if (!selectedProfile) {
      setMessage('Aucun profil de collection disponible pour ce compte.')
      return
    }
    activeProfileIdRef.current = selectedProfile.id
    setActiveProfileId(selectedProfile.id)
    if (typeof window !== 'undefined') window.localStorage.setItem(`pokevaleur-collection:${user.id}`, selectedProfile.id)

    const [itemsResult, cardCopiesResult] = await Promise.all([
      fetchAllRows(() => supabase
        .from('collection_items')
        .select('*')
        .eq('collection_profile_id', selectedProfile.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })),
      fetchAllRows(() => supabase
        .from('collection_cards')
        .select('id,ownership_type')
        .eq('collection_profile_id', selectedProfile.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }))
    ])
    const { data, error } = itemsResult
    const { data: cardCopies, error: cardCopiesError } = cardCopiesResult
    if (!isCurrentRequest()) return

    if (cardCopiesError) {
      setCollectionCardCopies(null)
      setMessage('Impossible de charger le total des cartes pour le moment.')
    } else {
      setCollectionCardCopies(cardCopies || [])
    }

    if (error) {
      setMessage(error.message)
    } else {
      const rows = data || []
      setItems(rows)

      const productIds = [...new Set(rows.map(item => item.product_id).filter(Boolean))]
      const linkedProducts = []
      for (let offset = 0; offset < productIds.length; offset += 100) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id,name,series,category,current_value,zero_defect_value,image_url')
          .eq('is_public', true)
          .in('id', productIds.slice(offset, offset + 100))
        if (!productsError) linkedProducts.push(...(products || []))
        if (!isCurrentRequest()) return
      }
      setCatalog(linkedProducts)

      const signedEntries = await Promise.all(
        rows
          .filter(item => item.photo_path)
          .map(async item => {
            const { data: signed } = await supabase.storage
              .from('collection-images')
              .createSignedUrl(item.photo_path, 3600)
            return [item.id, signed?.signedUrl || null]
          })
      )
      if (!isCurrentRequest()) return

      setPhotoUrls(Object.fromEntries(signedEntries.filter(([, url]) => url)))
    }
  }

  function startVoiceSearch(onResult, setListening) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      window.alert('La recherche vocale n’est pas disponible sur ce navigateur.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = event => {
      const spoken = event.results?.[0]?.[0]?.transcript?.trim()
      if (spoken) onResult(spoken)
    }

    recognition.start()
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const transferToken = params.get('transfer')
    if (transferToken) {
      window.location.replace(`/collection/rejoindre?token=${encodeURIComponent(transferToken)}`)
      return
    }
    setLoginNext(`/collection${window.location.search}`)
    load()
  }, [])

  async function selectCollectionProfile(profileId) {
    if (!profileId || isSwitchingProfile || profileId === activeProfileIdRef.current) return
    setIsSwitchingProfile(true)
    activeProfileIdRef.current = profileId
    setActiveProfileId(profileId)
    if (user) window.localStorage.setItem(`pokevaleur-collection:${user.id}`, profileId)
    setItems([])
    setCollectionCardCopies(null)
    setCatalog([])
    setPhotoUrls({})
    setEditingId(null)
    setMessage('')
    try {
      await load(profileId)
    } finally {
      setIsSwitchingProfile(false)
    }
  }

  async function createChildProfile(e) {
    e.preventDefault()
    const name = childName.trim()
    if (name.length < 1 || name.length > 32) return setFamilyMessage('Le prénom ou pseudo doit contenir de 1 à 32 caractères.')
    const { data, error } = await supabase.from('collection_profiles').insert({
      manager_user_id: user.id,
      profile_type: 'child',
      display_name: name,
      avatar_key: 'star'
    }).select('id').single()
    if (error) return setFamilyMessage(error.message)
    setChildName('')
    setFamilyMessage(`La collection de ${name} est créée.`)
    await selectCollectionProfile(data.id)
  }

  async function createTransferLink(profile) {
    setFamilyMessage('')
    const parentConsent = window.confirm('Si l’enfant a moins de 15 ans, confirme être son parent ou tuteur et autoriser son accès à la Communauté et aux Trades après son propre accord. Les règles demandent de rester respectueux, de ne pas partager ses coordonnées et de ne pas effectuer de paiement dans PokéValeur. Choisir « Annuler » crée quand même le lien de transfert, sans accès social.')
    const { data, error } = await supabase.rpc('create_collection_transfer_invite_with_parent_consent', {
      profile_id: profile.id,
      p_parent_consent: parentConsent,
      p_terms_version: 'social-v1-2026-10-03'
    })
    if (error) return setFamilyMessage(error.message)
    const link = `${window.location.origin}/collection/rejoindre?token=${encodeURIComponent(data)}`
    setTransferLink(link)
    try {
      await navigator.clipboard.writeText(link)
      setFamilyMessage('Lien de transfert copié. Il est valable 7 jours et ne peut servir qu’une fois.')
    } catch {
      setFamilyMessage('Lien créé. Copie-le et transmets-le à l’enfant : il est valable 7 jours et ne peut servir qu’une fois.')
    }
  }

  useEffect(() => {
    const searchTerm = catalogQuery.trim()
    setCatalogError('')
    if (searchTerm.length < 2 || (form.product_id && searchTerm === form.custom_name)) {
      setCatalogMatches([])
      setCatalogLoading(false)
      return
    }

    let active = true
    setCatalogLoading(true)
    setCatalogMatches([])
    const timeout = setTimeout(async () => {
      if (!catalogIndexRef.current) {
        catalogIndexRef.current = fetchAllRows(() => supabase.from('products')
          .select('id,name,series,category,product_type,current_value,zero_defect_value')
          .eq('is_public', true).order('name').order('id'))
      }
      const { data, error } = await catalogIndexRef.current
      if (error) catalogIndexRef.current = null
      if (!active) return
      if (error) {
        setCatalogError('La recherche est indisponible. Réessaie en modifiant ta recherche.')
        setCatalogMatches([])
      } else {
        const matches = data.filter(createProductMatcher(searchTerm))
        setCatalogMatches(matches)
        setCatalog(previous => {
          const byId = new Map(previous.map(product => [product.id, product]))
          for (const product of matches) byId.set(product.id, product)
          return [...byId.values()]
        })
      }
      setCatalogLoading(false)
    }, 250)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [catalogQuery, form.product_id, form.custom_name, supabase])

  useEffect(() => {
    if (!user) return
    const productId = new URLSearchParams(window.location.search).get('product')
    if (!productId || preselectedProductRef.current === productId) return
    let active = true
    async function preselect() {
      const { data: product, error } = await supabase.from('products')
        .select('id,name,series,category,product_type,current_value,zero_defect_value')
        .eq('is_public', true).eq('id', productId).maybeSingle()
      if (!active) return
      preselectedProductRef.current = productId
      if (error || !product) {
        setMessage('Ce produit n’est plus disponible dans le catalogue. Tu peux le rechercher ou saisir son nom.')
        return
      }
      setForm(previous => ({ ...previous, product_id: product.id, custom_name: product.name, current_value_override: '' }))
      setCatalogQuery(product.name)
      setCatalog(previous => [...previous.filter(item => item.id !== product.id), product])
      document.getElementById('ajouter-produit')?.scrollIntoView({ block: 'start' })
    }
    preselect()
    return () => { active = false }
  }, [user, supabase])

  function chooseCatalogProduct(product) {
    setForm({
      ...form,
      product_id: product.id,
      custom_name: product.name,
      current_value_override: ''
    })
    setCatalogQuery(product.name)
  }

  function getCatalogValue(item) {
    const product = catalog.find(p => p.id === item.product_id)
    if (!product) return null

    if (
      item.sealed_condition === 'zero_defect' &&
      product.zero_defect_value !== null &&
      product.zero_defect_value !== undefined
    ) {
      return Number(product.zero_defect_value)
    }

    return product.current_value !== null && product.current_value !== undefined
      ? Number(product.current_value)
      : null
  }

  function getCurrentValue(item) {
    if (item.current_value_override !== null && item.current_value_override !== undefined) {
      return Number(item.current_value_override)
    }

    const marketValue = getCatalogValue(item)
    if (marketValue !== null) return marketValue

    return Number(item.purchase_price) || 0
  }

  async function uploadCollectionPhoto(file) {
    if (!file) return null
    if (!file.type?.startsWith('image/')) throw new Error('Le fichier choisi doit être une image.')
    if (file.size > 20 * 1024 * 1024) throw new Error('La photo est trop volumineuse (maximum 20 Mo).')

    const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser()
    if (userError || !freshUser) throw new Error('Ta session a expiré. Reconnecte-toi avant d’envoyer la photo.')

    const extension = (file.name.split('.').pop() || file.type.split('/').pop() || 'jpg')
      .toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${freshUser.id}/${crypto.randomUUID()}.${extension || 'jpg'}`

    const { data, error } = await supabase.storage
      .from('collection-images')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg',
        upsert: false
      })

    if (error) {
      console.error('Erreur upload photo Supabase', error)
      throw new Error(`Envoi de la photo impossible : ${error.message || 'erreur Supabase'}`)
    }
    if (!data?.path) throw new Error('Supabase n’a pas confirmé l’enregistrement de la photo.')

    return data.path
  }

  async function uploadCollectionPhotos(files) {
    return uploadUnlinkedPhotoBatch(files, uploadCollectionPhoto,
      paths => supabase.storage.from('collection-images').remove(paths))
  }

  async function addItem(e) {
    e.preventDefault()
    if (addItemPendingRef.current) return
    if (isSwitchingProfile) return setMessage('Attends le chargement de la collection sélectionnée.')
    if (!user) return setMessage('Connecte-toi d’abord.')

    if (!activeProfileId) return setMessage('Attends le chargement de ton profil de collection.')
    addItemPendingRef.current = true
    try {
      let uploadedPhotoPaths = []
      setIsSaving(true)
      setMessage(photoFiles.length ? `Envoi de ${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''} vers le stockage…` : 'Enregistrement du produit…')

      try {
        uploadedPhotoPaths = await uploadCollectionPhotos(photoFiles)
      } catch (error) {
        setMessage(`❌ ${error.message}`)
        return
      }

      const payload = {
        user_id: user.id,
        collection_profile_id: activeProfileId,
        product_id: form.product_id || null,
        custom_name: form.custom_name.trim(),
        quantity: Number(form.quantity || 1),
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        purchase_date: form.purchase_date || null,
        purchase_place: form.purchase_place.trim() || null,
        seller_name: form.seller_name.trim() || null,
        current_value_override: form.current_value_override ? Number(form.current_value_override) : null,
        sealed_condition: form.sealed_condition || 'standard',
        booster_configuration: form.booster_configuration.trim() || null,
        variant_note: form.variant_note.trim() || null,
        photo_path: uploadedPhotoPaths[0] || null
      }

      const { data: insertedItem, error } = await supabase
        .from('collection_items')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        if (uploadedPhotoPaths.length) {
          await supabase.storage.from('collection-images').remove(uploadedPhotoPaths)
        }
        return setMessage(`❌ ${error.message}`)
      }

      setForm(emptyForm)
      setCatalogQuery('')
      setCatalogMatches([])
      setPhotoFiles([])
      setPhotoStepDone(false)

      if (uploadedPhotoPaths.length) {
        const { error: photoError } = await supabase.from('collection_item_photos').insert(
          uploadedPhotoPaths.map((path, index) => ({
            collection_item_id: insertedItem.id,
            user_id: user.id,
            photo_path: path,
            sort_order: index
          }))
        )
        if (photoError) {
          await load()
          return setMessage(`⚠️ Produit ajouté et fichier photo envoyé, mais liaison de la photo impossible : ${photoError.message}`)
        }
      }

      setMessage(uploadedPhotoPaths.length ? `✓ Produit ajouté et ${uploadedPhotoPaths.length} photo${uploadedPhotoPaths.length > 1 ? 's' : ''} enregistrée${uploadedPhotoPaths.length > 1 ? 's' : ''}.` : '✓ Produit ajouté à ta collection.')
      await load()
    } catch {
      setMessage('L’enregistrement a été interrompu. Vérifie ta collection avant de réessayer.')
    } finally {
      addItemPendingRef.current = false
      setIsSaving(false)
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({
      custom_name: item.custom_name || '',
      quantity: item.quantity || 1,
      purchase_price: item.purchase_price ?? '',
      purchase_date: item.purchase_date || '',
      purchase_place: item.purchase_place || '',
      seller_name: item.seller_name || '',
      product_id: item.product_id || '',
      current_value_override: item.current_value_override ?? '',
      sealed_condition: item.sealed_condition || 'standard',
      booster_configuration: item.booster_configuration || '',
      variant_note: item.variant_note || ''
    })
    setEditPhotoFiles([])
    setMessage('')
  }

  async function addPhotosImmediately(id, files) {
    if (!files?.length || photoOrderPendingRef.current || photoUploadState[id]?.status === 'uploading') return
    setPhotoUploadState(prev => ({ ...prev, [id]: { status: 'uploading', text: files.length > 1 ? 'Envoi des photos…' : 'Envoi de la photo…' } }))

    let paths = []
    try {
      paths = await uploadCollectionPhotos(files)

      const currentItem = items.find(item => item.id === id)
      await saveUploadedPhotoBatch({
        paths,
        link: async uploaded => {
          const { count, error: countError } = await supabase.from('collection_item_photos')
            .select('id', { count: 'exact', head: true }).eq('collection_item_id', id)
          if (countError) throw countError
          const { error } = await supabase.from('collection_item_photos').insert(
            uploaded.map((path, index) => ({ collection_item_id: id, user_id: user.id,
              photo_path: path, sort_order: (count || 0) + index }))
          )
          if (error) throw error
        },
        setPrimary: async path => {
          if (currentItem?.photo_path || !path) return
          const { error } = await supabase.from('collection_items').update({ photo_path: path }).eq('id', id)
          if (error) throw error
        },
        remove: uploaded => supabase.storage.from('collection-images').remove(uploaded),
      })

      setPhotoUploadState(prev => ({
        ...prev,
        [id]: {
          status: 'success',
          text: `✓ ${files.length > 1 ? 'Photos enregistrées automatiquement' : 'Photo enregistrée automatiquement'} — tu peux quitter la fiche${files.length > 1 ? '' : ' ou en ajouter une autre'}.`
        }
      }))
      await load()
    } catch (error) {
      if (error.photosLinked) await load()
      setPhotoUploadState(prev => ({
        ...prev,
        [id]: { status: 'error', text: error.photosLinked ? '⚠️ Photos enregistrées, mais la photo principale n’a pas pu être actualisée. Les fichiers sont conservés.' : `❌ ${error.message || 'Impossible d’enregistrer la photo.'}` }
      }))
    }
  }

  async function saveEdit(id) {
    const currentItem = items.find(item => item.id === id)
    let newPhotoPaths = []

    try {
      newPhotoPaths = await uploadCollectionPhotos(editPhotoFiles)
    } catch (error) {
      return setMessage(error.message)
    }

    const payload = {
      product_id: editForm.product_id || null,
      custom_name: editForm.custom_name.trim(),
      quantity: Number(editForm.quantity || 1),
      purchase_price: editForm.purchase_price === '' ? null : Number(editForm.purchase_price),
      purchase_date: editForm.purchase_date || null,
      purchase_place: editForm.purchase_place.trim() || null,
      seller_name: editForm.seller_name.trim() || null,
      current_value_override: editForm.current_value_override === '' ? null : Number(editForm.current_value_override),
      sealed_condition: editForm.sealed_condition || 'standard',
      booster_configuration: editForm.booster_configuration.trim() || null,
      variant_note: editForm.variant_note.trim() || null
    }


    const { error } = await supabase
      .from('collection_items')
      .update(payload)
      .eq('id', id)

    if (error) {
      if (newPhotoPaths.length) {
        await supabase.storage.from('collection-images').remove(newPhotoPaths)
      }
      return setMessage(error.message)
    }

    if (newPhotoPaths.length) {
      try {
        await saveUploadedPhotoBatch({
          paths: newPhotoPaths,
          link: async uploaded => {
            const { count, error: countError } = await supabase.from('collection_item_photos')
              .select('id', { count: 'exact', head: true }).eq('collection_item_id', id)
            if (countError) throw countError
            const { error } = await supabase.from('collection_item_photos').insert(
              uploaded.map((path, index) => ({ collection_item_id: id, user_id: user.id,
                photo_path: path, sort_order: (count || 0) + index }))
            )
            if (error) throw error
          },
          setPrimary: async path => {
            if (currentItem?.photo_path || !path) return
            const { error } = await supabase.from('collection_items').update({ photo_path: path }).eq('id', id)
            if (error) throw error
          },
          remove: uploaded => supabase.storage.from('collection-images').remove(uploaded),
        })
      } catch (photoError) {
        setEditPhotoFiles([])
        await load()
        return setMessage(photoError.photosLinked
          ? '⚠️ Produit et photos enregistrés, mais la photo principale n’a pas pu être actualisée.'
          : '⚠️ Produit modifié, mais les nouvelles photos n’ont pas pu être enregistrées. Réessaie l’ajout des photos.')
      }
    }

    setEditingId(null)
    setEditPhotoFiles([])
    setMessage('Produit modifié.')
    await load()
  }

  async function deleteItem(item) {
    const ok = window.confirm(`Supprimer “${item.custom_name}” de ta collection ?`)
    if (!ok) return

    const { data: photos, error: photosError } = await supabase
      .from('collection_item_photos')
      .select('photo_path')
      .eq('collection_item_id', item.id)
    if (photosError) return setMessage(`Impossible de vérifier les photos de cet objet : ${photosError.message}`)

    const photoPaths = [...new Set([item.photo_path, ...(photos || []).map(photo => photo.photo_path)].filter(Boolean))]
    if (photoPaths.length) {
      const { error: storageError } = await supabase.storage.from('collection-images').remove(photoPaths)
      if (storageError) {
        return setMessage(`Nettoyage des photos impossible ; l’objet est conservé. Certaines photos ont peut-être déjà été retirées : ${storageError.message}`)
      }
    }

    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('id', item.id)

    if (error) {
      setMessage(`Photos supprimées, mais l’objet n’a pas pu être supprimé : ${error.message}`)
      await load()
      return
    }

    setMessage('Produit supprimé.')
    await load()
  }

  function exportCollection(includePrices) {
    const escapeCsv = value => {
      const text = String(value ?? '').replace(/"/g, '""')
      return `"${text}"`
    }

    const headers = [
      'Produit',
      'Quantité',
      'Série',
      'Type',
      'Date d’achat',
      'Lieu d’achat',
      'Vendeur',
      'État',
      'Composition boosters',
      'Particularité',
      'Notes'
    ]

    if (includePrices) {
      headers.splice(4, 0, 'Prix d’achat unitaire', 'Valeur actuelle unitaire', 'Valeur totale', 'Plus-value')
    }

    const rows = items.map(item => {
      const product = catalog.find(p => p.id === item.product_id) || {}
      const quantity = item.quantity || 1
      const currentValue = getCurrentValue(item)
      const purchasePrice = Number(item.purchase_price) || 0
      const row = [
        item.custom_name || product.name || '',
        quantity,
        product.series || '',
        product.category || '',
        item.purchase_date || '',
        item.purchase_place || '',
        item.seller_name || '',
        item.sealed_condition === 'zero_defect' ? 'Zéro défaut' : 'Standard',
        item.booster_configuration || '',
        item.variant_note || '',
        item.notes || ''
      ]

      if (includePrices) {
        row.splice(
          4,
          0,
          hasPurchasePrice(item) ? purchasePrice.toFixed(2) : '',
          Number(currentValue || 0).toFixed(2),
          Number((currentValue || 0) * quantity).toFixed(2),
          hasPurchasePrice(item) ? Number(((currentValue || 0) - purchasePrice) * quantity).toFixed(2) : ''
        )
      }

      return row
    })

    const csv = [
      headers.map(escapeCsv).join(';'),
      ...rows.map(row => row.map(escapeCsv).join(';'))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `pokevaleur-collection-${includePrices ? 'avec-prix' : 'sans-prix'}-${date}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const { invested, current, difference, evolution: percent, missingPurchaseCount } = calculateCollectionStatistics(items, getCurrentValue)

  const hasCollectionSearch = Boolean(normalizeSearch(query)) || conditionFilter !== 'all'
  const filteredItems = filterCollectionItems(items, catalog, query, conditionFilter)
  const inventoryCounts = calculateCollectionItemCounts(items, catalog)
  const sealedItemCount = inventoryCounts.sealed
  const otherItemCount = inventoryCounts.other
  const cardCount = collectionCardCopies?.length ?? null
  const gradedCardCount = collectionCardCopies === null
    ? null
    : collectionCardCopies.filter(copy => copy.ownership_type === 'graded').length
  const totalCollectionCount = cardCount === null ? null : inventoryCounts.total + cardCount

  useEffect(() => { if (hasCollectionSearch) setShowCollectionItems(true) }, [hasCollectionSearch])

  if (!user) {
    return (
      <main className="narrow">
        <section className="panel">
          <h1>Ma collection</h1>
          <p>Connecte-toi pour accéder à ta collection personnelle.</p>
          <a className="btn" href={`/login?next=${encodeURIComponent(loginNext)}`}>Connexion / inscription</a>
        </section>
      </main>
    )
  }

  return (
    <main className="collectionWorkspace">
      <div className="collectionHeader collectionHeaderNew">
        <h1>{activeCollectionProfile && !activeCollectionProfile.is_default ? `Collection de ${activeCollectionProfile.display_name}` : 'Ma collection'}</h1>
        {collectionProfiles.length > 1 && <label className="collectionProfileSelectLabel"><select aria-label="Collection affichée" value={activeProfileId || ''} onChange={event => selectCollectionProfile(event.target.value)} disabled={isSwitchingProfile}>{collectionProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.is_default ? 'Ma famille' : profile.display_name}</option>)}</select></label>}
      </div>
      <div className="collectionHeroArtwork"><img src="/collection-hero.webp" alt="Classeur de cartes Pokémon ouvert, cartes protégées et coffret de collection" /></div>
      <nav className="collectionTabs" aria-label="Sections de la collection">
        <a className="active" href="#objets" aria-current="page">Mes objets</a>
        <a href="/collection/stats">Stats collection</a>
        <a href="/collection/statistiques" aria-label="Valeur en euros"><span className="collectionEuroIcon" aria-hidden="true">€</span> Valeur</a>
      </nav>
      <section className="collectionTotals" id="collection-stats" aria-label="Résumé de la collection">
        <div className="collectionTotalsHead">
          <div>
            <span className="collectionStatsEyebrow">En un coup d’œil</span>
            <h2>Ma collection en chiffres</h2>
            <p>Scellés et cartes réunis, d’un seul coup d’œil.</p>
          </div>
          <a className="collectionStatsMore" href="/collection/stats">Voir toutes les statistiques <span aria-hidden="true">→</span></a>
        </div>
        <div className="collectionTotalGrid">
          <div><strong>{totalCollectionCount ?? '—'}</strong><span>éléments au total</span></div>
          <a className="collectionTotalLink collectionTotalSealed" href="/collection/stats?category=sealed"><strong>{sealedItemCount}</strong><span>produits scellés</span></a>
          <a className="collectionTotalLink collectionTotalOther" href="/collection/stats?category=other"><strong>{otherItemCount}</strong><span>autres / à classer</span></a>
          <a className="collectionTotalLink collectionTotalCards" href="/collection/stats?category=cards"><strong>{cardCount ?? '—'}</strong><span>cartes (gradées incluses)</span></a>
          <a className="collectionTotalLink collectionTotalGraded" href="/collection/stats?category=graded"><strong>{gradedCardCount ?? '—'}</strong><span>cartes gradées</span></a>
        </div>
      </section>
      <button type="button" className="collectionAddCta" onClick={() => { setShowAddForm(true); setTimeout(() => document.getElementById('ajouter-produit')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}>Ajouter un trésor</button>

      <section className="panel collectionToolsPanel collectionFilesVisible" aria-label="Importer ou exporter la collection">
        <h2>Mes fichiers</h2>
        <div className="collectionFileActions">
          <a className="miniBtn" href="/collection/import">Importer Excel / CSV</a>
          <details open className="collectionExportMenu">
            <summary>Exporter avec ou sans prix</summary>
            <div>
              <button className="miniBtn" type="button" disabled={isSwitchingProfile} onClick={() => exportCollection(true)}>Avec les prix</button>
              <button className="miniBtn" type="button" disabled={isSwitchingProfile} onClick={() => exportCollection(false)}>Sans les prix</button>
            </div>
          </details>
        </div>
      </section>
      <section className="panel collectionSearchPanel" aria-label="Recherche dans ma collection">
        <div className="collectionSearchHeading"><h2>Retrouver un objet</h2><button type="button" className="miniBtn primaryMini" onClick={() => setShowAddForm(true)}>＋ Ajouter</button></div>
            <div className="voiceSearchWrap collectionVoiceSearch">
              <input
                className="searchInput"
                type="search"
                aria-label="Rechercher dans ma collection"
                placeholder="Nom, série, vendeur…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button
                type="button"
                className={collectionVoiceListening ? 'voiceSearchButton listening' : 'voiceSearchButton'}
                aria-label="Rechercher à la voix"
                title="Recherche vocale"
                onClick={() => startVoiceSearch(setQuery, setCollectionVoiceListening)}
              >
                {collectionVoiceListening ? '🎙️' : '🎤'}
              </button>
            </div>
        <div className="collectionSearchFilters">
        <label>
          État du produit
          <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}>
            <option value="all">Tous les états</option>
            <option value="zero_defect">Zéro défaut</option>
            <option value="standard">État standard</option>
          </select>
        </label>
        {hasCollectionSearch && <button type="button" className="miniBtn" onClick={() => { setQuery(''); setConditionFilter('all') }}>Effacer</button>}
        </div>
        <p className="muted collectionSearchStatus" role="status">{isSwitchingProfile ? 'Chargement de la collection…' : hasCollectionSearch ? `${filteredItems.length} résultat${filteredItems.length > 1 ? 's' : ''}` : 'Saisis un nom ou choisis un filtre.'}</p>
      </section>
      <details className="panel collectionToolsPanel collectionFamilyPanel">
        <summary>Collections de la famille</summary>
        <p className="muted">Chaque enfant peut commencer sans compte. Quand il en crée un, tu peux lui transférer toute sa collection avec un lien à usage unique.</p>
        <div className="buttonRow" style={{ flexWrap: 'wrap', gap: 8 }}>
          {collectionProfiles.map(profile => (
            <button key={profile.id} className={`btn ${profile.id === activeProfileId ? '' : 'ghost'}`} type="button" disabled={isSwitchingProfile} onClick={() => selectCollectionProfile(profile.id)}>
              <ProfileAvatar className="collectionProfileAvatar" avatarKey={profile.is_default ? profileIdentity?.avatar_key : profile.avatar_key} aria-hidden="true" /> {profile.display_name}{profile.transferred_at ? ' (transférée)' : profile.is_default ? ' (toi)' : ''}
            </button>
          ))}
        </div>
        <form onSubmit={createChildProfile} className="buttonRow" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
          <input aria-label="Prénom ou pseudo de l’enfant" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Prénom ou pseudo de l’enfant" maxLength={32} disabled={isSwitchingProfile} />
          <button className="btn" type="submit" disabled={isSwitchingProfile}>＋ Créer sa collection</button>
        </form>
        {collectionProfiles.filter(profile => profile.profile_type === 'child').map(profile => (
          <div key={`invite-${profile.id}`} className="buttonRow" style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={() => createTransferLink(profile)}>Transférer « {profile.display_name} » après création de son compte</button>
          </div>
        ))}
        {isSwitchingProfile && <p role="status" className="muted">Chargement de la collection sélectionnée…</p>}
        {familyMessage && <p role="status" className="muted">{familyMessage}</p>}
        {transferLink && <p><a href={transferLink}>{transferLink}</a></p>}
      </details>

      <section className="contentGrid">
        <div className="panel collectionObjectsPanel" id="objets">
          <div className="listHeader"><h2>Mes objets</h2></div>
          <button type="button" className="collectionShowObjects" aria-expanded={showCollectionItems} onClick={() => setShowCollectionItems(value => !value)}>{showCollectionItems ? 'Masquer mes objets' : `Voir mes objets (${items.length})`}</button>
          {showCollectionItems && <div className="productList">
            {filteredItems.length === 0 ? (
              <p>{isSwitchingProfile ? 'Chargement de la collection…' : items.length === 0 ? 'Ta collection est vide pour le moment.' : !hasCollectionSearch ? 'Tes objets apparaîtront après une recherche ou un filtre.' : 'Aucun produit trouvé.'}</p>
            ) : (
              filteredItems.map(item => {
                const linkedProduct = catalog.find(product => product.id === item.product_id)
                const displayPhoto = photoUrls[item.id] || linkedProduct?.image_url
                const buy = Number(item.purchase_price) || 0
                const value = getCurrentValue(item)
                const diff = hasPurchasePrice(item) ? value - buy : null
                const pct = buy > 0 ? (diff / buy) * 100 : 0

                if (editingId === item.id) {
                  return (
                    <article className="productCard editing" key={item.id}>
                      <div className="editGrid">
                        <label>
                          Produit
                          <input value={editForm.custom_name} onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                        </label>
                        <label>
                          Quantité
                          <input type="number" min="1" value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} />
                        </label>
                        <label>
                          État du scellé
                          <select value={editForm.sealed_condition} onChange={e => setEditForm({ ...editForm, sealed_condition: e.target.value })}>
                            <option value="standard">Marché standard</option>
                            <option value="zero_defect">Zéro défaut</option>
                          </select>
                        </label>
                        <label>
                          Achat (€)
                          <input type="number" min="0" step="0.01" value={editForm.purchase_price} onChange={e => setEditForm({ ...editForm, purchase_price: e.target.value })} />
                        </label>
                        <label>
                          Valeur manuelle (€)
                          <input type="number" min="0" step="0.01" value={editForm.current_value_override} onChange={e => setEditForm({ ...editForm, current_value_override: e.target.value })} placeholder="Vide = cote PokéValeur" />
                        </label>
                        <label>
                          Date
                          <input type="date" value={editForm.purchase_date} onChange={e => setEditForm({ ...editForm, purchase_date: e.target.value })} />
                        </label>
                        <label>
                          Lieu
                          <input value={editForm.purchase_place} onChange={e => setEditForm({ ...editForm, purchase_place: e.target.value })} />
                        </label>
                        <label>
                          Vendeur (facultatif)
                          <input value={editForm.seller_name} onChange={e => setEditForm({ ...editForm, seller_name: e.target.value })} />
                        </label>
                        <label>
                          Composition exacte des boosters
                          <textarea rows="4" value={editForm.booster_configuration} onChange={e => setEditForm({ ...editForm, booster_configuration: e.target.value })} />
                        </label>
                        <label>
                          Particularité de l’exemplaire
                          <input value={editForm.variant_note} onChange={e => setEditForm({ ...editForm, variant_note: e.target.value })} />
                        </label>
                        <section style={{ gridColumn: '1 / -1' }} aria-label="Photos du produit">
                          <h3>Photos enregistrées</h3>
                          <p className="muted">Choisis la photo principale ou déplace les photos. Chaque changement est enregistré automatiquement.</p>
                          {photoGallery.itemId === item.id && photoGallery.loading && <p role="status">Chargement des photos…</p>}
                          {photoGallery.itemId === item.id && !photoGallery.loading && photoGallery.photos.length === 0 && !photoGallery.message && <p>Aucune photo enregistrée.</p>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {photoGallery.itemId === item.id && photoGallery.photos.map((photo, index) => (
                              <div key={photo.id} style={{ width: 180, maxWidth: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 12 }}>
                                {photo.url ? <img src={photo.url} alt={`Photo ${index + 1} de ${item.custom_name}`} style={{ width: '100%', height: 120, objectFit: 'contain' }} /> : <p>Aperçu indisponible</p>}
                                <p>{index + 1}. {photo.photo_path === item.photo_path ? 'Photo principale' : 'Photo du produit'}</p>
                                <div className="buttonRow" style={{ flexWrap: 'wrap', gap: 6 }}>
                                  <button type="button" className="miniBtn" disabled={photoGallery.busy || editPhotoUploadStatus === 'uploading' || index === 0 && photo.photo_path === item.photo_path} onClick={() => changePhotoOrder(item.id, index, 0)}>Définir comme principale</button>
                                  <button type="button" className="miniBtn" aria-label={`Avancer la photo ${index + 1}`} disabled={photoGallery.busy || editPhotoUploadStatus === 'uploading' || index === 0} onClick={() => changePhotoOrder(item.id, index, index - 1)}>← Avant</button>
                                  <button type="button" className="miniBtn" aria-label={`Reculer la photo ${index + 1}`} disabled={photoGallery.busy || editPhotoUploadStatus === 'uploading' || index === photoGallery.photos.length - 1} onClick={() => changePhotoOrder(item.id, index, index + 1)}>Après →</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {photoGallery.itemId === item.id && photoGallery.message && <p role="status">{photoGallery.message}</p>}
                        </section>
                        {photoUploadState[item.id] && (
                          <div className={`photoImmediateStatus ${photoUploadState[item.id].status}`} role="status">
                            {photoUploadState[item.id].text}
                          </div>
                        )}
                        <div className="photoChoice">
                          <label className="photoAction">
                            <input
                              className="photoInput"
                              disabled={photoGallery.busy || editPhotoUploadStatus === 'uploading'}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={async e => {
                                const file = e.target.files?.[0]
                                if (file) await addPhotosImmediately(item.id, [file])
                                e.target.value = ''
                              }}
                            />
                            <span className="photoActionIcon">📷</span>
                            <span>
                              <b>Prendre une photo</b>
                              <small>Ajoutée immédiatement à cette fiche</small>
                            </span>
                          </label>

                          <label className="photoAction">
                            <input
                              className="photoInput"
                              disabled={photoGallery.busy || editPhotoUploadStatus === 'uploading'}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={async e => {
                                const files = [...(e.target.files || [])]
                                if (files.length) await addPhotosImmediately(item.id, files)
                                e.target.value = ''
                              }}
                            />
                            <span className="photoActionIcon">🖼️</span>
                            <span>
                              <b>Ajouter des photos</b>
                              <small>Choisis une ou plusieurs images</small>
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="rowActions">
                        <button className="miniBtn primaryMini" disabled={photoGallery.busy || editPhotoUploadStatus === 'uploading'} onClick={() => saveEdit(item.id)}>Enregistrer</button>
                        <button className="miniBtn" onClick={() => setEditingId(null)}>Annuler</button>
                      </div>
                    </article>
                  )
                }

                return (
                  <article className="productCard" key={item.id}>
                    {displayPhoto && (
                      <div className="collectionItemPhoto">
                        <img src={displayPhoto} alt={item.custom_name} loading="lazy" />
                        {!photoUrls[item.id] && <small className="muted">Visuel du catalogue</small>}
                      </div>
                    )}
                    <div className="productMain">
                      <div>
                        <h3>{item.custom_name}</h3>
                        {linkedProduct && <a className="miniBtn catalogueReference" href={`/catalogue/${linkedProduct.id}`}>Référence : {linkedProduct.name} →</a>}
                        <p>
                          Qté {item.quantity}
                          {item.purchase_date ? ` • acheté le ${new Date(item.purchase_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}
                          {item.purchase_place ? ` • ${item.purchase_place}` : ''}
                          {item.seller_name ? ` • vendeur : ${item.seller_name}` : ''}
                          {item.sealed_condition === 'zero_defect' ? ' • zéro défaut' : ''}
                        </p>
                        {item.booster_configuration && (
                          <p className="itemComposition"><b>Boosters :</b> {item.booster_configuration}</p>
                        )}
                        {item.variant_note && (
                          <p className="itemVariantNote"><b>Particularité :</b> {item.variant_note}</p>
                        )}
                      </div>
                      <div className="productValues">
                        <b>{hasPurchasePrice(item) ? `${buy.toFixed(2)} €` : 'Achat non renseigné'} → {value.toFixed(2)} €</b>
                        {item.current_value_override === null && getCatalogValue(item) !== null
                          ? <small className="muted">{item.sealed_condition === 'zero_defect' ? 'Cote PokéValeur zéro défaut' : 'Cote PokéValeur standard'}</small>
                          : item.current_value_override !== null
                            ? <small className="muted">Valeur manuelle</small>
                            : null}
                        <span className={diff >= 0 ? 'gain' : 'loss'}>
                          {diff == null ? 'Plus-value non calculable' : `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} €`}
                          {buy > 0 ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %)` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="rowActions">
                      <a className="miniBtn" href={`/collection/${item.id}`}>Voir la fiche</a>
                      <button className="miniBtn" onClick={() => startEdit(item)}>Modifier</button>
                      <button className="miniBtn dangerMini" onClick={() => deleteItem(item)}>Supprimer</button>
                    </div>
                  </article>
                )
              })
            )}
          </div>}
        </div>
        {showAddForm && <div className="panel collectionAddPanel">
          <h2 id="ajouter-produit" style={{ scrollMarginTop: 100 }}>Ajouter un produit</h2>
          <form onSubmit={addItem} className="formGrid">
            <div className="catalogPicker">
              <label>
                Rechercher dans le catalogue
                <input
                  value={catalogQuery}
                  onChange={e => {
                    setCatalogQuery(e.target.value)
                    setForm({ ...form, product_id: '' })
                  }}
                  placeholder="Ex. 151, Arceus, Célébrations..."
                />
              </label>
              {catalogLoading && <small role="status" className="muted">Recherche dans le catalogue…</small>}
              {catalogError && <small role="alert" className="muted">{catalogError}</small>}
              {catalogMatches.length > 0 && (
                <div className="catalogSuggestions" role="region" aria-label="Résultats du catalogue" tabIndex={0}>
                  {catalogMatches.map(product => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => chooseCatalogProduct(product)}
                    >
                      <b>{product.name}</b>
                      <span>{product.series || 'Série non renseignée'}</span>
                    </button>
                  ))}
                </div>
              )}
              {!catalogLoading && !catalogError && !form.product_id && catalogQuery.trim().length >= 2 && catalogMatches.length === 0 && (
                <small className="muted">Aucun résultat. Tu peux saisir le nom librement ci-dessous.</small>
              )}
              <small className="muted">
                Tu peux choisir un produit du catalogue ou saisir librement un produit ci-dessous.
              </small>
            </div>

            <label>
              Nom du produit
              <input
                value={form.custom_name}
                onChange={e => setForm({ ...form, custom_name: e.target.value })}
                placeholder="Ex. ETB 151"
                required
              />
            </label>

            <label>
              Quantité
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
              />
            </label>

            <label>
              État du produit scellé
              <select
                value={form.sealed_condition}
                onChange={e => setForm({ ...form, sealed_condition: e.target.value })}
              >
                <option value="standard">Marché standard</option>
                <option value="zero_defect">Zéro défaut</option>
              </select>
            </label>

            <label>
              Prix d’achat (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_price}
                onChange={e => setForm({ ...form, purchase_price: e.target.value })}
              />
            </label>

            <label>
              Valeur actuelle manuelle (€) — facultatif
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.current_value_override}
                onChange={e => setForm({ ...form, current_value_override: e.target.value })}
                placeholder="Laisser vide pour utiliser la cote PokéValeur"
              />
            </label>

            <label>
              Date d’achat
              <input
                type="date"
                value={form.purchase_date}
                onChange={e => setForm({ ...form, purchase_date: e.target.value })}
              />
            </label>

            <label>
              Lieu d’achat
              <input
                value={form.purchase_place}
                onChange={e => setForm({ ...form, purchase_place: e.target.value })}
                placeholder="Vinted, boutique, Voggt..."
              />
            </label>

            <label>
              Nom du vendeur (facultatif)
              <input
                value={form.seller_name}
                onChange={e => setForm({ ...form, seller_name: e.target.value })}
                placeholder="Ex. Ultimate Collectors, vendeur Vinted..."
              />
            </label>

            <label>
              Composition exacte des boosters (facultatif)
              <textarea
                value={form.booster_configuration}
                onChange={e => setForm({ ...form, booster_configuration: e.target.value })}
                placeholder="Ex. EB03 Ténèbres Embrasées – Eternatos ×1 | EB05 Styles de Combat – Tyranocif ×1 | EB08 Poing de Fusion – Ectoplasma ×1 | EB08 Poing de Fusion – Fulgudog ×1"
                rows="4"
              />
            </label>

            <label>
              Particularité de cet exemplaire (facultatif)
              <input
                value={form.variant_note}
                onChange={e => setForm({ ...form, variant_note: e.target.value })}
                placeholder="Ex. 3 boosters avec la même illustration / booster Dracaufeu visible"
              />
            </label>

            <div className="photoChoice">
              <label className="photoAction">
                <input
                  className="photoInput"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setPhotoFiles(prev => [...prev, file])
                      setPhotoStepDone(false)
                    }
                    e.target.value = ''
                  }}
                />
                <span className="photoActionIcon">📷</span>
                <span>
                  <b>Prendre une photo</b>
                  <small>Ouvre directement l’appareil photo</small>
                </span>
              </label>

              <label className="photoAction">
                <input
                  className="photoInput"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => {
                    const files = [...(e.target.files || [])]
                    if (files.length) {
                      setPhotoFiles(prev => [...prev, ...files])
                      setPhotoStepDone(false)
                    }
                    e.target.value = ''
                  }}
                />
                <span className="photoActionIcon">🖼️</span>
                <span>
                  <b>Choisir des photos</b>
                  <small>Depuis la galerie du téléphone</small>
                </span>
              </label>
            </div>
            {photoFiles.length > 0 && (
              <div className="photoCaptureConfirmation">
                <div className="photoSuccess">✓ {photoFiles.length} photo{photoFiles.length > 1 ? 's' : ''} ajoutée{photoFiles.length > 1 ? 's' : ''}</div>
                <div className="pendingPhotoGrid">
                  {photoFiles.map((file, index) => (
                    <div className="pendingPhotoThumb" key={`${file.name}-${file.lastModified}-${index}`}>
                      <img src={URL.createObjectURL(file)} alt={`Photo ${index + 1}`} />
                      <button
                        type="button"
                        aria-label={`Supprimer la photo ${index + 1}`}
                        onClick={() => setPhotoFiles(prev => prev.filter((_, i) => i !== index))}
                      >×</button>
                    </div>
                  ))}
                </div>
                {!photoStepDone ? (
                  <div className="photoNextActions">
                    <label className="miniBtn primaryMini photoMoreButton">
                      <input
                        className="photoInput"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) setPhotoFiles(prev => [...prev, file])
                          e.target.value = ''
                        }}
                      />
                      📷 Prendre une autre photo
                    </label>
                    <button type="button" className="miniBtn" onClick={() => setPhotoStepDone(true)}>Terminer</button>
                  </div>
                ) : (
                  <div className="photoDoneLine">
                    <span>✓ Photos prêtes à être enregistrées avec le produit.</span>
                    <button type="button" className="miniBtn" onClick={() => setPhotoStepDone(false)}>Ajouter une photo</button>
                  </div>
                )}
                <button type="button" className="photoClearLink" onClick={() => { setPhotoFiles([]); setPhotoStepDone(false) }}>Effacer les photos</button>
              </div>
            )}

            <small className="muted">
              Si deux exemplaires du même coffret n’ont pas les mêmes boosters, ajoute-les séparément (quantité 1) afin de conserver leur composition exacte.
            </small>

            <button className="btn" type="submit" disabled={isSaving || isSwitchingProfile || !activeProfileId}>{isSwitchingProfile ? 'Chargement…' : isSaving ? 'Enregistrement en cours…' : 'Ajouter à ma collection'}</button>
          </form>

          {message && <p className="message">{message}</p>}
        </div>}

      </section>
    </main>
  )
}
