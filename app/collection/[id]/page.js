'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'

export default function CollectionItemDetailPage() {
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])
  const [item, setItem] = useState(null)
  const [photos, setPhotos] = useState([])
  const [activePhoto, setActivePhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [boosters, setBoosters] = useState([])
  const [boosterMessage, setBoosterMessage] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [analysisCandidates, setAnalysisCandidates] = useState({})

  useEffect(() => {
    if (params?.id) load()
  }, [params?.id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const [{ data: itemData }, { data: photoData }, { data: boosterData }] = await Promise.all([
      supabase.from('collection_items').select('*').eq('id', params.id).eq('user_id', user.id).single(),
      supabase.from('collection_item_photos').select('*').eq('collection_item_id', params.id).eq('user_id', user.id).order('sort_order'),
      supabase.from('collection_item_boosters').select('*').eq('collection_item_id', params.id).eq('user_id', user.id).order('position')
    ])

    setItem(itemData || null)

    const signed = await Promise.all((photoData || []).map(async photo => {
      const { data } = await supabase.storage.from('collection-images').createSignedUrl(photo.photo_path, 3600)
      return { ...photo, url: data?.signedUrl || null }
    }))
    setPhotos(signed.filter(photo => photo.url))
    setBoosters(boosterData || [])
    setLoading(false)
  }

  async function compressDetailPhoto(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Le fichier choisi doit être une image.')
    const bitmap = await createImageBitmap(file)
    const maxSide = 2200
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(output => output ? resolve(output) : reject(new Error('Impossible de préparer la photo.')), 'image/jpeg', 0.82)
    })
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  }

  async function addDetailPhotos(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setPhotoUploading(true)
    setPhotoMessage(files.length > 1 ? 'Envoi des photos…' : 'Envoi de la photo…')
    const uploaded = []
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ta session a expiré.')
      const { count } = await supabase.from('collection_item_photos').select('id', { count: 'exact', head: true }).eq('collection_item_id', params.id)
      for (let index = 0; index < files.length; index++) {
        const file = await compressDetailPhoto(files[index])
        if (file.size > 8 * 1024 * 1024) throw new Error('Une photo reste trop volumineuse après compression.')
        const path = `${user.id}/${crypto.randomUUID()}.jpg`
        const { data, error } = await supabase.storage.from('collection-images').upload(path, file, { cacheControl: '3600', contentType: 'image/jpeg', upsert: false })
        if (error || !data?.path) throw new Error(error?.message || 'Envoi impossible.')
        uploaded.push(data.path)
        const { error: linkError } = await supabase.from('collection_item_photos').insert({
          collection_item_id: params.id, user_id: user.id, photo_path: data.path, sort_order: (count || 0) + index
        })
        if (linkError) throw linkError
      }
      if (!item.photo_path && uploaded[0]) {
        await supabase.from('collection_items').update({ photo_path: uploaded[0] }).eq('id', params.id).eq('user_id', user.id)
      }
      setPhotoMessage(`✓ ${files.length} photo${files.length > 1 ? 's' : ''} enregistrée${files.length > 1 ? 's' : ''}. Elles serviront ensemble à affiner l’identification.`)
      await load()
    } catch (error) {
      setPhotoMessage('❌ ' + (error.message || 'Impossible d’enregistrer la photo.'))
    } finally {
      setPhotoUploading(false)
    }
  }

  async function analyzePhotos() {
    if (!photos.length) return setAnalysisMessage('Ajoute au moins une photo avant l’analyse.')
    setAnalyzing(true)
    setAnalysisMessage('Analyse des photos en cours…')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Ta session a expiré.')
      const response = await fetch('/api/analyze-boosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ itemId: params.id })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Analyse impossible.')
      setAnalysisCandidates(Object.fromEntries(
        (result.boosters || []).map((b, i) => {
          const position = Number(b.position) || i + 1
          const existing = boosters.find(x => Number(x.position) === position)
          const knownExpansion = existing?.expansion_name || ''
          const candidates = (b.candidates || []).filter(candidate =>
            !knownExpansion ||
            !candidate.expansion_name ||
            normalizeExpansionName(candidate.expansion_name) === normalizeExpansionName(knownExpansion)
          )
          return [position, candidates]
        })
      ))
      setBoosters(current => {
        const proposals = result.boosters || []
        const positions = new Set([...current.map(b => Number(b.position)), ...proposals.map((b, i) => Number(b.position) || i + 1)])
        return [...positions].sort((a, b) => a - b).map(position => {
          const existing = current.find(b => Number(b.position) === position)
          const proposal = proposals.find((b, i) => (Number(b.position) || i + 1) === position)
          if (!proposal) return existing
          if (existing?.confirmed) return existing

          const existingExpansion = existing?.expansion_name || ''
          const proposalExpansion = proposal.expansion_name || ''
          const sameKnownExpansion = !existingExpansion || !proposalExpansion ||
            normalizeExpansionName(existingExpansion) === normalizeExpansionName(proposalExpansion)

          return {
            id: existing?.id || null,
            position,
            // Une extension déjà connue est verrouillée et ne peut pas être remplacée par l'IA.
            expansion_name: existingExpansion || proposalExpansion || '',
            // L'IA peut seulement compléter l'artwork dans l'extension déjà connue.
            artwork_name: sameKnownExpansion
              ? (proposal.artwork_name || existing?.artwork_name || '')
              : (existing?.artwork_name || ''),
            confidence: sameKnownExpansion && (proposal.artwork_name || proposal.expansion_name)
              ? (proposal.confidence || existing?.confidence || 'low')
              : (existing?.confidence || 'low'),
            confirmed: false
          }
        })
      })
      setAnalysisMessage(result.needs_additional_photo
        ? `⚠️ ${result.photo_instruction || 'Une photo complémentaire est conseillée pour confirmer certains boosters.'}`
        : '✓ Analyse terminée. Vérifie les propositions puis coche « Confirmé » avant d’enregistrer.')
    } catch (error) {
      setAnalysisMessage('❌ ' + (error.message || 'Analyse impossible.'))
    } finally {
      setAnalyzing(false)
    }
  }

  function normalizeExpansionName(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/^eb\s*\d+\s*[—-]?\s*/i, '')
      .replace(/^epee et bouclier\s*[—-]\s*/i, '')
      .trim()
  }

  function updateBooster(index, field, value) {
    setBoosters(current => current.map((booster, i) => i === index ? { ...booster, [field]: value } : booster))
  }

  function addBooster() {
    setBoosters(current => [...current, {
      id: null,
      position: current.length + 1,
      expansion_name: '',
      artwork_name: '',
      confidence: 'manual',
      confirmed: false
    }])
  }

  async function saveBoosters() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBoosterMessage('Enregistrement…')
    const rows = boosters.map((booster, index) => ({
      collection_item_id: params.id,
      user_id: user.id,
      position: index + 1,
      expansion_name: booster.expansion_name?.trim() || null,
      artwork_name: booster.artwork_name?.trim() || null,
      confidence: booster.confidence || 'manual',
      confirmed: Boolean(booster.confirmed)
    }))
    const { error: deleteError } = await supabase.from('collection_item_boosters').delete().eq('collection_item_id', params.id).eq('user_id', user.id)
    if (deleteError) {
      setBoosterMessage('❌ ' + deleteError.message)
      return
    }
    if (rows.length) {
      const { error } = await supabase.from('collection_item_boosters').insert(rows)
      if (error) {
        setBoosterMessage('❌ ' + error.message)
        return
      }
    }
    setBoosterMessage('✓ Composition enregistrée pour cet exemplaire.')
    await load()
  }

  if (loading) return <main><section className="panel"><p>Chargement...</p></section></main>
  if (!item) return <main><section className="panel"><h1>Produit introuvable</h1></section></main>

  return (
    <main>
      <a href="/collection" className="backLink">← Retour à ma collection</a>

      <section className="panel personalDetail">
        <div>
          <span className="eyebrow dark">Mon exemplaire</span>
          <h1>{item.custom_name}</h1>
          <p className="muted">
            Qté {item.quantity}
            {item.purchase_date ? ` • acheté le ${new Date(item.purchase_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}
            {item.purchase_place ? ` • ${item.purchase_place}` : ''}
          </p>
        </div>

        {photos.length > 0 && (
          <div className="personalGallery">
            <button className="personalMainPhoto" onClick={() => setActivePhoto(photos[0].url)}>
              <img src={photos[0].url} alt={item.custom_name} />
            </button>
            <div className="personalThumbs">
              {photos.map((photo, index) => (
                <button key={photo.id} onClick={() => setActivePhoto(photo.url)} title={`Photo ${index + 1}`}>
                  <img src={photo.url} alt={`${item.custom_name} - photo ${index + 1}`} />
                </button>
              ))}
            </div>
            <small className="muted">Touchez une miniature pour afficher la photo en grand.</small>
          </div>
        )}

        <div className="personalFacts">
          <div><span>Prix d’achat</span><strong>{item.purchase_price != null ? Number(item.purchase_price).toFixed(2) + ' €' : 'Non renseigné'}</strong></div>
          <div><span>État</span><strong>{item.sealed_condition === 'zero_defect' ? 'Zéro défaut' : 'Standard'}</strong></div>
          <div><span>Vendeur</span><strong>{item.seller_name || 'Non renseigné'}</strong></div>
        </div>

        <div style={{marginTop: '18px', padding: '16px', border: '1px solid #ddd', borderRadius: '12px'}}>
          <h2 style={{margin: '0 0 6px'}}>Photos pour identifier les boosters</h2>
          <p className="muted" style={{marginTop: 0}}>Ajoute plusieurs angles si certains boosters sont cachés ou difficiles à distinguer. Toutes les photos restent liées à cet exemplaire.</p>
          <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
            <label className="primaryButton" style={{cursor: photoUploading ? 'wait' : 'pointer'}}>
              📷 Prendre une photo
              <input type="file" accept="image/*" capture="environment" hidden disabled={photoUploading} onChange={e => { addDetailPhotos(e.target.files); e.target.value = '' }} />
            </label>
            <label className="secondaryButton" style={{cursor: photoUploading ? 'wait' : 'pointer'}}>
              🖼️ Ajouter des photos
              <input type="file" accept="image/*" multiple hidden disabled={photoUploading} onChange={e => { addDetailPhotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
          {boosters.some(b => !b.confirmed || b.confidence === 'low') && (
            <p style={{marginBottom: 0}}><strong>Si nécessaire :</strong> une photo complémentaire peut aider à départager deux illustrations très proches, mais l’analyse doit d’abord exploiter les portions déjà visibles.</p>
          )}
          {photoMessage && <div className={photoMessage.startsWith('❌') ? 'photoImmediateStatus error' : 'photoImmediateStatus success'} role="status">{photoMessage}</div>}
          {photos.length > 0 && (
            <div style={{marginTop: '14px'}}>
              <button type="button" className="primaryButton" disabled={analyzing || photoUploading} onClick={analyzePhotos}>
                {analyzing ? '🔍 Analyse en cours…' : `🔍 Analyser mes ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
              </button>
              {analysisMessage && <div className={analysisMessage.startsWith('❌') ? 'photoImmediateStatus error' : 'photoImmediateStatus success'} role="status">{analysisMessage}</div>}
            </div>
          )}
        </div>

        <div style={{marginTop: '18px', padding: '16px', border: '2px solid #f59e0b', borderRadius: '12px', background: '#fffaf0'}}>
          <h2 style={{margin: '0 0 10px'}}>Composition des boosters</h2>
          {boosters.length === 0 ? (
            <p style={{margin: 0}}>Aucun booster identifié pour le moment.</p>
          ) : (
            <div>
              {boosters.map((booster, index) => (
                <div key={booster.id || index} style={{padding: '10px 0', borderBottom: index < boosters.length - 1 ? '1px solid #eadfc8' : 'none'}}>
                  <strong>Booster {index + 1}</strong> — {booster.expansion_name || 'Extension à confirmer'}{booster.artwork_name ? ` — ${booster.artwork_name}` : ''}
                  {(analysisCandidates[index + 1] || []).length > 0 && (
                    <div className="candidateGrid">
                      {(analysisCandidates[index + 1] || []).map((candidate, candidateIndex) => (
                        <button
                          type="button"
                          className="candidateCard"
                          key={candidateIndex}
                          onClick={() => {
                            if (booster.confirmed) return
                            if (
                              booster.expansion_name &&
                              candidate.expansion_name &&
                              normalizeExpansionName(booster.expansion_name) !== normalizeExpansionName(candidate.expansion_name)
                            ) return
                            if (!booster.expansion_name && candidate.expansion_name) {
                              updateBooster(index, 'expansion_name', candidate.expansion_name)
                            }
                            updateBooster(index, 'artwork_name', candidate.artwork_name || '')
                            updateBooster(index, 'confidence', candidate.confidence || 'low')
                          }}
                        >
                          {candidate.image_url ? (
                            <img src={candidate.image_url} alt={candidate.artwork_name || candidate.expansion_name || 'Booster candidat'} />
                          ) : (
                            <div className="candidatePlaceholder">Visuel de référence à venir</div>
                          )}
                          <span>
                            <b>{candidate.artwork_name || 'Artwork à confirmer'}</b>
                            <small>{candidate.expansion_name || 'Extension à confirmer'} • {candidate.confidence === 'high' ? 'confiance élevée' : candidate.confidence === 'medium' ? 'confiance moyenne' : 'à vérifier'}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {item.booster_configuration && (
          <div className="itemComposition"><b>Boosters :</b> {item.booster_configuration}</div>
        )}
        {item.variant_note && (
          <div className="itemVariantNote"><b>Particularité :</b> {item.variant_note}</div>
        )}

        <div className="boosterCompositionEditor">
          <div className="boosterCompositionHead">
            <div>
              <h2>Composition des boosters</h2>
              <p className="muted">Une ligne par booster visible dans ton exemplaire. L’illustration permet de distinguer deux compositions de coffret.</p>
            </div>
            <button type="button" className="secondaryButton" onClick={addBooster}>+ Ajouter un booster</button>
          </div>

          {boosters.length === 0 ? (
            <p className="muted">Aucun booster identifié pour le moment.</p>
          ) : boosters.map((booster, index) => (
            <div className="boosterRow" key={booster.id || `new-${index}`}>
              <strong>Booster {index + 1}</strong>
              <input value={booster.expansion_name || ''} onChange={e => updateBooster(index, 'expansion_name', e.target.value)} placeholder="Extension (ex. Évolution Céleste)" />
              <input value={booster.artwork_name || ''} onChange={e => updateBooster(index, 'artwork_name', e.target.value)} placeholder="Illustration / Pokémon" />
              <select value={booster.confidence || 'manual'} onChange={e => updateBooster(index, 'confidence', e.target.value)}>
                <option value="high">IA : confiance élevée</option>
                <option value="medium">IA : à vérifier</option>
                <option value="low">IA : incertain</option>
                <option value="manual">Saisi manuellement</option>
              </select>
              <label className="boosterConfirmed"><input type="checkbox" checked={Boolean(booster.confirmed)} onChange={e => updateBooster(index, 'confirmed', e.target.checked)} /> Confirmé</label>
              <button type="button" className="textButton" onClick={() => setBoosters(current => current.filter((_, i) => i !== index))}>Supprimer</button>
            </div>
          ))}
          {boosters.length > 0 && <button type="button" className="primaryButton" onClick={saveBoosters}>Enregistrer la composition</button>}
          {boosterMessage && <div className="photoImmediateStatus success" role="status">{boosterMessage}</div>}
        </div>
      </section>

      {activePhoto && (
        <div className="photoLightbox" onClick={() => setActivePhoto(null)}>
          <button className="photoLightboxClose" onClick={() => setActivePhoto(null)}>×</button>
          <img src={activePhoto} alt={item.custom_name} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </main>
  )
}
