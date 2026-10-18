'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { fetchAllRows } from '../../lib/supabase-pagination'
import { summarizeWatchlistHistory } from '../../lib/watchlist-history.mjs'
import { selectWatchlistOffer } from '../../lib/watchlist-offers.mjs'
import { findWatchlistProducts } from '../../lib/watchlist-search.mjs'

function euro(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:2 }).format(Number(value))
}

export default function OpportunitiesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [products, setProducts] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [history, setHistory] = useState([])
  const [offers, setOffers] = useState([])
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [targetDrafts, setTargetDrafts] = useState({})
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const watchMutationRef = useRef(false)
  const [watchSaving, setWatchSaving] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState({ email_enabled:true, email_address:'', sms_enabled:false, phone_e164:'', alert_watchlist_price:true })
  const [notificationMessage, setNotificationMessage] = useState('')
  const notificationSavingRef = useRef(false)
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const loadRequestRef = useRef(0)

  useEffect(() => {
    load()
    return () => { loadRequestRef.current += 1 }
  }, [])

  async function load() {
    const request = ++loadRequestRef.current
    setLoading(true)
    setLoadError('')
    try {
      const { data:{ user }, error: authError } = await supabase.auth.getUser()
      if (request !== loadRequestRef.current) return
      if (authError) throw authError
      setUser(user)
      if (!user) {
        setWatchlist([])
        setHistory([])
        setOffers([])
        return
      }

      const [productsRes, watchRes, historyRes, prefsRes, offersRes] = await Promise.all([
        fetchAllRows(() => supabase.from('products').select('id,name,series,product_type,current_value,zero_defect_value,price_updated_at').eq('is_public', true).order('name').order('id')),
        fetchAllRows(() => supabase.from('product_watchlist').select('id,product_id,target_price,max_price,notes,active,created_at').eq('user_id', user.id).eq('active', true).order('created_at', { ascending:false }).order('id')),
        fetchAllRows(() => supabase.from('product_price_history').select('product_id,price,observed_at,condition_tier,observation_type').eq('observation_type','confirmed_sale').order('observed_at', { ascending:true }).order('id')),
        supabase.from('notification_preferences').select('email_enabled,email_address,sms_enabled,phone_e164,alert_watchlist_price').eq('user_id', user.id).maybeSingle(),
        fetchAllRows(() => supabase.from('market_offers').select('id,product_id,source,seller_name,seller_type,seller_rating,price,shipping_price,total_price,currency,condition_note,language,offer_url,observed_at').eq('active', true).order('observed_at', { ascending:false }).order('id'))
      ])

      if (request !== loadRequestRef.current) return
      if ([productsRes, watchRes, historyRes, prefsRes, offersRes].some(result => result.error)) {
        throw new Error('Le tableau de bord n’a pas pu être chargé.')
      }
      setProducts(productsRes.data || [])
      setWatchlist(watchRes.data || [])
      setTargetDrafts({})
      setHistory(historyRes.data || [])
      setOffers(offersRes.data || [])
      setNotificationPrefs({
        email_enabled:prefsRes.data?.email_enabled ?? true,
        email_address:prefsRes.data?.email_address || user.email || '',
        sms_enabled:prefsRes.data?.sms_enabled ?? false,
        phone_e164:prefsRes.data?.phone_e164 || '',
        alert_watchlist_price:prefsRes.data?.alert_watchlist_price ?? true
      })
    } catch {
      if (request === loadRequestRef.current) setLoadError('Impossible de charger ta watchlist. Réessaie dans un instant.')
    } finally {
      if (request === loadRequestRef.current) setLoading(false)
    }
  }

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id,p])), [products])

  const watchRows = useMemo(() => watchlist.map(w => {
    const product = productById[w.product_id]
    const sales = history.filter(h => h.product_id === w.product_id && (h.condition_tier || 'standard') === 'standard')
    const historyStats = summarizeWatchlistHistory(sales)
    const market = product?.current_value != null ? Number(product.current_value) : null
    const target = w.target_price != null ? Number(w.target_price) : null
    const productOffers = offers.filter(o => o.product_id === w.product_id)
    const { bestOffer, opportunity } = selectWatchlistOffer(productOffers, w.target_price)
    const effectivePrice = bestOffer ? bestOffer.comparableTotal : market
    const discountToTarget = target && effectivePrice != null ? ((target - effectivePrice) / target) * 100 : null

    return {
      ...w,
      product,
      market,
      target,
      opportunity,
      discountToTarget,
      ...historyStats,
      bestOffer,
      effectivePrice
    }
  }).sort((a,b) => Number(b.opportunity) - Number(a.opportunity)), [watchlist, productById, history, offers])

  const searchMatches = useMemo(() => findWatchlistProducts(products, watchlist, query), [query, products, watchlist])

  async function mutateWatchlist(action, success) {
    if (watchMutationRef.current) return
    watchMutationRef.current = true
    setWatchSaving(true)
    setMessage('Enregistrement…')
    try {
      const { error } = await action()
      if (error) throw error
      setMessage(success)
      await load()
      return true
    } catch {
      setMessage('Impossible de confirmer la modification. Réessaie après avoir actualisé la page.')
      return false
    } finally {
      watchMutationRef.current = false
      setWatchSaving(false)
    }
  }

  function parseTarget(value) {
    if (String(value).trim() === '') return null
    const target = Number(value)
    if (!Number.isFinite(target) || target < 0) throw new Error('invalid target')
    return target
  }

  async function addToWatchlist(e) {
    e.preventDefault()
    if (!user || !selectedProduct || watchMutationRef.current) return
    let target
    try { target = parseTarget(targetPrice) }
    catch { return setMessage('Indique un prix objectif positif ou nul, ou laisse le champ vide.') }
    await mutateWatchlist(async () => {
      const result = await supabase.from('product_watchlist').upsert({
        user_id:user.id, product_id:selectedProduct.id,
        target_price:target, notes:notes.trim() || null, active:true
      }, { onConflict:'user_id,product_id' }).select('id').single()
      if (!result.error && result.data?.id) {
        setSelectedProduct(null)
        setQuery('')
        setTargetPrice('')
        setNotes('')
      }
      return result
    }, '✓ Produit ajouté à la watchlist.')
  }

  async function removeWatch(id) {
    if (!user) return
    await mutateWatchlist(() => supabase.from('product_watchlist').delete()
      .eq('id',id).eq('user_id',user.id).select('id').single(), '✓ Produit retiré de la watchlist.')
  }

  async function updateTarget(id, value) {
    if (!user || watchMutationRef.current) return
    const existing = watchlist.find(row => row.id === id)
    const savedTarget = existing?.target_price == null ? null : Number(existing.target_price)
    const restore = () => setTargetDrafts(drafts => ({ ...drafts, [id]: savedTarget ?? '' }))
    let target
    try { target = parseTarget(value) }
    catch {
      restore()
      return setMessage('Prix objectif invalide : la dernière valeur chargée a été rétablie.')
    }
    if (savedTarget === target) { restore(); return }
    const confirmed = await mutateWatchlist(() => supabase.from('product_watchlist').update({ target_price:target })
      .eq('id',id).eq('user_id',user.id).select('id').single(), '✓ Prix objectif enregistré.')
    if (!confirmed) restore()
  }

  async function saveNotificationPreferences(e) {
    e.preventDefault()
    if (!user || notificationSavingRef.current) return
    notificationSavingRef.current = true
    setNotificationSaving(true)
    setNotificationMessage('Enregistrement…')
    try {
      const { error } = await supabase.from('notification_preferences').upsert({
        user_id:user.id,
        email_enabled:Boolean(notificationPrefs.email_enabled),
        email_address:notificationPrefs.email_address.trim() || null,
        sms_enabled:Boolean(notificationPrefs.sms_enabled),
        phone_e164:notificationPrefs.phone_e164.trim() || null,
        alert_watchlist_price:Boolean(notificationPrefs.alert_watchlist_price),
        updated_at:new Date().toISOString()
      }, { onConflict:'user_id' }).select('user_id').single()
      if (error) throw error
      setNotificationMessage('✓ Préférences enregistrées. Les envois automatiques ne sont pas encore actifs.')
    } catch {
      setNotificationMessage('Impossible de confirmer l’enregistrement des préférences. Réessaie après avoir actualisé la page.')
    } finally {
      notificationSavingRef.current = false
      setNotificationSaving(false)
    }
  }

  if (loading) return <main><section className="panel"><p>Chargement du tableau de bord…</p></section></main>

  if (loadError) return (
    <main className="narrow"><section className="panel">
      <h1>Ma watchlist</h1>
      <p role="alert">{loadError}</p>
      <button className="btn" type="button" onClick={load}>Réessayer</button>
    </section></main>
  )

  if (!user) return (
    <main className="narrow">
      <section className="panel">
        <h1>Ma watchlist</h1>
        <p>Connecte-toi pour suivre les produits que tu recherches.</p>
        <a className="btn" href="/login?next=%2Fopportunites">Connexion / inscription</a>
      </section>
    </main>
  )

  const opportunities = watchRows.filter(w => w.opportunity).length

  return (
    <main className="opportunitiesWorkspace">
      <div className="collectionHeader">
        <div>
          <span className="eyebrow dark">Assistant collectionneur</span>
          <h1>Ma watchlist</h1>
          <p className="muted">Suis les produits que tu recherches et repère les prix sous ton objectif.</p>
        </div>
        <div className="collectionHeaderActions">
          <a className="backLink" href="/collection">← Ma collection</a>
        </div>
      </div>

      <section className="stats">
        <div><span>Watchlist</span><strong>{watchRows.length}</strong></div>
        <div><span>Prix sous objectif</span><strong>{opportunities}</strong></div>
      </section>

      <section className="panel" id="ma-watchlist">        <section className="panel" id="ma-watchlist">
          <h2>Ma watchlist</h2>
          <p className="muted">Ajoute un produit et fixe, si tu le souhaites, un prix auquel tu veux être alerté.</p>

          <form onSubmit={addToWatchlist} className="formGrid">
            <label>
              Rechercher un produit
              <input type="search" value={query} onChange={e => { setQuery(e.target.value); setSelectedProduct(null) }} placeholder="Ex. ETB Évolution Céleste" />
            </label>

            {searchMatches.length > 0 && !selectedProduct && (
              <div className="catalogSuggestions">
                {searchMatches.map(p => (
                  <button type="button" key={p.id} onClick={() => { setSelectedProduct(p); setQuery(p.name) }}>
                    <b>{p.name}</b><span>{p.series || p.product_type || ''}</span>
                  </button>
                ))}
              </div>
            )}

            {query.trim().length >= 2 && !selectedProduct && searchMatches.length === 0 && <p role="status" className="muted">Aucun produit à ajouter : vérifie la recherche ou les produits déjà présents dans ta watchlist.</p>}

            {selectedProduct && <div className="message">✓ {selectedProduct.name}</div>}

            <label>
              Prix objectif (€)
              <input type="number" min="0" step="0.01" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="Ex. 60" />
            </label>

            <label>
              Note facultative
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex. seulement en français / scellé propre" />
            </label>

            <button className="btn" type="submit" disabled={!selectedProduct || watchSaving}>{watchSaving ? 'Enregistrement…' : 'Ajouter à ma watchlist'}</button>
          </form>

          {message && <p className="message">{message}</p>}

          <div className="productList" style={{marginTop:'18px'}}>
            {watchRows.length === 0 ? <p>Ta watchlist est vide.</p> : watchRows.map(w => (
              <article className="productCard" key={w.id} style={w.opportunity ? {border:'2px solid #d4a017'} : undefined}>
                <div className="productMain">
                  <div>
                    {w.opportunity && <span className="catalogBadge">Prix sous ton objectif ✓</span>}
                    <h3>{w.product?.name || 'Produit'}</h3>
                    <p>{w.product?.series || ''}{w.notes ? ` • ${w.notes}` : ''}</p>
                  </div>
                  <div className="productValues">
                    <b>{euro(w.effectivePrice)}</b>
                    {w.bestOffer
                      ? <small className="muted">Meilleure offre en euros, port compris</small>
                      : <small className="muted">Cote PokéValeur · aucune offre comparable repérée</small>}
                    {w.target != null && <small className="muted">Objectif : {euro(w.target)}</small>}
                  </div>
                </div>

                <div className="marketStats">
                  <div><span>Cote actuelle</span><strong>{euro(w.market)}</strong></div>
                  <div><span>Plus bas 30 j</span><strong>{euro(w.low30)}</strong></div>
                  <div><span>Médiane 90 j</span><strong>{euro(w.median90)}</strong></div>
                  <div><span>Ventes 90 j</span><strong>{w.sales90}</strong></div>
                </div>

                {w.bestOffer && (
                  <div className="message" style={{marginTop:'12px'}}>
                    <b>{w.bestOffer.source}</b>
                    {w.bestOffer.seller_name ? ` • vendeur : ${w.bestOffer.seller_name}` : ''}
                    {w.bestOffer.seller_type ? ` • ${w.bestOffer.seller_type}` : ''}
                    {w.bestOffer.seller_rating != null ? ` • note ${w.bestOffer.seller_rating}` : ''}
                    <br />
                    Prix : {euro(w.bestOffer.price)}
                    {w.bestOffer.shipping_price != null ? ` + port ${euro(w.bestOffer.shipping_price)}` : ''}
                    {' • '}Total : {euro(w.bestOffer.comparableTotal)}
                    {w.bestOffer.language ? ` • ${w.bestOffer.language}` : ''}
                    {w.bestOffer.condition_note ? ` • ${w.bestOffer.condition_note}` : ''}
                  </div>
                )}

                <div className="rowActions">
                  <label style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span>Objectif</span>
                    <input
                      style={{width:'110px'}}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={watchSaving}
                      value={targetDrafts[w.id] ?? w.target ?? ''}
                      onChange={e => setTargetDrafts(drafts => ({ ...drafts, [w.id]: e.target.value }))}
                      onBlur={e => updateTarget(w.id,e.target.value)}
                    />
                  </label>
                  <a className="miniBtn" href={`/catalogue/${w.product_id}`}>Voir la fiche</a>
                  {w.bestOffer?.offer_url && <a className="miniBtn primaryMini" href={w.bestOffer.offer_url} target="_blank" rel="noreferrer">Voir l’offre</a>}
                  <button className="miniBtn dangerMini" type="button" disabled={watchSaving} onClick={() => removeWatch(w.id)}>Retirer</button>
                </div>
              </article>
            ))}
          </div>
        </section>

      <section className="panel" style={{marginTop:'18px'}}>
        <h2>🔔 Mes préférences d’alerte</h2>
        <p className="muted">Les alertes automatiques par e-mail et SMS ne sont pas encore actives. Tu peux enregistrer tes préférences pour leur future activation.</p>
        <form onSubmit={saveNotificationPreferences} className="formGrid">
          <fieldset disabled={notificationSaving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 16 }}>
          <label style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <input type="checkbox" checked={notificationPrefs.email_enabled} onChange={e => setNotificationPrefs({...notificationPrefs,email_enabled:e.target.checked})} />
            Alerte par e-mail
          </label>
          <label>
            Adresse e-mail
            <input type="email" value={notificationPrefs.email_address} onChange={e => setNotificationPrefs({...notificationPrefs,email_address:e.target.value})} placeholder={user.email || 'adresse@email.fr'} />
          </label>
          <label style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <input type="checkbox" checked={notificationPrefs.sms_enabled} onChange={e => setNotificationPrefs({...notificationPrefs,sms_enabled:e.target.checked})} />
            Alerte par SMS
          </label>
          <label>
            Numéro de mobile
            <input value={notificationPrefs.phone_e164} onChange={e => setNotificationPrefs({...notificationPrefs,phone_e164:e.target.value})} placeholder="+33612345678" />
          </label>
          <label style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <input type="checkbox" checked={notificationPrefs.alert_watchlist_price} onChange={e => setNotificationPrefs({...notificationPrefs,alert_watchlist_price:e.target.checked})} />
            M’alerter lorsqu’un prix objectif est atteint
          </label>
          <button className="btn" type="submit">{notificationSaving ? 'Enregistrement…' : 'Enregistrer mes préférences'}</button>
          </fieldset>
        </form>
        {notificationMessage && <p className="message">{notificationMessage}</p>}
        <p className="muted"><small>Tes préférences sont conservées dans ton compte. Aucun e-mail ni SMS d’alerte n’est envoyé pour le moment.</small></p>
      </section>

      <section className="panel" style={{marginTop:'18px'}}>
        <h2>Comment PokéValeur lit une opportunité</h2>
        <p>
          La watchlist ne dit pas automatiquement « achète ». Elle rapproche ta limite de prix de la cote PokéValeur,
          du plus bas observé sur 30 jours, de la médiane des ventes confirmées sur 90 jours et du nombre de ventes.
          L’objectif est de te donner le contexte pour décider toi-même.
        </p>
      </section>
    </main>
  )
}
