'use client'

import { useState } from 'react'
import styles from './card-provenance.module.css'
import { EV09_PLAY_PROVENANCE } from '../../lib/ev09-play-provenance'

function productFor(entry) {
  return Array.isArray(entry.products) ? entry.products[0] : entry.products
}

function confidenceLabel(confidence) {
  if (confidence === 'verified') return 'Source vérifiée'
  if (confidence === 'photo_inferred') return 'Déduit d’une photo'
  if (confidence === 'set_inferred') return 'Déduit de la série de la carte'
  return 'Source à confirmer'
}

export default function CardProvenanceButton({ supabase, cardId, setCode = '', collectorNumber = '' }) {
  const normalizedSetCode = String(setCode || '').toUpperCase()
  const variantProvenance = ['SV09', 'EV09'].includes(normalizedSetCode)
    ? EV09_PLAY_PROVENANCE[collectorNumber] || []
    : []
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [entries, setEntries] = useState([])
  const [inferredBoosters, setInferredBoosters] = useState([])
  const [inferredBoosterSources, setInferredBoosterSources] = useState([])
  const [error, setError] = useState('')

  async function toggleProvenance() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (!nextOpen || status !== 'idle') return

    setStatus('loading')
    const { data, error: loadError } = await supabase
      .from('product_contents')
      .select('id,content_type,item_name,quantity,source_label,source_url,confidence,content_role,products(id,name,category,series)')
      .eq('card_id', cardId)
      .order('content_type')
      .order('item_name', { ascending: true })

    if (loadError) {
      setError('La provenance ne peut pas être chargée pour le moment.')
      setStatus('error')
      return
    }
    setEntries(data || [])

    // A card in a French expansion can also come from that expansion's boosters.
    // Keep this as an inferred, possible source and preserve specific catalog links.
    const { data: card } = await supabase
      .from('cards')
      .select('card_sets!cards_card_set_id_fkey(set_name,language)')
      .eq('id', cardId)
      .maybeSingle()
    const cardSet = Array.isArray(card?.card_sets) ? card.card_sets[0] : card?.card_sets
    if (cardSet?.language === 'FR' && cardSet.set_name) {
      const boosterSeriesName = String(cardSet.set_name).split(/[–—-]/).pop().trim()
      const [
        { data: boosterProducts },
        { data: containedBoosterRows },
        { data: expectedBoosterRows },
        { data: boosterBundleProducts }
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id,name,category,series,language,product_type,booster_artwork,image_url')
          .eq('category', 'sealed')
          .eq('product_type', 'Booster loose')
          .eq('language', 'FR')
          .eq('is_public', true)
          .not('image_url', 'is', null)
          .ilike('series', '%' + cardSet.set_name + '%')
          .order('booster_artwork', { ascending: true, nullsFirst: false }),
        supabase
          .from('product_contents')
          .select('id,item_name,quantity,source_label,source_url,products(id,name,category,series,language,product_type,image_url,is_public)')
          .eq('content_type', 'booster')
          .ilike('item_name', '%' + boosterSeriesName + '%'),
        supabase
          .from('product_expected_booster_series')
          .select('expected_quantity,source_label,source_url,products(id,name,category,series,language,product_type,image_url,is_public)')
          .eq('series_name', cardSet.set_name),
        supabase
          .from('products')
          .select('id,name,category,series,language,product_type,image_url')
          .eq('category', 'sealed')
          .eq('product_type', 'Booster bundle')
          .eq('language', 'FR')
          .eq('is_public', true)
          .not('image_url', 'is', null)
          .ilike('series', '%' + cardSet.set_name + '%')
      ])

      const linkedProductIds = new Set((data || []).map(entry => productFor(entry)?.id).filter(Boolean))
      const availableBoosters = (boosterProducts || []).filter(booster => !linkedProductIds.has(booster.id))
      setInferredBoosters(availableBoosters)

      const standaloneBoosterIds = new Set(availableBoosters.map(booster => booster.id))
      const sourceProducts = new Map()
      const addBoosterSource = (product, quantity, sourceLabel, sourceUrl) => {
        if (!product?.id || !product.image_url || !product.is_public || linkedProductIds.has(product.id) || standaloneBoosterIds.has(product.id)) return
        const existing = sourceProducts.get(product.id)
        sourceProducts.set(product.id, {
          ...product,
          boosterQuantity: quantity || existing?.boosterQuantity || null,
          boosterSeriesName,
          sourceLabel: sourceLabel || existing?.sourceLabel || null,
          sourceUrl: sourceUrl || existing?.sourceUrl || null
        })
      }

      ;(containedBoosterRows || []).forEach(row => addBoosterSource(productFor(row), row.quantity, row.source_label, row.source_url))
      ;(expectedBoosterRows || []).forEach(row => addBoosterSource(productFor(row), row.expected_quantity, row.source_label, row.source_url))
      ;(boosterBundleProducts || []).forEach(product => addBoosterSource(product, null, null, null))
      setInferredBoosterSources([...sourceProducts.values()])
    }

    setStatus('loaded')
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={'card-provenance-' + cardId}
        onClick={toggleProvenance}
      >
        <span aria-hidden="true">▣</span> Provenance
        <span className={styles.chevron} aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && <section id={'card-provenance-' + cardId} className={styles.panel} aria-live="polite">
        {variantProvenance.length > 0 && <>
          <h3>Première apparition des variantes Play! Pokémon</h3>
          <ul className={styles.list}>
            {variantProvenance.map((item, index) => <li key={item.finish + item.packSeries + index} className={styles.entry}>
              <div className={styles.entryHeading}><strong>{item.finish} + tampon Play! Pokémon</strong></div>
              <p className={styles.meta}>Booster Pack Récompense · {item.packSeries}e série</p>
            </li>)}
          </ul>
        </>}
        <h3>Produits répertoriés pour cette carte</h3>
        {status === 'loading' && <p className={styles.muted}>Recherche des produits…</p>}
        {status === 'error' && <p className={styles.error}>{error}</p>}
        {status === 'loaded' && entries.length === 0 && inferredBoosters.length === 0 && inferredBoosterSources.length === 0 && variantProvenance.length === 0 && (
          <p className={styles.muted}>Aucun produit d’origine n’est encore répertorié pour cette carte.</p>
        )}
        {inferredBoosters.length > 0 && <>
          <h3>Boosters de la série</h3>
          <ul className={styles.list}>
            {inferredBoosters.map(booster => <li key={booster.id} className={styles.entry}>
              <div className={styles.entryHeading}>
                <strong>{booster.name}</strong>
                <a className={styles.productLink} href={'/catalogue/' + encodeURIComponent(booster.id)}>Voir la fiche →</a>
              </div>
              <p className={styles.meta}>Présence possible · {confidenceLabel('set_inferred')}</p>
            </li>)}
          </ul>
        </>}
        {inferredBoosterSources.length > 0 && <>
          <h3>Produits contenant des boosters de la série</h3>
          <ul className={styles.list}>
            {inferredBoosterSources.map(source => <li key={source.id} className={styles.entry}>
              <div className={styles.entryHeading}>
                <strong>{source.name}</strong>
                <a className={styles.productLink} href={'/catalogue/' + encodeURIComponent(source.id)}>Voir la fiche →</a>
              </div>
              <p className={styles.itemName}>
                {source.boosterQuantity ? source.boosterQuantity + ' booster' + (source.boosterQuantity === 1 ? '' : 's') + ' · ' : ''}
                {source.boosterSeriesName}
              </p>
              <p className={styles.meta}>Présence possible · La carte peut se trouver dans l’un des boosters</p>
              {(source.sourceLabel || source.sourceUrl) && <p className={styles.source}>
                {source.sourceUrl
                  ? <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceLabel || 'Consulter la source'}</a>
                  : source.sourceLabel}
              </p>}
            </li>)}
          </ul>
        </>}
        {entries.length > 0 && <ul className={styles.list}>
          {entries.map(entry => {
            const product = productFor(entry)
            const isPossible = entry.content_role === 'possible'
            return <li key={entry.id} className={styles.entry}>
              <div className={styles.entryHeading}>
                <strong>{product?.name || entry.item_name}</strong>
                {product?.id && <a className={styles.productLink} href={'/catalogue/' + encodeURIComponent(product.id)}>Voir la fiche →</a>}
              </div>
              {product?.name && entry.item_name && entry.item_name !== product.name && (
                <p className={styles.itemName}>{entry.quantity > 1 ? entry.quantity + ' × ' : ''}{entry.item_name}</p>
              )}
              <p className={styles.meta}>
                {isPossible ? 'Présence possible' : 'Contenu garanti'}
                {' · '}{confidenceLabel(entry.confidence)}
              </p>
              {(entry.source_label || entry.source_url) && <p className={styles.source}>
                {entry.source_url
                  ? <a href={entry.source_url} target="_blank" rel="noreferrer">{entry.source_label || 'Consulter la source'}</a>
                  : entry.source_label}
              </p>}
            </li>
          })}
        </ul>}
      </section>}
    </div>
  )
}
