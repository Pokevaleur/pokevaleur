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
  const [contents, setContents] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params?.id) load()
  }, [params?.id])

  async function load() {
    setLoading(true)

    const [{ data: productData }, { data: historyData }, { data: contentData }] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,series,category,product_type,release_date,release_period,official_source_url,current_value,price_source,price_source_url,price_updated_at,zero_defect_value,zero_defect_source,zero_defect_updated_at,image_url,image_source_url,image_credit,image_usage_status')
        .eq('id', params.id)
        .single(),
      supabase
        .from('product_price_history')
        .select('id,source,price,observed_at,condition_tier,observation_type')
        .eq('product_id', params.id)
        .order('observed_at', { ascending: true }),
      supabase
        .from('product_contents')
        .select('id,card_id,content_type,item_name,quantity,source_label,source_url,confidence')
        .eq('product_id', params.id)
        .order('content_type')
    ])

    const contentRows = contentData || []
    const linkedCardIds = [...new Set(contentRows.map(item => item.card_id).filter(Boolean))]
    let cardsById = {}
    if (linkedCardIds.length) {
      const { data: linkedCards } = await supabase.from('cards')
        .select('id,card_set_id,collector_number,card_name')
        .in('id', linkedCardIds)
      cardsById = Object.fromEntries((linkedCards || []).map(card => [card.id, card]))
    }

    const { data: { user: viewer } } = await supabase.auth.getUser()
    setUser(viewer || null)
    setProduct(productData || null)
    setHistory(historyData || [])
    setContents(contentRows.map(item => ({ ...item, card: cardsById[item.card_id] || null })))
    setLoading(false)
  }

  if (loading) {
    return <main><section className="panel"><p>Chargement...</p></section></main>
  }

  if (!product) {
    return <main><section className="panel"><h1>Produit introuvable</h1></section></main>
  }

  const confirmedSales = history.filter(item => (item.observation_type || 'confirmed_sale') === 'confirmed_sale')
  const observedListings = history.filter(item => item.observation_type === 'observed_listing')
  const standardHistory = confirmedSales.filter(item => (item.condition_tier || 'standard') === 'standard')
  const zeroDefectHistory = confirmedSales.filter(item => item.condition_tier === 'zero_defect')
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
        <div className="detailProductVisual">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="productVisualPlaceholder large">
              <span>PokéValeur</span>
              <b>Visuel produit à venir</b>
            </div>
          )}
        </div>

        <div className="detailProductIdentity">
          <span className="catalogBadge">
            {product.category === 'sealed' ? 'Scellé' : product.category}
          </span>
          <h1>{product.name}</h1>
          <a className="btn" href={`/collection?product=${encodeURIComponent(product.id)}`}>Ajouter à ma collection</a>
          <p className="muted">{product.series || 'Série non renseignée'}</p>
          <div className="detailReleaseDate">
            <span>Date de sortie officielle</span>
            <strong>
              {product.release_date
                ? new Date(product.release_date + 'T00:00:00').toLocaleDateString('fr-FR')
                : product.release_period || 'À renseigner'}
            </strong>
          </div>
          {product.image_url && product.image_credit && (
            <small className="imageCredit">Visuel : {product.image_credit}</small>
          )}
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

      {contents.length > 0 && (
        <section className="panel productContentsPanel">
          <h2>Contenu du coffret</h2>
          <div className="productContentsList">
            {contents.map(item => (
              <div key={item.id} className="productContentRow">
                <span>{item.quantity} × {item.item_name}</span>
                <small>{item.confidence === 'verified' ? 'Vérifié' : 'Déduit de la photo'}</small>
                {item.card?.card_set_id && (() => {
                  const checklistUrl = `/collection/cartes?set=${encodeURIComponent(item.card.card_set_id)}&card=${encodeURIComponent(item.card.collector_number)}`
                  const href = user ? checklistUrl : `/login?next=${encodeURIComponent(checklistUrl)}`
                  return <a className="detailLink" href={href}>Voir cette carte dans la checklist →</a>
                })()}
              </div>
            ))}
          </div>
        </section>
      )}

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
                  <span>
                    {sale.source}
                    {sale.condition_tier === 'zero_defect' ? ' • zéro défaut' : ''}
                    {sale.observation_type === 'observed_listing' ? ' • annonce observée' : ' • vente confirmée'}
                  </span>
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

      {observedListings.length > 0 && (
        <section className="panel listingPanel">
          <h2>Prix observés sur les annonces</h2>
          <p className="muted">
            Ces montants donnent une indication du marché demandé, mais ne sont pas utilisés pour calculer la cote tant que la vente n’est pas confirmée.
          </p>
          <div className="listingRows">
            {[...observedListings].reverse().map(item => (
              <div key={item.id}>
                <span>{new Date(item.observed_at).toLocaleDateString('fr-FR')} • {item.source}</span>
                <strong>{Number(item.price).toFixed(2)} €</strong>
              </div>
            ))}
          </div>
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
        <h2>Sources</h2>
        {product.official_source_url && (
          <p><a className="detailLink" href={product.official_source_url} target="_blank" rel="noreferrer">Voir la source officielle du produit →</a></p>
        )}
        <h3>Source de la cote</h3>
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
