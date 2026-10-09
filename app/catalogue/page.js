'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { fetchAllRows } from '../../lib/supabase-pagination'
import { createProductMatcher, normalizeSearch } from '../../lib/product-search.mjs'

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [user, setUser] = useState(null)
  const [suggestion, setSuggestion] = useState({ name:'', series:'', category:'sealed', notes:'' })
  const [suggestionMessage, setSuggestionMessage] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)

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
    const initialSearch = new URLSearchParams(window.location.search).get('search')
    if (initialSearch) setQuery(initialSearch)
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
    setLoading(true)
    setLoadError('')
    const [{ data: productData, error: productError }, { data: historyData }] = await Promise.all([
      fetchAllRows(() => supabase
        .from('products')
        .select('id,name,series,category,product_type,release_date,release_period,current_value,price_source,price_source_url,price_updated_at,zero_defect_value,zero_defect_source,zero_defect_updated_at,image_url,image_source_url,image_credit,image_usage_status')
        .eq('is_public', true)
        .order('name').order('id')),
      supabase
        .from('product_price_history')
        .select('id,product_id,source,price,observed_at,condition_tier,observation_type')
        .order('observed_at', { ascending: true })
    ])

    if (productError) setLoadError('Le catalogue ne peut pas être chargé pour le moment.')
    setLoading(false)
    setProducts(productData || [])
    setHistory(historyData || [])
  }

  const hasSearch = Boolean(normalizeSearch(query))
  const filtered = useMemo(() => hasSearch ? products.filter(createProductMatcher(query)) : [], [products, query, hasSearch])

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
    <main className="catalogPage">
      <section className={hasSearch ? 'catalogHero hasSearch' : 'catalogHero'}>
        <span className="eyebrow dark">Catalogue</span>
        <h1>
          {hasSearch
            ? <>Résultats pour <span className="catalogQuery">{query}</span></>
            : 'Retrouve un produit et ajoute-le à ta collection'}
        </h1>

        <div className="catalogCount" aria-live="polite">
          <strong>{loading ? '…' : loadError ? '—' : hasSearch ? filtered.length : products.length}</strong>
          <span>
            {loading
              ? (hasSearch ? 'recherche en cours' : 'produits référencés')
              : hasSearch
                ? 'résultat' + (filtered.length > 1 ? 's trouvés' : ' trouvé')
                : 'produit' + (products.length > 1 ? 's référencés' : ' référencé')}
          </span>
        </div>

        <div className="catalogSearchArea">
          <div className="voiceSearchWrap">
            <span className="catalogSearchIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 5 5" />
              </svg>
            </span>
            <input
              id="catalog-search"
              className="catalogSearch"
              type="search"
              aria-label="Rechercher un produit ou une série"
              aria-describedby={!hasSearch ? "catalog-search-help" : undefined}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un produit"
            />
            <button
              type="button"
              className={voiceListening ? 'voiceSearchButton listening' : 'voiceSearchButton'}
              aria-label="Rechercher à la voix"
              title="Recherche vocale"
              onClick={() => startVoiceSearch(setQuery, setVoiceListening)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="9" y="2.5" width="6" height="12" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
              </svg>
            </button>
          </div>

          {!hasSearch && (
            <>
              <p id="catalog-search-help" className="catalogSearchHelp">
                Saisis un nom, une série ou un format. Exemples :
              </p>
              <div className="catalogQuickSearch" aria-label="Exemples de recherche">
                {['ETB', 'Display', 'Valisette', 'Coffret'].map(example => (
                  <button
                    type="button"
                    key={example}
                    className="catalogExample"
                    onClick={() => setQuery(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {!hasSearch && (
        <section className="catalogEmptyState" aria-live="polite">
          <span className="catalogCrystalIcon" aria-hidden="true">
            <svg viewBox="0 0 80 80" focusable="false">
              <path d="M25 8h30l15 20-28 44L10 28 25 8Z" fill="#edf7ff" stroke="#77b7ec" strokeWidth="2" strokeLinejoin="round" />
              <path d="m25 8 3 20H10L25 8Z" fill="#c5e4ff" />
              <path d="M25 8h30l-2 20H28L25 8Z" fill="#fff" />
              <path d="m55 8 15 20H53l2-20Z" fill="#a8d4f7" />
              <path d="M10 28h18l14 44L10 28Z" fill="#d9edff" />
              <path d="M28 28h25L42 72 28 28Z" fill="#a8d7fb" />
              <path d="M53 28h17L42 72l11-44Z" fill="#d4ebff" />
            </svg>
          </span>
          <div>
            <h2>Quel trésor recherches-tu ?</h2>
            <p>Les produits apparaîtront ici au fil de ta recherche.</p>
          </div>
        </section>
      )}

      {hasSearch && loading && <p className="catalogStatus" role="status">Chargement du catalogue…</p>}
      {loadError && (
        <section className="panel catalogError" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn" onClick={loadProducts}>Réessayer</button>
        </section>
      )}

      {hasSearch && !loading && !loadError && filtered.length > 0 && (
        <section className="catalogGrid" aria-label="Résultats de recherche">
          {filtered.map(product => {
            const stats = getStats(product.id, 'standard')
            const zeroDefectStats = getStats(product.id, 'zero_defect')
            const observedListings = history.filter(item =>
              item.product_id === product.id &&
              item.observation_type === 'observed_listing'
            )

            return (
              <article className="catalogCard catalogResultCard" key={product.id}>
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

                <div className="catalogResultContent">
                  <span className="catalogBadge">
                    {product.category === 'sealed' ? 'Scellé' : product.category}
                  </span>
                  <h2>{product.name}</h2>
                  <p className="catalogResultSeries">{product.series || 'Série non renseignée'}</p>
                  {product.release_date || product.release_period ? (
                    <p className="catalogRelease">
                      Sortie : {product.release_date
                        ? new Date(product.release_date + 'T00:00:00').toLocaleDateString('fr-FR')
                        : product.release_period}
                    </p>
                  ) : null}
                  <div className="catalogCardActions">
                    <a className="btn small" href={'/collection?product=' + encodeURIComponent(product.id)}>
                      Ajouter à ma collection
                    </a>
                    <a className="detailLink" href={'/catalogue/' + product.id}>
                      Voir la fiche
                    </a>
                  </div>
                </div>

                <details className="catalogMarketDetails">
                  <summary>Données de marché et historique</summary>
                  <div className="catalogMarketBody">
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
                          <div><span>Ventes</span><strong>{stats.count}</strong></div>
                          <div><span>Minimum</span><strong>{stats.min.toFixed(2)} €</strong></div>
                          <div><span>Médiane</span><strong>{stats.median.toFixed(2)} €</strong></div>
                          <div><span>Maximum</span><strong>{stats.max.toFixed(2)} €</strong></div>
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
                        <span>
                          {zeroDefectStats.count} vente{zeroDefectStats.count > 1 ? 's' : ''} zéro défaut confirmée{zeroDefectStats.count > 1 ? 's' : ''}
                        </span>
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
                  </div>
                </details>
              </article>
            )
          })}
        </section>
      )}

      {hasSearch && !loading && !loadError && filtered.length === 0 && (
        <section className="catalogNoResults" role="status">
          <h2>Aucun produit trouvé pour « {query} ».</h2>
          <p>Essaie un autre nom, une série ou un format.</p>
          <button className="miniBtn" type="button" onClick={() => setQuery('')}>Effacer la recherche</button>
        </section>
      )}

      <details className="panel suggestionPanel catalogDisclosure" id="proposer-produit">
        <summary>
          <span><strong>Produit absent du catalogue ?</strong><small>Proposer une référence</small></span>
        </summary>
        <div className="catalogDisclosureBody">
          <p className="muted">Les membres connectés peuvent proposer une référence à ajouter.</p>
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
            <a className="btn" href="/login?next=%2Fcatalogue%23proposer-produit">
              Se connecter pour proposer
            </a>
          )}
          {suggestionMessage && <p className="message">{suggestionMessage}</p>}
        </div>
      </details>

      <details className="panel pricePolicy catalogDisclosure">
        <summary>Comment lire les valeurs ?</summary>
        <div className="catalogDisclosureBody">
          <p>
            La cote est calculée uniquement à partir de ventes confirmées. Les prix vus sur des annonces Voggt,
            Whatnot, Vinted ou ailleurs peuvent être enregistrés comme indices de marché, mais ils ne sont jamais
            mélangés aux ventes réellement conclues.
          </p>
        </div>
      </details>
    </main>
  )
}
