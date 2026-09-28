'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export default function CataloguePage() {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [query, setQuery] = useState('')
  const [user, setUser] = useState(null)
  const [suggestion, setSuggestion] = useState({ name:'', series:'', category:'sealed', notes:'' })
  const [suggestionMessage, setSuggestionMessage] = useState('')

  useEffect(() => {
    loadProducts()
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  async function submitSuggestion(e) {
    e.preventDefault()
    if (!user) {
      setSuggestionMessage('Connecte-toi pour proposer un produit.')
      return
    }

    const { error } = await supabase.from('product_suggestions').insert({
      user_id: user.id,
      name: suggestion.name.trim(),
      series: suggestion.series.trim() || null,
      category: suggestion.category,
      notes: suggestion.notes.trim() || null
    })

    if (error) {
      setSuggestionMessage(error.message)
      return
    }

    setSuggestion({ name:'', series:'', category:'sealed', notes:'' })
    setSuggestionMessage('Merci, ta proposition a bien été enregistrée.')
  }

  async function loadProducts() {
    const [{ data: productData }, { data: historyData }] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,series,category,product_type,release_date,release_period,current_value,price_source,price_source_url,price_updated_at,zero_defect_value,zero_defect_source,zero_defect_updated_at,image_url,image_source_url,image_credit,image_usage_status')
        .eq('is_public', true)
        .order('name'),
      supabase
        .from('product_price_history')
        .select('id,product_id,source,price,observed_at,condition_tier,observation_type')
        .order('observed_at', { ascending: true })
    ])

    setProducts(productData || [])
    setHistory(historyData || [])
  }

  const filtered = products.filter(product => {
    const normalizedQuery = query
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (!normalizedQuery) return true

    const aliases = {
      etb: ['coffret dresseur elite', 'elite trainer box', 'etb'],
      'elite trainer box': ['coffret dresseur elite', 'etb'],
      'coffret dresseur': ['coffret dresseur elite', 'etb'],
      display: ['display', 'boite de boosters', 'booster box', 'display 36 boosters', 'demi-display 18 boosters'],
      'booster box': ['display', 'boite de boosters', 'display 36 boosters'],
      'demi display': ['demi-display', 'demi display', '18 boosters', 'booster box 18 boosters'],
      'demie display': ['demi-display', 'demi display', '18 boosters', 'booster box 18 boosters'],
      'half display': ['demi-display', '18 boosters', 'booster box 18 boosters'],
      bundle: ['booster bundle', 'lot de 6 boosters', 'bundle'],
      'booster bundle': ['lot de 6 boosters', 'bundle'],
      tripack: ['tripack', 'tripack blister', 'blister 3 boosters', '3 boosters'],
      blister: ['blister', 'tripack'],
      pokebox: ['pokebox', 'poke box', 'tin', 'boite'],
      tin: ['tin', 'pokebox', 'poke box', 'boite'],
      minitin: ['mini tin', 'mini-boite', 'mini boite'],
      'mini tin': ['mini tin', 'mini-boite', 'mini boite'],
      upc: ['ultra-premium collection', 'collection ultra-premium', 'upc'],
      'ultra premium': ['ultra-premium collection', 'collection ultra-premium', 'upc'],
      valisette: ['valisette', 'coffre de collection', 'collector chest'],
      coffre: ['coffre de collection', 'valisette', 'collector chest'],
      'pin box': ['collection pins', 'collection pin', 'coffret pins', 'pin box'],
      'pins box': ['collection pins', 'collection pin', 'coffret pins', 'pin box'],
      coffret: ['coffret', 'collection'],
      premium: ['collection premium', 'premium'],
      poster: ['collection poster', 'poster'],
      classeur: ['collection classeur', 'classeur', 'binder collection'],
      binder: ['collection classeur', 'classeur', 'binder collection']
    }

    const expandedTerms = new Set([normalizedQuery])
    Object.entries(aliases).forEach(([alias, terms]) => {
      if (normalizedQuery.includes(alias) || alias.includes(normalizedQuery)) {
        terms.forEach(term => expandedTerms.add(term))
      }
    })

    const haystack = [
      product.name,
      product.series,
      product.category,
      product.product_type
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return [...expandedTerms].some(term =>
      haystack.includes(
        term.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      )
    )
  })

  function getStats(productId, tier = 'standard') {
    const sales = history.filter(item =>
      item.product_id === productId &&
      (item.condition_tier || 'standard') === tier &&
      (item.observation_type || 'confirmed_sale') === 'confirmed_sale'
    )
    const prices = sales.map(item => Number(item.price)).filter(Number.isFinite)

    if (!prices.length) return null

    return {
      count: prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      median: median(prices),
      latest: sales[sales.length - 1],
      sales
    }
  }

  return (
    <main>
      <section className="catalogHero">
        <span className="eyebrow dark">Catalogue PokéValeur</span>
        <h1>Retrouve rapidement un produit</h1>
        <p className="muted">
          Les valeurs sont basées sur des observations enregistrées avec leur source et leur date.
          PokéValeur distingue toujours le prix d’achat personnel de la valeur de référence du marché.
        </p>
        <input
          className="catalogSearch"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un produit ou une série..."
        />
      </section>

      <section className="catalogGrid">
        {filtered.map(product => {
          const stats = getStats(product.id, 'standard')
          const zeroDefectStats = getStats(product.id, 'zero_defect')
          const observedListings = history.filter(item =>
            item.product_id === product.id &&
            item.observation_type === 'observed_listing'
          )

          return (
            <article className="catalogCard" key={product.id}>
              <div className="productVisual">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} loading="lazy" />
                ) : (
                  <div className="productVisualPlaceholder">
                    <span>PokéValeur</span>
                    <b>{product.category === 'sealed' ? 'Produit scellé' : 'Visuel à venir'}</b>
                  </div>
                )}
              </div>

              <span className="catalogBadge">
                {product.category === 'sealed' ? 'Scellé' : product.category}
              </span>

              <h2>{product.name}</h2>
              <p>{product.series || 'Série non renseignée'}</p>
              <div className="releaseMeta">
                <span>Date de sortie officielle</span>
                <b>
                  {product.release_date
                    ? new Date(product.release_date + 'T00:00:00').toLocaleDateString('fr-FR')
                    : product.release_period || 'À renseigner'}
                </b>
              </div>

              <div className="catalogValue">
                <span>Marché standard</span>
                <strong>
                  {product.current_value !== null && product.current_value !== undefined
                    ? Number(product.current_value).toFixed(2) + ' €'
                    : 'À renseigner'}
                </strong>
              </div>

              <div className="zeroDefectValue">
                <span>Produit zéro défaut</span>
                <strong>
                  {product.zero_defect_value !== null && product.zero_defect_value !== undefined
                    ? Number(product.zero_defect_value).toFixed(2) + ' €'
                    : 'Pas assez de données'}
                </strong>
              </div>

              {stats ? (
                <>
                  <div className="marketStats">
                    <div>
                      <span>Ventes</span>
                      <strong>{stats.count}</strong>
                    </div>
                    <div>
                      <span>Minimum</span>
                      <strong>{stats.min.toFixed(2)} €</strong>
                    </div>
                    <div>
                      <span>Médiane</span>
                      <strong>{stats.median.toFixed(2)} €</strong>
                    </div>
                    <div>
                      <span>Maximum</span>
                      <strong>{stats.max.toFixed(2)} €</strong>
                    </div>
                  </div>

                  <div className="historyBlock">
                    <span className="historyTitle">Historique récent</span>
                    <div className="historyRows">
                      {stats.sales.slice(-5).reverse().map(sale => (
                        <div key={sale.id}>
                          <span>{new Date(sale.observed_at).toLocaleDateString('fr-FR')}</span>
                          <b>{Number(sale.price).toFixed(2)} €</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="noHistory">Pas encore d’historique de ventes enregistré.</div>
              )}

              {zeroDefectStats && (
                <div className="zeroDefectStats">
                  <span>{zeroDefectStats.count} vente{zeroDefectStats.count > 1 ? 's' : ''} zéro défaut confirmée{zeroDefectStats.count > 1 ? 's' : ''}</span>
                  <b>Médiane {zeroDefectStats.median.toFixed(2)} €</b>
                </div>
              )}

              {observedListings.length > 0 && (
                <div className="listingHint">
                  {observedListings.length} prix observé{observedListings.length > 1 ? 's' : ''} sur des annonces — non inclus dans la cote
                </div>
              )}

              <div className="priceMeta">
                <span>Source : {product.price_source || 'non renseignée'}</span>
                <span>
                  Mise à jour : {product.price_updated_at
                    ? new Date(product.price_updated_at).toLocaleDateString('fr-FR')
                    : 'non renseignée'}
                </span>
              </div>

              <a className="detailLink" href={`/catalogue/${product.id}`}>
                Voir la fiche détaillée →
              </a>
            </article>
          )
        })}
      </section>

      {filtered.length === 0 && (
        <section className="panel narrow">
          <p>Aucun produit trouvé pour cette recherche.</p>
        </section>
      )}

      <section className="panel suggestionPanel">
        <h2>Produit absent du catalogue ?</h2>
        <p className="muted">
          Les membres connectés peuvent proposer une référence à ajouter.
        </p>

        {user ? (
          <form className="suggestionForm" onSubmit={submitSuggestion}>
            <label>
              Nom du produit
              <input
                required
                value={suggestion.name}
                onChange={e => setSuggestion({ ...suggestion, name:e.target.value })}
                placeholder="Ex. Coffret Nymphali 30 ans"
              />
            </label>

            <label>
              Série / extension
              <input
                value={suggestion.series}
                onChange={e => setSuggestion({ ...suggestion, series:e.target.value })}
                placeholder="Facultatif"
              />
            </label>

            <label>
              Type
              <select
                value={suggestion.category}
                onChange={e => setSuggestion({ ...suggestion, category:e.target.value })}
              >
                <option value="sealed">Produit scellé</option>
                <option value="card">Carte</option>
                <option value="accessory">Accessoire</option>
                <option value="other">Autre</option>
              </select>
            </label>

            <label>
              Précisions
              <input
                value={suggestion.notes}
                onChange={e => setSuggestion({ ...suggestion, notes:e.target.value })}
                placeholder="Langue, édition, format..."
              />
            </label>

            <button className="btn" type="submit">Proposer ce produit</button>
          </form>
        ) : (
          <a className="btn" href="/login">Se connecter pour proposer</a>
        )}

        {suggestionMessage && <p className="message">{suggestionMessage}</p>}
      </section>

      <section className="panel pricePolicy">
        <h2>Lecture des prix</h2>
        <p>
          La cote est calculée uniquement à partir de ventes confirmées. Les prix vus sur des annonces Voggt,
          Whatnot, Vinted ou ailleurs peuvent être enregistrés comme indices de marché, mais ils ne sont jamais
          mélangés aux ventes réellement conclues.
        </p>
      </section>
    </main>
  )
}
