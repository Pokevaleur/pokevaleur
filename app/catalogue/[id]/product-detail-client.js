'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './product-detail-client.module.css'

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export default function ProductDetailClient({ product }) {
  const supabase = useMemo(() => createClient(), [])
  const [history, setHistory] = useState([])
  const [contents, setContents] = useState([])
  const [boosterArtworks, setBoosterArtworks] = useState([])

  function handleCatalogBack(event) {
    event.preventDefault()
    const returnTo = new URLSearchParams(window.location.search).get('returnTo')
    let safeReturnTo = '/catalogue'
    if (returnTo) {
      try {
        const candidate = new URL(returnTo, window.location.origin)
        if (candidate.origin === window.location.origin && candidate.pathname === '/catalogue') {
          safeReturnTo = candidate.pathname + candidate.search + candidate.hash
        }
      } catch {
        // Keep the catalogue fallback for malformed return paths.
      }
    }

    try {
      const referrer = document.referrer ? new URL(document.referrer) : null
      if (referrer?.origin === window.location.origin && window.history.length > 1) {
        window.history.back()
        return
      }
    } catch {
      // If the referrer cannot be parsed, use the safe catalogue destination.
    }

    window.location.assign(safeReturnTo)
  }

  useEffect(() => {
    let active = true
    async function loadMarketData() {
      const [{ data: historyData }, { data: contentData }] = await Promise.all([
        supabase
          .from('product_price_history')
          .select('id,source,price,observed_at,condition_tier,observation_type')
          .eq('product_id', product.id)
          .order('observed_at', { ascending: true }),
        supabase
          .from('product_contents')
          .select('id,content_type,item_name,quantity,source_label,source_url,confidence,content_role')
          .eq('product_id', product.id)
          .order('content_type')
          .order('item_name', { ascending: true })
      ])
      if (!active) return
      setHistory(historyData || [])
      setContents(contentData || [])

      if (product.product_type === 'Artset' && product.series) {
        const { data: artworkData } = await supabase
          .from('products')
          .select('id,name,booster_artwork,image_url,image_credit')
          .eq('is_public', true)
          .eq('series', product.series)
          .eq('product_type', 'Booster loose')
          .not('booster_artwork', 'is', null)
          .not('image_url', 'is', null)
          .order('booster_artwork', { ascending: true })
        if (!active) return
        setBoosterArtworks(artworkData || [])
      } else {
        setBoosterArtworks([])
      }
    }
    loadMarketData()
    return () => { active = false }
  }, [product.id, supabase])

  const guaranteedContents = contents.filter(item => (item.content_role || 'guaranteed') === 'guaranteed')
  const possibleContents = contents.filter(item => item.content_role === 'possible')

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

  const latestStandardSale = standardHistory[standardHistory.length - 1] || null
  const hasReferenceValue = product.current_value !== null && product.current_value !== undefined
  const observedMedian = stats?.count >= 2 ? stats.median : null
  const showZeroDefectValue = product.category === 'sealed' &&
    product.zero_defect_value !== null && product.zero_defect_value !== undefined

  let priceSummary
  if (observedMedian !== null) {
    priceSummary = {
      label: 'Prix observé PokéValeur',
      value: `${observedMedian.toFixed(2)} €`,
      detail: `Médiane de ${stats.count} ventes confirmées enregistrées.`,
      source: latestStandardSale
        ? `Dernière vente : ${new Date(latestStandardSale.observed_at).toLocaleDateString('fr-FR')} • ${latestStandardSale.source}`
        : ''
    }
  } else if (latestStandardSale) {
    priceSummary = {
      label: 'Dernière vente observée',
      value: `${Number(latestStandardSale.price).toFixed(2)} €`,
      detail: `Une seule vente confirmée enregistrée, le ${new Date(latestStandardSale.observed_at).toLocaleDateString('fr-FR')} : ce montant reste indicatif.`,
      source: latestStandardSale.source
    }
  } else if (hasReferenceValue) {
    priceSummary = {
      label: 'Valeur de référence',
      value: `${Number(product.current_value).toFixed(2)} €`,
      detail: product.price_source
        ? `Source : ${product.price_source}`
        : 'Source de prix non renseignée.',
      source: product.price_updated_at
        ? `Mise à jour le ${new Date(product.price_updated_at).toLocaleDateString('fr-FR')}`
        : ''
    }
  } else {
    priceSummary = {
      label: 'Prix observé PokéValeur',
      value: 'Aucun prix disponible',
      detail: observedListings.length
        ? `Aucune vente confirmée enregistrée. ${observedListings.length} prix d’annonce observé(s) sont consultables plus bas.`
        : 'Aucune vente confirmée ni valeur de référence enregistrée pour le moment.',
      source: ''
    }
  }

  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const spread = Math.max(maxPrice - minPrice, 1)

  return (
    <main>
      <a href="/catalogue" className="backLink" onClick={handleCatalogBack}>← Retour au catalogue</a>

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
          <div className={styles.priceSummary}>
            <div className={styles.priceSummaryHeading}>
              <span>{priceSummary.label}</span>
              {stats?.count > 1 && <small>{stats.count} ventes</small>}
            </div>
            <strong className={priceSummary.value === 'Aucun prix disponible' ? styles.noPriceValue : ''}>
              {priceSummary.value}
            </strong>
            <p>{priceSummary.detail}</p>
            {priceSummary.source && <small>{priceSummary.source}</small>}
            {showZeroDefectValue && (
              <div className={styles.zeroDefectPrice}>
                <span>Scellé zéro défaut</span>
                <strong>{Number(product.zero_defect_value).toFixed(2)} €</strong>
              </div>
            )}
          </div>
          <a className="btn" href={`/collection?product=${encodeURIComponent(product.id)}`}>Ajouter à Ma Collection</a>
          <a className="detailLink catalogueCollectionLink" href="/collection">Voir mes exemplaires →</a>
          <p className="muted">{product.series || 'Série non renseignée'}</p>
          <div className="detailReleaseDate">
            <span>Date de sortie officielle</span>
            <strong>
              {product.release_date
                ? new Date(product.release_date + 'T00:00:00').toLocaleDateString('fr-FR')
                : product.release_period || 'À renseigner'}
            </strong>
          </div>
          {product.case_reference && <div className="detailReleaseDate">
            <span>Référence / code-barres</span>
            <strong>{product.case_reference}</strong>
          </div>}
          {product.case_packaging_note && <div className="detailReleaseDate">
            <span>Composition de la display</span>
            <strong>{product.case_packaging_note}</strong>
          </div>}
          {product.image_url && product.image_credit && (
            <small className="imageCredit">Visuel : {product.image_credit}</small>
          )}
        </div>

      </section>

      {product.product_type === 'Artset' && boosterArtworks.length > 0 && (
        <section className={`panel ${styles.boosterArtworkPanel}`}>
          <h2>Illustrations des boosters loose de cette série</h2>
          <p className="muted">Chaque visuel ouvre la fiche individuelle du booster correspondant.</p>
          <div className={styles.boosterArtworkGrid}>
            {boosterArtworks.map(artwork => (
              <a className={styles.boosterArtworkCard} href={`/catalogue/${encodeURIComponent(artwork.id)}`} key={artwork.id}>
                <img src={artwork.image_url} alt={artwork.name} loading="lazy" decoding="async" />
                <strong>{artwork.booster_artwork}</strong>
                {artwork.image_credit && <small>Visuel : {artwork.image_credit}</small>}
              </a>
            ))}
          </div>
        </section>
      )}

      {guaranteedContents.length > 0 && (
        <section className="panel productContentsPanel">
          <h2>Contenu du produit de référence</h2>
          <p className="muted">Ce contenu décrit le produit générique. Le contenu réellement possédé se suit séparément dans Ma Collection.</p>
          <div className="productContentsList">
            {guaranteedContents.map(item => (
              <div key={item.id} className="productContentRow">
                <span>{item.quantity > 1 ? `${item.quantity} × ` : ''}{item.item_name}</span>
                <small>{item.confidence === 'verified' ? 'Vérifié' : 'Déduit de la photo'}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {possibleContents.length > 0 && (
        <section className="panel productContentsPanel">
          <h2>Cartes pouvant apparaître</h2>
          <p className="muted">Le pack contient 6 cartes tirées au hasard parmi cette sélection. Les cartes listées ne sont pas toutes présentes dans chaque pack.</p>
          {possibleContents[0]?.source_url && (
            <p><a className="detailLink" href={possibleContents[0].source_url} target="_blank" rel="noreferrer">Consulter la checklist source →</a></p>
          )}
          <details className="possibleContentsDetails">
            <summary>Afficher les {possibleContents.length} cartes recensées</summary>
            <div className="productContentsList">
              {possibleContents.map(item => (
                <div key={item.id} className="productContentRow">
                  <span>{item.quantity > 1 ? `${item.quantity} × ` : ''}{item.item_name}</span>
                  <small>{item.confidence === 'verified' ? 'Vérifié' : 'Déduit de la photo'}</small>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {confirmedSales.length > 0 ? (
        <details className={styles.marketHistory}>
          <summary>Voir l’historique des prix ({history.length})</summary>
          {stats && stats.count > 1 && (
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
                  {standardHistory.map(sale => {
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
            </>
          )}

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
        </details>
      ) : (
        <section className="panel">
          <p>Aucune vente confirmée n’a encore été enregistrée pour ce produit.</p>
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

      {product.category === 'sealed' && zeroDefectStats && (
        <section className="panel conditionInfo">
          <h2>Cote “zéro défaut”</h2>
          <p>
            Cette cote concerne uniquement les produits scellés dont l’état est explicitement documenté comme impeccable :
            film propre, boîte non enfoncée, angles et arêtes nets, sans déchirure ni défaut notable.
          </p>
          <p className="muted">
            {`${zeroDefectStats.count} vente(s) qualifiée(s), médiane ${zeroDefectStats.median.toFixed(2)} €.`}
          </p>
        </section>
      )}

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
.priceSummary {
  margin: 14px 0 16px;
  padding: 14px 16px;
  border: 1px solid #f1dfaa;
  border-radius: 14px;
  background: #fff9e8;
}

.priceSummaryHeading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #795800;
  font-size: .85rem;
  font-weight: 800;
}

.priceSummaryHeading small {
  flex: 0 0 auto;
  color: #65758b;
  font-size: .72rem;
  font-weight: 700;
}

.priceSummary > strong {
  display: block;
  margin-top: 5px;
  color: #122033;
  font-size: clamp(1.45rem, 4vw, 1.9rem);
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.priceSummary > .noPriceValue {
  font-size: 1.15rem;
}

.priceSummary p {
  margin: 5px 0 0;
  color: #4f5e72;
  font-size: .83rem;
  line-height: 1.4;
}

.priceSummary > small {
  display: block;
  margin-top: 5px;
  color: #65758b;
  font-size: .75rem;
  line-height: 1.4;
}

.zeroDefectPrice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 11px;
  padding-top: 10px;
  border-top: 1px solid #f1dfaa;
  color: #476b58;
  font-size: .8rem;
}

.zeroDefectPrice strong {
  color: #0a8056;
  font-size: 1rem;
}

.marketHistory {
  margin: 18px 0;
  padding: 0 18px 18px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .05);
}

.marketHistory > summary {
  padding: 17px 0;
  color: var(--navy);
  font-weight: 800;
  cursor: pointer;
}

.marketHistory[open] > summary {
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.marketHistory > .panel {
  margin-top: 12px;
  padding: 14px 0 0;
  border-radius: 0;
  box-shadow: none;
}

.marketHistory > .detailStats {
  margin-top: 12px;
}

@media (max-width: 600px) {
  .priceSummary {
    padding: 12px 13px;
  }

  .marketHistory {
    padding: 0 13px 13px;
  }
}

