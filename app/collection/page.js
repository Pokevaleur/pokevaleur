'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

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
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [editPhotoFiles, setEditPhotoFiles] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [photoStepDone, setPhotoStepDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [photoUploadState, setPhotoUploadState] = useState({})
  const [collectionVoiceListening, setCollectionVoiceListening] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) return

    const { data, error } = await supabase
      .from('collection_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      const rows = data || []
      setItems(rows)

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
    load()
    loadCatalog()
  }, [])

  async function loadCatalog() {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,series,category,current_value,zero_defect_value')
      .eq('is_public', true)
      .order('name')

    if (!error) setCatalog(data || [])
  }

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
    const paths = []
    for (const file of files) {
      paths.push(await uploadCollectionPhoto(file))
    }
    return paths
  }

  async function addItem(e) {
    e.preventDefault()
    if (!user) return setMessage('Connecte-toi d’abord.')

    let uploadedPhotoPaths = []
    setIsSaving(true)
    setMessage(photoFiles.length ? `Envoi de ${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''} vers le stockage…` : 'Enregistrement du produit…')

    try {
      uploadedPhotoPaths = await uploadCollectionPhotos(photoFiles)
    } catch (error) {
      setIsSaving(false)
      setMessage(`❌ ${error.message}`)
      return
    }

    const payload = {
      user_id: user.id,
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
      setIsSaving(false)
      return setMessage(`❌ ${error.message}`)
    }

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
        setIsSaving(false)
        return setMessage(`⚠️ Produit ajouté et fichier photo envoyé, mais liaison de la photo impossible : ${photoError.message}`)
      }
    }

    setForm(emptyForm)
    setPhotoFiles([])
    setPhotoStepDone(false)
    setIsSaving(false)
    setMessage(uploadedPhotoPaths.length ? `✓ Produit ajouté et ${uploadedPhotoPaths.length} photo${uploadedPhotoPaths.length > 1 ? 's' : ''} enregistrée${uploadedPhotoPaths.length > 1 ? 's' : ''}.` : '✓ Produit ajouté à ta collection.')
    await load()
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
    if (!files?.length) return
    setPhotoUploadState(prev => ({ ...prev, [id]: { status: 'uploading', text: files.length > 1 ? 'Envoi des photos…' : 'Envoi de la photo…' } }))

    let paths = []
    try {
      paths = await uploadCollectionPhotos(files)

      const currentItem = items.find(item => item.id === id)
      const { count } = await supabase
        .from('collection_item_photos')
        .select('id', { count: 'exact', head: true })
        .eq('collection_item_id', id)

      const { error: insertError } = await supabase.from('collection_item_photos').insert(
        paths.map((path, index) => ({
          collection_item_id: id,
          user_id: user.id,
          photo_path: path,
          sort_order: (count || 0) + index
        }))
      )
      if (insertError) throw insertError

      if (!currentItem?.photo_path && paths[0]) {
        const { error: updateError } = await supabase
          .from('collection_items')
          .update({ photo_path: paths[0] })
          .eq('id', id)
        if (updateError) throw updateError
      }

      setPhotoUploadState(prev => ({
        ...prev,
        [id]: {
          status: 'success',
          text: `✓ ${files.length > 1 ? 'Photos enregistrées automatiquement' : 'Photo enregistrée automatiquement'} — tu peux quitter la fiche${files.length > 1 ? '' : ' ou en ajouter une autre'}.`
        }
      }))
      await load()
    } catch (error) {
      if (paths.length) await supabase.storage.from('collection-images').remove(paths)
      setPhotoUploadState(prev => ({
        ...prev,
        [id]: { status: 'error', text: `❌ ${error.message || 'Impossible d’enregistrer la photo.'}` }
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

    if (newPhotoPaths.length && !currentItem?.photo_path) payload.photo_path = newPhotoPaths[0]

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
      const { count } = await supabase
        .from('collection_item_photos')
        .select('id', { count: 'exact', head: true })
        .eq('collection_item_id', id)

      const { error: photoError } = await supabase.from('collection_item_photos').insert(
        newPhotoPaths.map((path, index) => ({
          collection_item_id: id,
          user_id: user.id,
          photo_path: path,
          sort_order: (count || 0) + index
        }))
      )
      if (photoError) setMessage('Modifications enregistrées, mais certaines photos n’ont pas pu être ajoutées.')
    }

    setEditingId(null)
    setEditPhotoFiles([])
    setMessage('Produit modifié.')
    await load()
  }

  async function deleteItem(item) {
    const ok = window.confirm(`Supprimer “${item.custom_name}” de ta collection ?`)
    if (!ok) return

    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('id', item.id)

    if (error) return setMessage(error.message)

    if (item.photo_path) {
      await supabase.storage.from('collection-images').remove([item.photo_path])
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
          purchasePrice.toFixed(2),
          Number(currentValue || 0).toFixed(2),
          Number((currentValue || 0) * quantity).toFixed(2),
          Number(((currentValue || 0) - purchasePrice) * quantity).toFixed(2)
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

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const invested = items.reduce(
    (sum, item) => sum + (Number(item.purchase_price) || 0) * (item.quantity || 1),
    0
  )

  const current = items.reduce(
    (sum, item) => sum + getCurrentValue(item) * (item.quantity || 1),
    0
  )

  const difference = current - invested
  const percent = invested > 0 ? (difference / invested) * 100 : 0
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0)

  function normalizeSearch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  const filteredItems = items.filter(item => {
    const needle = normalizeSearch(query)
    if (!needle) return true

    const product = catalog.find(p => p.id === item.product_id)
    const haystack = [
      item.custom_name,
      item.purchase_place,
      item.seller_name,
      item.booster_configuration,
      item.variant_note,
      item.notes,
      item.purchase_date,
      item.sealed_condition === 'zero_defect' ? 'zero defaut parfait' : 'standard',
      product?.name,
      product?.series,
      product?.category
    ]
      .map(normalizeSearch)
      .join(' ')

    return haystack.includes(needle)
  })

  const catalogMatches = catalog
    .filter(product =>
      catalogQuery.trim().length >= 2 &&
      (
        product.name.toLowerCase().includes(catalogQuery.toLowerCase()) ||
        (product.series || '').toLowerCase().includes(catalogQuery.toLowerCase())
      )
    )
    .slice(0, 6)

  if (!user) {
    return (
      <main className="narrow">
        <section className="panel">
          <h1>Ma collection</h1>
          <p>Connecte-toi pour accéder à ta collection personnelle.</p>
          <a className="btn" href="/login">Connexion / inscription</a>
        </section>
      </main>
    )
  }

  return (
    <main>
      <div className="collectionHeader">
        <div>
          <span className="eyebrow dark">Mon espace</span>
          <h1>Ma collection</h1>
          <p className="muted">{user.email}</p>
        </div>
        <div className="collectionHeaderActions">
          <a className="btn" href="/collection/statistiques">📊 Statistiques</a>
          <div className="exportCollectionActions">
            <button className="btn ghost" type="button" onClick={() => exportCollection(true)}>⬇ Exporter avec prix</button>
            <button className="btn ghost" type="button" onClick={() => exportCollection(false)}>⬇ Exporter sans prix</button>
          </div>
          <button className="btn ghost dangerGhost" onClick={signOut}>Se déconnecter</button>
        </div>
      </div>

      <section className="stats">
        <div>
          <span>Investi</span>
          <strong>{invested.toFixed(2)} €</strong>
        </div>
        <div>
          <span>Valeur actuelle</span>
          <strong>{current.toFixed(2)} €</strong>
        </div>
        <div>
          <span>Évolution</span>
          <strong className={difference >= 0 ? 'gain' : 'loss'}>
            {difference >= 0 ? '+' : ''}{difference.toFixed(2)} €
            <small>{invested > 0 ? ` (${percent >= 0 ? '+' : ''}${percent.toFixed(1)} %)` : ''}</small>
          </strong>
        </div>
        <div>
          <span>Items</span>
          <strong>{itemCount}</strong>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <h2>Ajouter un produit</h2>
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
              {catalogMatches.length > 0 && (
                <div className="catalogSuggestions">
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

            <button className="btn" type="submit" disabled={isSaving}>{isSaving ? 'Enregistrement en cours…' : 'Ajouter à ma collection'}</button>
          </form>

          {message && <p className="message">{message}</p>}
        </div>

        <div className="panel">
          <div className="listHeader">
            <h2>Mes produits</h2>
            <div className="voiceSearchWrap collectionVoiceSearch">
              <input
                className="searchInput"
                placeholder="Rechercher produit, série, vendeur, lieu, booster, note..."
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
          </div>

          <div className="productList">
            {filteredItems.length === 0 ? (
              <p>{items.length === 0 ? 'Ta collection est vide pour le moment.' : 'Aucun produit trouvé.'}</p>
            ) : (
              filteredItems.map(item => {
                const buy = Number(item.purchase_price) || 0
                const value = getCurrentValue(item)
                const diff = value - buy
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
                        {photoUploadState[item.id] && (
                          <div className={`photoImmediateStatus ${photoUploadState[item.id].status}`} role="status">
                            {photoUploadState[item.id].text}
                          </div>
                        )}
                        <div className="photoChoice">
                          <label className="photoAction">
                            <input
                              className="photoInput"
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
                        <button className="miniBtn primaryMini" onClick={() => saveEdit(item.id)}>Enregistrer</button>
                        <button className="miniBtn" onClick={() => setEditingId(null)}>Annuler</button>
                      </div>
                    </article>
                  )
                }

                return (
                  <article className="productCard" key={item.id}>
                    {photoUrls[item.id] && (
                      <div className="collectionItemPhoto">
                        <img src={photoUrls[item.id]} alt={item.custom_name} />
                      </div>
                    )}
                    <div className="productMain">
                      <div>
                        <h3>{item.custom_name}</h3>
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
                        <b>{buy.toFixed(2)} € → {value.toFixed(2)} €</b>
                        {item.current_value_override === null && getCatalogValue(item) !== null
                          ? <small className="muted">{item.sealed_condition === 'zero_defect' ? 'Cote PokéValeur zéro défaut' : 'Cote PokéValeur standard'}</small>
                          : item.current_value_override !== null
                            ? <small className="muted">Valeur manuelle</small>
                            : null}
                        <span className={diff >= 0 ? 'gain' : 'loss'}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(2)} €
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
          </div>
        </div>
      </section>
    </main>
  )
}
