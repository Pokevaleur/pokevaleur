'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './product-detail-client.module.css'

function packStampVariant(card, seriesNumber) {
  const variants = (card?.card_print_variants || []).filter(variant => variant.image_url)
  const isPlayStamp = variant => /play|reward/i.test((variant.variant_key || '') + ' ' + (variant.variant_label || ''))
  const exact = variants.filter(variant => {
    const key = String(variant.variant_key || '').toLowerCase()
    if (!isPlayStamp(variant)) return false
    if (seriesNumber === 9) return key.includes('s9')
    if (seriesNumber === 7) return key.includes('series_7')
    if (seriesNumber === 6) return key.includes('prize_pack_6')
    if (seriesNumber === 4) return key.includes('series_4')
    return key.includes('series_' + seriesNumber) || key.includes('_s' + seriesNumber)
  })
  if (exact.length) return exact[0]
  if (![7, 8, 9].includes(seriesNumber)) return null
  return variants.find(variant => {
    const key = String(variant.variant_key || '').toLowerCase()
    return isPlayStamp(variant) && /player_rewards_program|stamp_play_pokemon_(cosmos_ultra|non_holo)/.test(key)
      && !/series_\d|_s\d/.test(key)
  }) || null
}

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
  const [cardsById, setCardsById] = useState({})
  const [boosterArtworks, setBoosterArtworks] = useState([])
  const packSeriesNumber = Number(String(product.name || '').match(/Série\s+(\d+)/i)?.[1]) || 0

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
          .select('id,content_type,item_name,quantity,card_id,source_label,source_url,confidence,content_role')
          .eq('product_id', product.id)
          .order('content_type')
          .order('item_name', { ascending: true })
      ])
      const cardIds = [...new Set((contentData || [])
        .filter(item => item.content_role === 'possible' && item.card_id)
        .map(item => item.card_id))]
      let cardData = []
      if (cardIds.length) {
        const { data } = await supabase
          .from('cards')
          .select('id,card_name,collector_number,image_url,card_print_variants(id,variant_key,variant_label,finish_code,image_url,image_source_url)')
          .in('id', cardIds)
        cardData = data || []
      }

      if (!active) return
      setHistory(historyData || [])
      setContents(contentData || [])
      setCardsById(Object.fromEntries(cardData.map(card => [card.id, card])))

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
  const uniquePossibleContents = [...new Map(possibleContents.map(item => [
    item.card_id || item.item_name.trim().toLocaleLowerCase('fr'), item
  ])).values()]

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
            <summary>Voir les {uniquePossibleContents.length} cartes en images</summary>
            <div className={styles.possibleCardGrid}>
              {uniquePossibleContents.map(item => {
                const card = item.card_id ? cardsById[item.card_id] : null
                const imageLabel = card?.card_name || item.item_name
                const stampedVariant = card ? packStampVariant(card, packSeriesNumber) : null
                const stampedContent = /estampille Play! Pokémon/i.test(item.item_name || '')
                const cardImageUrl = stampedVariant?.image_url || card?.image_url
                return (
                  <figure
                    key={item.card_id || item.item_name.trim().toLocaleLowerCase('fr')}
                    className={styles.possibleCard}
                  >
                    {cardImageUrl ? (
                      <img src={cardImageUrl} alt={stampedVariant ? imageLabel + ' avec estampille Play! Pokémon' : imageLabel} loading="lazy" decoding="async" />
                    ) : (
                      <div className={styles.possibleCardPlaceholder} role="img" aria-label={imageLabel}>
                        Visuel indisponible
                      </div>
                    )}
                    <figcaption>
                      <strong>{imageLabel}</strong>
                      {card?.collector_number && <span>N° {card.collector_number}</span>}
                      <small>{stampedVariant ? 'Visuel estampillé Play! Pokémon' : stampedContent ? 'Visuel standard · image estampillée indisponible' : item.confidence === 'verified' ? 'Vérifié' : 'Déduit de la photo'}</small>
                    </figcaption>
                  </figure>
                )
              })}
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
