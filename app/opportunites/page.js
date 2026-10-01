'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { fetchAllRows } from '../../lib/supabase-pagination'
import { summarizeWatchlistHistory } from '../../lib/watchlist-history.mjs'
import { selectWatchlistOffer } from '../../lib/watchlist-offers.mjs'
import { findWatchlistProducts } from '../../lib/watchlist-search.mjs'
import { summarizeDuplicatePurchasePrices, summarizeDuplicateValues, summarizeDuplicateGroups } from '../../lib/duplicate-purchase-prices.mjs'

function euro(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:2 }).format(Number(value))
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

export default function OpportunitiesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
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
        setItems([])
        setWatchlist([])
        setHistory([])
        setOffers([])
        return
      }

      const [itemsRes, productsRes, watchRes, historyRes, prefsRes, offersRes] = await Promise.all([
        fetchAllRows(() => supabase.from('collection_items')
          .select('id,product_id,custom_name,quantity,purchase_price,current_value_override,sealed_condition,purchase_date,collection_profiles!inner(profile_type)')
          .eq('collection_profiles.profile_type', 'personal')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })),
        fetchAllRows(() => supabase.from('products').select('id,name,series,product_type,current_value,zero_defect_value,price_updated_at').eq('is_public', true).order('name').order('id')),
        fetchAllRows(() => supabase.from('product_watchlist').select('id,product_id,target_price,max_price,notes,active,created_at').eq('user_id', user.id).eq('active', true).order('created_at', { ascending:false }).order('id')),
        fetchAllRows(() => supabase.from('product_price_history').select('product_id,price,observed_at,condition_tier,observation_type').eq('observation_type','confirmed_sale').order('observed_at', { ascending:true }).order('id')),
        supabase.from('notification_preferences').select('email_enabled,email_address,sms_enabled,phone_e164,alert_watchlist_price').eq('user_id', user.id).maybeSingle(),
        fetchAllRows(() => supabase.from('market_offers').select('id,product_id,source,seller_name,seller_type,seller_rating,price,shipping_price,total_price,currency,condition_note,language,offer_url,observed_at').eq('active', true).order('observed_at', { ascending:false }).order('id'))
      ])

      if (request !== loadRequestRef.current) return
      if ([itemsRes, productsRes, watchRes, historyRes, prefsRes, offersRes].some(result => result.error)) {
        throw new Error('Le tableau de bord n’a pas pu être chargé.')
      }
      setItems(itemsRes.data || [])
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
      if (request === loadRequestRef.current) setLoadError('Impossible de charger tes doublons et ta watchlist. Réessaie dans un instant.')
    } finally {
      if (request === loadRequestRef.current) setLoading(false)
    }
  }

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id,p])), [products])

  const duplicateGroups = useMemo(() => {
    const groups = new Map()
    items.forEach(item => {
      const customName = normalize(item.custom_name)
      const key = item.product_id ? `product:${item.product_id}`
        : customName ? `custom:${customName}` : `item:${item.id}`
      const product = item.product_id ? productById[item.product_id] : null
      const currentValue = item.current_value_override != null
        ? Number(item.current_value_override)
        : item.sealed_condition === 'zero_defect' && product?.zero_defect_value != null
          ? Number(product.zero_defect_value)
          : product?.current_value != null
            ? Number(product.current_value)
            : null

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          productId:item.product_id,
          name:product?.name || item.custom_name,
          series:product?.series || '',
          quantity:0,
          currentValue:currentValue,
          rows:[]
        })
      }
      const g = groups.get(key)
      const q = Number(item.quantity || 1)
      g.quantity += q
      g.rows.push({ ...item, estimatedUnitValue: currentValue })
    })

    return [...groups.values()]
      .filter(g => g.quantity > 1)
      .map(g => {
        const sellable = g.quantity - 1
        const valueStats = summarizeDuplicateValues(g.rows)
        const purchaseStats = summarizeDuplicatePurchasePrices(g.rows, valueStats.currentValue)
        return { ...g, sellable, ...valueStats, ...purchaseStats }
      })
      .sort((a,b) => (b.estimatedSaleValue ?? -1) - (a.estimatedSaleValue ?? -1))
  }, [items, productById])

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
      <h1>Doublons & Watchlist</h1>
      <p role="alert">{loadError}</p>
      <button className="btn" type="button" onClick={load}>Réessayer</button>
    </section></main>
  )

  if (!user) return (
    <main className="narrow">
      <section className="panel">
        <h1>Doublons & Watchlist</h1>
        <p>Connecte-toi pour accéder à tes doublons et à ta veille de prix.</p>
        <a className="btn" href="/login?next=%2Fopportunites">Connexion / inscription</a>
      </section>
    </main>
  )

  const { totalDuplicates, possibleDuplicates, incompleteValuation, salePotential } = summarizeDuplicateGroups(duplicateGroups)
  const opportunities = watchRows.filter(w => w.opportunity).length

  return (
    <main>
      <div className="collectionHeader">
        <div>
          <span className="eyebrow dark">Assistant collectionneur</span>
          <h1>Doublons & Watchlist</h1>
          <p className="muted">Repère ce que tu peux vendre en priorité et surveille les scellés que tu aimerais acheter.</p>
        </div>
        <div className="collectionHeaderActions">
          <a className="btn ghost" href="/collection">← Ma collection</a>
          <a className="btn ghost" href="/collection/statistiques">📊 Statistiques</a>
        </div>
      </div>

      <section className="stats">
        <div><span>Doublons avec référence catalogue</span><strong>{totalDuplicates}</strong></div>
        <div><span>Valeur de ces doublons{incompleteValuation ? ' (partielle)' : ''}</span><strong>{euro(salePotential)}</strong></div>
        <div><span>Watchlist</span><strong>{watchRows.length}</strong></div>
        <div><span>Prix sous objectif</span><strong>{opportunities}</strong></div>
      </section>

      {possibleDuplicates > 0 && <p className="muted">{possibleDuplicates} doublon{possibleDuplicates > 1 ? 's' : ''} possible{possibleDuplicates > 1 ? 's' : ''} hors catalogue à vérifier, exclu{possibleDuplicates > 1 ? 's' : ''} des totaux ci-dessus.</p>}
      {incompleteValuation && <p className="muted">Le total exclut les groupes dont une valeur manque. Renseigne les valeurs de ces exemplaires pour obtenir une estimation complète.</p>}

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:'18px'}}>
        <section className="panel">
          <h2>♻️ Mes doublons à vendre</h2>
          <p className="muted">Le calcul suppose que tu conserves 1 exemplaire par référence. Il ne modifie pas ta collection. Pour les produits hors catalogue, un nom identique suggère seulement un doublon à vérifier.</p>
          {duplicateGroups.length === 0 ? (
            <p>Aucun doublon détecté pour le moment.</p>
          ) : (
            <div className="productList">
              {duplicateGroups.map((g,index) => (
                <article className="productCard" key={g.key}>
                  <div className="productMain">
                    <div>
                      <span className="catalogBadge">{!g.productId ? 'Doublon possible · à vérifier' : index < 3 ? 'À regarder en priorité' : 'Doublon'}</span>
                      <h3>{g.name}</h3>
                      <p>{g.series || 'Série non renseignée'} • {g.quantity} possédé{g.quantity > 1 ? 's' : ''} • {g.sellable} en doublon</p>
                    </div>
                    <div className="productValues">
                      <b>{g.currentValue == null ? 'Valeur non renseignée' : `${euro(g.currentValue)} / unité en moyenne`}</b>
                      <span className={g.unitGain == null ? 'muted' : g.unitGain >= 0 ? 'gain' : 'loss'}>
                        {g.unitGain == null ? 'Gain non calculable' : `${g.unitGain >= 0 ? '+' : ''}${euro(g.unitGain)} vs achat moyen`}
                      </span>
                    </div>
                  </div>
                  <div className="marketStats">
                    <div><span>Achat moyen{g.missingPurchaseCount > 0 ? ' (partiel)' : ''}</span><strong>{euro(g.avgBuy)}</strong></div>
                    <div><span>À conserver</span><strong>1</strong></div>
                    <div><span>À vendre</span><strong>{g.sellable}</strong></div>
                    <div><span>Valeur doublons</span><strong>{euro(g.estimatedSaleValue)}</strong></div>
                  </div>
                  {g.missingValueCount > 0 && <p className="muted">Valeur manquante pour {g.missingValueCount} exemplaire{g.missingValueCount > 1 ? 's' : ''}. Estimation de revente non calculable.</p>}
                  {!g.productId && <p className="muted">Ces fiches sont regroupées par leur nom, sans référence catalogue commune. Vérifie qu’il s’agit du même produit avant de considérer les exemplaires comme des doublons.</p>}
                  <p className="muted">Estimation en conservant l’exemplaire de plus forte valeur. Les autres sont évalués selon leur état et leur valeur renseignée.</p>
                  {g.missingPurchaseCount > 0 && <p className="muted">Prix d’achat non renseigné pour {g.missingPurchaseCount} exemplaire{g.missingPurchaseCount > 1 ? 's' : ''}. La moyenne porte sur les achats connus ; le gain comparatif n’est pas calculé.</p>}
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Voir mes exemplaires · {g.rows.length} fiche{g.rows.length > 1 ? 's' : ''}</summary>
                    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                      {g.rows.map(item => (
                        <div key={item.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, minWidth: 0 }}>
                          <strong>{item.custom_name || g.name}</strong>
                          <p style={{ margin: '6px 0', overflowWrap: 'anywhere' }}>
                            {item.quantity || 1} exemplaire{Number(item.quantity || 1) > 1 ? 's' : ''} · {item.sealed_condition === 'zero_defect' ? 'Zéro défaut' : 'État standard'}
                            {' · Achat : '}{euro(item.purchase_price)}
                            {item.purchase_date && ` · ${new Date(item.purchase_date + 'T12:00:00').toLocaleDateString('fr-FR')}`}
                          </p>
                          <a className="miniBtn" href={`/collection/${item.id}`}>Ouvrir cette fiche →</a>
                        </div>
                      ))}
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>🎯 Ma watchlist</h2>
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
