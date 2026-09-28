'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

function euro(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:2 }).format(Number(value))
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a,b) => a-b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2
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
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) {
      setLoading(false)
      return
    }

    const [itemsRes, productsRes, watchRes, historyRes] = await Promise.all([
      supabase.from('collection_items').select('id,product_id,custom_name,quantity,purchase_price,current_value_override,sealed_condition,purchase_date').eq('user_id', user.id),
      supabase.from('products').select('id,name,series,product_type,current_value,zero_defect_value,price_updated_at').eq('is_public', true).order('name'),
      supabase.from('product_watchlist').select('id,product_id,target_price,max_price,notes,active,created_at').eq('user_id', user.id).eq('active', true).order('created_at', { ascending:false }),
      supabase.from('product_price_history').select('product_id,price,observed_at,condition_tier,observation_type').eq('observation_type','confirmed_sale').order('observed_at', { ascending:true })
    ])

    setItems(itemsRes.data || [])
    setProducts(productsRes.data || [])
    setWatchlist(watchRes.data || [])
    setHistory(historyRes.data || [])
    setLoading(false)
  }

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id,p])), [products])

  const duplicateGroups = useMemo(() => {
    const groups = new Map()
    items.forEach(item => {
      const key = item.product_id || 'custom:' + normalize(item.custom_name)
      const product = item.product_id ? productById[item.product_id] : null
      const currentValue = item.current_value_override != null
        ? Number(item.current_value_override)
        : item.sealed_condition === 'zero_defect' && product?.zero_defect_value != null
          ? Number(product.zero_defect_value)
          : product?.current_value != null
            ? Number(product.current_value)
            : Number(item.purchase_price || 0)

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          productId:item.product_id,
          name:product?.name || item.custom_name,
          series:product?.series || '',
          quantity:0,
          invested:0,
          currentValue:currentValue,
          rows:[]
        })
      }
      const g = groups.get(key)
      const q = Number(item.quantity || 1)
      g.quantity += q
      g.invested += Number(item.purchase_price || 0) * q
      g.currentValue = Math.max(g.currentValue || 0, currentValue || 0)
      g.rows.push(item)
    })

    return [...groups.values()]
      .filter(g => g.quantity > 1)
      .map(g => {
        const sellable = g.quantity - 1
        const avgBuy = g.quantity ? g.invested / g.quantity : 0
        const unitGain = (g.currentValue || 0) - avgBuy
        return { ...g, sellable, avgBuy, unitGain, estimatedSaleValue:sellable * (g.currentValue || 0) }
      })
      .sort((a,b) => b.estimatedSaleValue - a.estimatedSaleValue)
  }, [items, productById])

  const watchRows = useMemo(() => watchlist.map(w => {
    const product = productById[w.product_id]
    const sales = history.filter(h => h.product_id === w.product_id && (h.condition_tier || 'standard') === 'standard')
    const now = Date.now()
    const last90 = sales.filter(s => now - new Date(s.observed_at).getTime() <= 90 * 86400000)
    const last30 = sales.filter(s => now - new Date(s.observed_at).getTime() <= 30 * 86400000)
    const prices90 = last90.map(s => Number(s.price)).filter(Number.isFinite)
    const prices30 = last30.map(s => Number(s.price)).filter(Number.isFinite)
    const market = product?.current_value != null ? Number(product.current_value) : null
    const target = w.target_price != null ? Number(w.target_price) : null
    const opportunity = target != null && market != null && market <= target
    const discountToTarget = target && market != null ? ((target - market) / target) * 100 : null

    return {
      ...w,
      product,
      market,
      target,
      opportunity,
      discountToTarget,
      median90: median(prices90),
      low30: prices30.length ? Math.min(...prices30) : null,
      sales90: prices90.length
    }
  }).sort((a,b) => Number(b.opportunity) - Number(a.opportunity)), [watchlist, productById, history])

  const searchMatches = useMemo(() => {
    const n = normalize(query)
    if (n.length < 2) return []
    const watched = new Set(watchlist.map(w => w.product_id))
    return products
      .filter(p => !watched.has(p.id) && normalize([p.name,p.series,p.product_type].join(' ')).includes(n))
      .slice(0,8)
  }, [query, products, watchlist])

  async function addToWatchlist(e) {
    e.preventDefault()
    if (!user || !selectedProduct) return
    const { error } = await supabase.from('product_watchlist').upsert({
      user_id:user.id,
      product_id:selectedProduct.id,
      target_price:targetPrice === '' ? null : Number(targetPrice),
      notes:notes.trim() || null,
      active:true
    }, { onConflict:'user_id,product_id' })

    if (error) return setMessage('❌ ' + error.message)
    setMessage('✓ Produit ajouté à la watchlist.')
    setSelectedProduct(null)
    setQuery('')
    setTargetPrice('')
    setNotes('')
    await load()
  }

  async function removeWatch(id) {
    const { error } = await supabase.from('product_watchlist').delete().eq('id',id)
    if (error) return setMessage('❌ ' + error.message)
    await load()
  }

  async function updateTarget(id, value) {
    const { error } = await supabase.from('product_watchlist').update({
      target_price:value === '' ? null : Number(value)
    }).eq('id',id)
    if (error) return setMessage('❌ ' + error.message)
    await load()
  }

  if (loading) return <main><section className="panel"><p>Chargement du tableau de bord…</p></section></main>

  if (!user) return (
    <main className="narrow">
      <section className="panel">
        <h1>Doublons & Watchlist</h1>
        <p>Connecte-toi pour accéder à tes doublons et à ta veille de prix.</p>
        <a className="btn" href="/login">Connexion / inscription</a>
      </section>
    </main>
  )

  const totalDuplicates = duplicateGroups.reduce((s,g) => s + g.sellable, 0)
  const salePotential = duplicateGroups.reduce((s,g) => s + g.estimatedSaleValue, 0)
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
        <div><span>Doublons disponibles</span><strong>{totalDuplicates}</strong></div>
        <div><span>Valeur potentielle</span><strong>{euro(salePotential)}</strong></div>
        <div><span>Watchlist</span><strong>{watchRows.length}</strong></div>
        <div><span>Prix sous objectif</span><strong>{opportunities}</strong></div>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:'18px'}}>
        <section className="panel">
          <h2>♻️ Mes doublons à vendre</h2>
          <p className="muted">PokéValeur conserve par défaut 1 exemplaire de chaque référence et considère le surplus comme doublon potentiel.</p>
          {duplicateGroups.length === 0 ? (
            <p>Aucun doublon détecté pour le moment.</p>
          ) : (
            <div className="productList">
              {duplicateGroups.map((g,index) => (
                <article className="productCard" key={g.key}>
                  <div className="productMain">
                    <div>
                      <span className="catalogBadge">{index < 3 ? 'À regarder en priorité' : 'Doublon'}</span>
                      <h3>{g.name}</h3>
                      <p>{g.series || 'Série non renseignée'} • {g.quantity} possédé{g.quantity > 1 ? 's' : ''} • {g.sellable} en doublon</p>
                    </div>
                    <div className="productValues">
                      <b>{euro(g.currentValue)} / unité</b>
                      <span className={g.unitGain >= 0 ? 'gain' : 'loss'}>
                        {g.unitGain >= 0 ? '+' : ''}{euro(g.unitGain)} vs achat moyen
                      </span>
                    </div>
                  </div>
                  <div className="marketStats">
                    <div><span>Achat moyen</span><strong>{euro(g.avgBuy)}</strong></div>
                    <div><span>À conserver</span><strong>1</strong></div>
                    <div><span>À vendre</span><strong>{g.sellable}</strong></div>
                    <div><span>Valeur doublons</span><strong>{euro(g.estimatedSaleValue)}</strong></div>
                  </div>
                  {g.rows[0]?.id && <div className="rowActions"><a className="miniBtn" href={`/collection/${g.rows[0].id}`}>Voir mes exemplaires</a></div>}
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
              <input value={query} onChange={e => { setQuery(e.target.value); setSelectedProduct(null) }} placeholder="Ex. ETB Évolution Céleste" />
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

            {selectedProduct && <div className="message">✓ {selectedProduct.name}</div>}

            <label>
              Prix objectif (€)
              <input type="number" min="0" step="0.01" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="Ex. 60" />
            </label>

            <label>
              Note facultative
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex. seulement en français / scellé propre" />
            </label>

            <button className="btn" type="submit" disabled={!selectedProduct}>Ajouter à ma watchlist</button>
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
                    <b>{euro(w.market)}</b>
                    {w.target != null && <small className="muted">Objectif : {euro(w.target)}</small>}
                  </div>
                </div>

                <div className="marketStats">
                  <div><span>Cote actuelle</span><strong>{euro(w.market)}</strong></div>
                  <div><span>Plus bas 30 j</span><strong>{euro(w.low30)}</strong></div>
                  <div><span>Médiane 90 j</span><strong>{euro(w.median90)}</strong></div>
                  <div><span>Ventes 90 j</span><strong>{w.sales90}</strong></div>
                </div>

                <div className="rowActions">
                  <label style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span>Objectif</span>
                    <input
                      style={{width:'110px'}}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={w.target ?? ''}
                      onBlur={e => updateTarget(w.id,e.target.value)}
                    />
                  </label>
                  <a className="miniBtn" href={`/catalogue/${w.product_id}`}>Voir la fiche</a>
                  <button className="miniBtn dangerMini" type="button" onClick={() => removeWatch(w.id)}>Retirer</button>
                </div>
              </article>
            ))}
          </div>
        </section>
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
