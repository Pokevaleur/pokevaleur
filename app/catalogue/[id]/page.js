'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export default function ProductDetailPage() {
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])
  const [product, setProduct] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params?.id) load()
  }, [params?.id])

  async function load() {
    setLoading(true)

    const [{ data: productData }, { data: historyData }] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,series,category,current_value,price_source,price_source_url,price_updated_at,zero_defect_value,zero_defect_source,zero_defect_updated_at')
        .eq('id', params.id)
        .single(),
      supabase
        .from('product_price_history')
        .select('id,source,price,observed_at,condition_tier')
        .eq('product_id', params.id)
        .order('observed_at', { ascending: true })
    ])

    setProduct(productData || null)
    setHistory(historyData || [])
    setLoading(false)
  }

  if (loading) {
    return <main><section className="panel"><p>Chargement...</p></section></main>
  }

  if (!product) {
    return <main><section className="panel"><h1>Produit introuvable</h1></section></main>
  }

  const standardHistory = history.filter(item => (item.condition_tier || 'standard') === 'standard')
  const zeroDefectHistory = history.filter(item => item.condition_tier === 'zero_defect')
  const prices = standardHistory.map(item => Number(item.price)).filter(Number.isFinite)
  const zeroDefectPrices = zeroDefectHistory.map(item => Number(item.price)).filter(Number.isFinite)
  const stats = prices.length ? {
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    median: median(prices)
  } : null

  const zeroDefectStats = zeroDefectPrices.length ? {
    count: zeroDefectPrices.length,
    min: Math.min(...zeroDefectPrices),
    max: Math.max(...zeroDefectPrices),
    median: median(zeroDefectPrices)
  } : null

  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const spread = Math.max(maxPrice - minPrice, 1)

  return (
    <main>
      <a href="/catalogue" className="backLink">← Retour au catalogue</a>

      <section className="productDetailHero">
        <div>
          <span className="catalogBadge">
            {product.category === 'sealed' ? 'Scellé' : product.category}
          </span>
          <h1>{product.name}</h1>
          <p className="muted">{product.series || 'Série non renseignée'}</p>
        </div>

        <div className="referenceValue">
          <span>Marché standard</span>
          <strong>
            {product.current_value !== null && product.current_value !== undefined
              ? Number(product.current_value).toFixed(2) + ' €'
              : 'À renseigner'}
          </strong>
          <div className="zeroDefectHeroValue">
            <span>Zéro défaut</span>
            <b>{product.zero_defect_value !== null && product.zero_defect_value !== undefined
              ? Number(product.zero_defect_value).toFixed(2) + ' €'
              : 'Pas assez de données'}</b>
          </div>
        </div>
      </section>

      {stats ? (
        <>
          <section className="detailStats">
            <div><span>Ventes observées</span><strong>{stats.count}</strong></div>
            <div><span>Minimum</span><strong>{stats.min.toFixed(2)} €</strong></div>
            <div><span>Médiane</span><strong>{stats.median.toFixed(2)} €</strong></div>
            <div><span>Maximum</span><strong>{stats.max.toFixed(2)} €</strong></div>
          </section>

          <section className="panel chartPanel">
            <div className="chartHeader">
              <div>
                <h2>Évolution des ventes</h2>
                <p className="muted">Chaque point représente une vente enregistrée.</p>
              </div>
            </div>

            <div className="priceChart">
              {standardHistory.map((sale, index) => {
                const price = Number(sale.price)
                const height = 22 + ((price - minPrice) / spread) * 78
                return (
                  <div className="chartColumn" key={sale.id} title={price.toFixed(2) + ' €'}>
                    <div className="chartBar" style={{ height: height + '%' }}>
                      <span>{price.toFixed(0)} €</span>
                    </div>
                    <small>{new Date(sale.observed_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })}</small>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel">
            <h2>Historique complet</h2>
            <div className="saleTable">
              <div className="saleTableHead">
                <span>Date</span>
                <span>Source</span>
                <span>Prix</span>
              </div>
              {[...history].reverse().map(sale => (
                <div className="saleTableRow" key={sale.id}>
                  <span>{new Date(sale.observed_at).toLocaleDateString('fr-FR')}</span>
                  <span>{sale.source}{sale.condition_tier === 'zero_defect' ? ' • zéro défaut' : ''}</span>
                  <strong>{Number(sale.price).toFixed(2)} €</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <p>Pas encore de ventes enregistrées pour ce produit.</p>
        </section>
      )}

      <section className="panel conditionInfo">
        <h2>Cote “zéro défaut”</h2>
        <p>
          Cette cote concerne uniquement les produits scellés dont l’état est explicitement documenté comme impeccable :
          film propre, boîte non enfoncée, angles et arêtes nets, sans déchirure ni défaut notable.
        </p>
        <p className="muted">
          {zeroDefectStats
            ? `${zeroDefectStats.count} vente(s) qualifiée(s), médiane ${zeroDefectStats.median.toFixed(2)} €.`
            : 'Aucune vente suffisamment documentée n’est encore classée zéro défaut pour ce produit.'}
        </p>
      </section>

      <section className="panel sourcePanel">
        <h2>Source de la cote</h2>
        <p>
          {product.price_source || 'Aucune source de prix renseignée pour le moment.'}
        </p>
        <p className="muted">
          Dernière mise à jour : {product.price_updated_at
            ? new Date(product.price_updated_at).toLocaleDateString('fr-FR')
            : 'non renseignée'}
        </p>
      </section>
    </main>
  )
}
