'use client'

import { useState } from 'react'
import styles from './card-provenance.module.css'

function productFor(entry) {
  return Array.isArray(entry.products) ? entry.products[0] : entry.products
}

function confidenceLabel(confidence) {
  if (confidence === 'verified') return 'Source vérifiée'
  if (confidence === 'photo_inferred') return 'Déduit d’une photo'
  return 'Source à confirmer'
}

export default function CardProvenanceButton({ supabase, cardId }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [entries, setEntries] = useState([])
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
        <h3>Produits contenant cette carte</h3>
        {status === 'loading' && <p className={styles.muted}>Recherche des produits…</p>}
        {status === 'error' && <p className={styles.error}>{error}</p>}
        {status === 'loaded' && entries.length === 0 && (
          <p className={styles.muted}>Aucun produit d’origine n’est encore répertorié pour cette carte.</p>
        )}
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
