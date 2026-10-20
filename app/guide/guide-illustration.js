'use client'

import { useEffect, useRef, useState } from 'react'
import { getOptimizedImageUrl } from '../../lib/optimized-image-url.js'
import styles from './guide.module.css'

export default function GuideIllustration({ src, alt = '', caption = '', sourceUrl = '', sourceLabel = '', compact = false, hideCaption = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (isOpen && dialog && !dialog.open) dialog.showModal()
  }, [isOpen])

  function closeViewer() {
    if (dialogRef.current?.open) dialogRef.current.close()
    setIsOpen(false)
  }

  if (!src) return null

  return <figure className={compact ? `${styles.illustration} ${styles.illustrationCompact}` : styles.illustration}>
    <button
      className={styles.illustrationButton}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label={`Agrandir l’image${alt ? ` : ${alt}` : ''}`}
      aria-haspopup="dialog"
    >
      <img src={getOptimizedImageUrl(src, 384)} data-original-src={src} alt={alt} loading="lazy" decoding="async" onError={event => { event.currentTarget.src = src }} />
    </button>
    {!hideCaption && (caption || alt) && <figcaption>
      {caption || alt}
      <span className={styles.zoomHint}> · Toucher pour agrandir</span>
      {sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceLabel || 'Source de la photo'}</a></>}
    </figcaption>}
    <dialog
      className={styles.imageViewer}
      ref={dialogRef}
      aria-label={alt || 'Image agrandie'}
      onClose={() => setIsOpen(false)}
      onClick={event => {
        if (event.target === dialogRef.current) closeViewer()
      }}
    >
      <button className={styles.imageViewerClose} type="button" onClick={closeViewer} aria-label="Fermer l’image agrandie">×</button>
      {isOpen && <img src={src} alt={alt} decoding="async" /> }
      {!hideCaption && (caption || alt) && <p>{caption || alt}</p>}
    </dialog>
  </figure>
}
