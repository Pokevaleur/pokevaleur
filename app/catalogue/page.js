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

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    const [{ data: productData }, { data: historyData }] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,series,category,current_value,price_source,price_source_url,price_updated_at,zero_defect_value,zero_defect_source,zero_defect_updated_at')
        .eq('is_public', true)
        .order('name'),
      supabase
        .from('product_price_history')
        .select('id,product_id,source,price,observed_at,condition_tier')
        .order('observed_at', { ascending: true })
    ])

    setProducts(productData || [])
    setHistory(historyData || [])
  }

  const filtered = products.filter(product => {
    const haystack = [product.name, product.series, product.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  function getStats(productId, tier = 'standard') {
    const sales = history.filter(item => item.product_id === productId && (item.condition_tier || 'standard') === tier)
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

          return (
            <article className="catalogCard" key={product.id}>
              <span className="catalogBadge">
                {product.category === 'sealed' ? 'Scellé' : product.category}
              </span>

              <h2>{product.name}</h2>
              <p>{product.series || 'Série non renseignée'}</p>

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
                  <span>{zeroDefectStats.count} vente{zeroDefectStats.count > 1 ? 's' : ''} zéro défaut observée{zeroDefectStats.count > 1 ? 's' : ''}</span>
                  <b>Médiane {zeroDefectStats.median.toFixed(2)} €</b>
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

      <section className="panel pricePolicy">
        <h2>Lecture des prix</h2>
        <p>
          La médiane est privilégiée car elle est moins sensible qu’une moyenne à une vente exceptionnellement
          basse ou élevée. Le nombre de ventes, le minimum, le maximum et les dernières observations permettent
          de voir rapidement si la référence repose sur suffisamment de données.
        </p>
      </section>
    </main>
  )
}
