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
