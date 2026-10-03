'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { SocialAccessPrompt } from '../../lib/social-access-prompt'

export default function TradesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [listings, setListings] = useState([])
  const [offers, setOffers] = useState([])
  const [messages, setMessages] = useState({})
  const [selectedItemId, setSelectedItemId] = useState('')
  const [wantedText, setWantedText] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [socialAccess, setSocialAccess] = useState(null)
  const [socialAccessError, setSocialAccessError] = useState(false)

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])

  async function load() {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) {
      setLoading(false)
      return
    }

    const { data: accessData, error: accessError } = await supabase.rpc('get_social_access_status')
    const accessStatus = Array.isArray(accessData) ? accessData[0] : accessData
    if (accessError || !accessStatus?.can_access) {
      setSocialAccess(false)
      setSocialAccessError(Boolean(accessError))
      setItems([])
      setListings([])
      setOffers([])
      setMessages({})
      setLoading(false)
      return
    }
    setSocialAccess(true)
    setSocialAccessError(false)

    const [{ data:itemData }, { data:listingData }, { data:offerData }] = await Promise.all([
      supabase.from('collection_items').select('id,product_id,custom_name,quantity,photo_path,variant_note,collection_profiles!inner(profile_type)').eq('collection_profiles.profile_type','personal').order('created_at',{ascending:false}),
      supabase.from('trade_listings').select('*').order('created_at',{ascending:false}),
      supabase.from('trade_offers').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at',{ascending:false})
    ])

    setItems(itemData || [])
    setListings(listingData || [])
    setOffers(offerData || [])

    const offerIds = (offerData || []).map(o => o.id)
    if (offerIds.length) {
      const { data:messageData } = await supabase
        .from('trade_messages')
        .select('*')
        .in('trade_offer_id', offerIds)
        .order('created_at',{ascending:true})
      const grouped = {}
      ;(messageData || []).forEach(m => {
        if (!grouped[m.trade_offer_id]) grouped[m.trade_offer_id] = []
        grouped[m.trade_offer_id].push(m)
      })
      setMessages(grouped)
    } else {
      setMessages({})
    }

    setLoading(false)
  }

  const eligible = items.length >= 10
  const itemById = useMemo(() => Object.fromEntries(items.map(i => [i.id,i])), [items])
  const myListingItemIds = new Set(listings.filter(l => l.user_id === user?.id).map(l => l.collection_item_id))

  async function createListing(e) {
    e.preventDefault()
    if (!eligible) return setMessage('Il faut 10 fiches distinctes dans ta collection pour proposer un trade.')
    const item = itemById[selectedItemId]
    if (!item) return setMessage('Choisis un produit de ta collection.')

    const { error } = await supabase.from('trade_listings').upsert({
      user_id:user.id,
      collection_item_id:item.id,
      product_id:item.product_id || null,
      title:item.custom_name,
      wanted_text:wantedText.trim() || null,
      notes:notes.trim() || null,
      status:'active',
      updated_at:new Date().toISOString()
    }, { onConflict:'user_id,collection_item_id' })

    if (error) return setMessage('❌ ' + error.message)
    setSelectedItemId('')
    setWantedText('')
    setNotes('')
    setMessage('✓ Produit proposé à l’échange.')
    await load()
  }

  async function sendOffer(listing) {
    const offeredItemId = window.prompt('ID de ton produit à proposer (facultatif). Tu peux laisser vide et discuter d’abord.')
    const text = window.prompt('Ton message pour ce trade')
    if (!text?.trim()) return

    const payload = {
      listing_id:listing.id,
      sender_id:user.id,
      recipient_id:listing.user_id,
      offered_collection_item_id:offeredItemId?.trim() || null,
      message:text.trim()
    }

    const { data, error } = await supabase.from('trade_offers').insert(payload).select('id').single()
    if (error) return setMessage('❌ ' + error.message)

    await supabase.from('trade_messages').insert({
      trade_offer_id:data.id,
      sender_id:user.id,
      body:text.trim()
    })

    setMessage('✓ Proposition envoyée.')
    await load()
  }

  async function setOfferStatus(id,status) {
    const { error } = await supabase.from('trade_offers').update({status,updated_at:new Date().toISOString()}).eq('id',id)
    if (error) return setMessage('❌ ' + error.message)
    await load()
  }

  async function sendReply(offerId) {
    const body = (replyDrafts[offerId] || '').trim()
    if (!body) return
    const { error } = await supabase.from('trade_messages').insert({
      trade_offer_id:offerId,
      sender_id:user.id,
      body
    })
    if (error) return setMessage('❌ ' + error.message)
    setReplyDrafts(prev => ({...prev,[offerId]:''}))
    await load()
  }

  async function closeListing(id) {
    const { error } = await supabase.from('trade_listings').update({status:'closed',updated_at:new Date().toISOString()}).eq('id',id)
    if (error) return setMessage('❌ ' + error.message)
    await load()
  }

  if (loading) return <main><section className="panel"><p>Chargement des trades…</p></section></main>

  if (!user) return (
    <main className="narrow">
      <section className="panel">
        <h1>Trades entre membres</h1>
        <p>Connecte-toi pour accéder aux échanges entre collectionneurs.</p>
        <a className="btn" href="/login?next=%2Ftrades">Connexion</a>
      </section>
    </main>
  )

  if (socialAccess !== true) return (
    <main className="narrow">
      <section className="panel">
        <span className="eyebrow dark">Trades</span>
        <h1>Avant d’entrer</h1>
        <p className="muted">Un accord est nécessaire pour voir les annonces et contacter d’autres collectionneurs.</p>
        <SocialAccessPrompt supabase={supabase} verificationError={socialAccessError} onRetry={load} onGranted={load} />
      </section>
    </main>
  )

  return (
    <main>
      <div className="collectionHeader">
        <div>
          <span className="eyebrow dark">Communauté</span>
          <h1>Trades entre membres</h1>
          <p className="muted">PokéValeur facilite la mise en relation. Chaque membre reste responsable de l’échange qu’il accepte.</p>
        </div>
        <div className="collectionHeaderActions">
          <a className="btn ghost" href="/communaute">💬 Communauté</a>
          <a className="btn ghost" href="/collection">← Ma collection</a>
        </div>
      </div>

      <section className="stats">
        <div><span>Mes fiches</span><strong>{items.length}</strong></div>
        <div><span>Accès trade</span><strong>{eligible ? 'Débloqué' : `${items.length}/10`}</strong></div>
        <div><span>Annonces actives</span><strong>{listings.filter(l => l.status==='active').length}</strong></div>
        <div><span>Mes propositions</span><strong>{offers.length}</strong></div>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:'18px'}}>
        <section className="panel">
          <h2>🔁 Proposer un produit à l’échange</h2>
          {!eligible ? (
            <p className="message">Lecture seule. Il faut 10 fiches distinctes dans ta collection pour proposer ou envoyer un trade.</p>
          ) : (
            <form className="formGrid" onSubmit={createListing}>
              <label>
                Produit de ma collection
                <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} required>
                  <option value="">Choisir un produit…</option>
                  {items.filter(i => !myListingItemIds.has(i.id)).map(item => (
                    <option key={item.id} value={item.id}>{item.custom_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Je recherche
                <input value={wantedText} onChange={e => setWantedText(e.target.value)} placeholder="Ex. ETB 151, artset complet, ouvert aux propositions…" />
              </label>
              <label>
                Notes
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" placeholder="État, langue, particularités…" />
              </label>
              <button className="btn" type="submit">Mettre en trade</button>
            </form>
          )}
          {message && <p className="message">{message}</p>}
        </section>

        <section className="panel">
          <h2>🧩 Trades disponibles</h2>
          <div className="productList">
            {listings.filter(l => l.status==='active').length === 0 ? <p>Aucune annonce active.</p> :
              listings.filter(l => l.status==='active').map(listing => (
                <article className="productCard" key={listing.id}>
                  <div className="productMain">
                    <div>
                      <span className="catalogBadge">Disponible à l’échange</span>
                      <h3>{listing.title}</h3>
                      {listing.wanted_text && <p><b>Recherche :</b> {listing.wanted_text}</p>}
                      {listing.notes && <p>{listing.notes}</p>}
                    </div>
                  </div>
                  <div className="rowActions">
                    {listing.user_id === user.id ? (
                      <button className="miniBtn dangerMini" onClick={() => closeListing(listing.id)}>Retirer du trade</button>
                    ) : eligible ? (
                      <button className="miniBtn primaryMini" onClick={() => sendOffer(listing)}>Proposer un trade</button>
                    ) : (
                      <span className="muted">10 fiches requises pour proposer</span>
                    )}
                  </div>
                </article>
              ))
            }
          </div>
        </section>
      </section>

      <section className="panel" style={{marginTop:'18px'}}>
        <h2>✉️ Mes propositions</h2>
        <div className="productList">
          {offers.length === 0 ? <p>Aucune proposition pour le moment.</p> : offers.map(offer => {
            const listing = listings.find(l => l.id === offer.listing_id)
            const incoming = offer.recipient_id === user.id
            return (
              <article className="productCard" key={offer.id}>
                <div className="productMain">
                  <div>
                    <span className="catalogBadge">{incoming ? 'Proposition reçue' : 'Proposition envoyée'}</span>
                    <h3>{listing?.title || 'Trade'}</h3>
                    <p>Statut : <b>{offer.status}</b></p>
                    {offer.message && <p>{offer.message}</p>}
                  </div>
                </div>

                <div style={{marginTop:'10px'}}>
                  {(messages[offer.id] || []).map(m => (
                    <div className="communityMessage" key={m.id}>
                      <small>{m.sender_id === user.id ? 'Moi' : 'Autre membre'} • {new Date(m.created_at).toLocaleString('fr-FR')}</small>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>

                <div className="formGrid" style={{marginTop:'10px'}}>
                  <textarea
                    rows="2"
                    placeholder="Écrire un message privé…"
                    value={replyDrafts[offer.id] || ''}
                    onChange={e => setReplyDrafts(prev => ({...prev,[offer.id]:e.target.value}))}
                  />
                  <button className="miniBtn" onClick={() => sendReply(offer.id)}>Envoyer</button>
                </div>

                <div className="rowActions">
                  {incoming && offer.status==='pending' && <>
                    <button className="miniBtn primaryMini" onClick={() => setOfferStatus(offer.id,'accepted')}>Accepter</button>
                    <button className="miniBtn dangerMini" onClick={() => setOfferStatus(offer.id,'declined')}>Refuser</button>
                  </>}
                  {!incoming && offer.status==='pending' && <button className="miniBtn" onClick={() => setOfferStatus(offer.id,'cancelled')}>Annuler</button>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel" style={{marginTop:'18px'}}>
        <h2>Important</h2>
        <p>PokéValeur met uniquement les membres en relation et n’est pas partie à l’échange. Vérifiez l’état réel des produits, les photos, les conditions d’envoi et l’identité de votre interlocuteur avant toute expédition.</p>
      </section>
    </main>
  )
}
