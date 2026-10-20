'use client'

import { useEffect, useState } from 'react'
import styles from './guide.module.css'
import GuideIllustration from './guide-illustration'

function normalize(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim()
}

function getSearchResults(term) {
  const results = []

  for (const question of document.querySelectorAll('[data-guide-question]')) {
    const topic = question.closest('[data-guide-topic]')
    const questionTitle = question.querySelector('summary')?.textContent?.trim() || ''
    const answer = question.querySelector('[data-guide-answer] > p')?.textContent?.trim() || ''
    const topicTitle = topic?.querySelector('[data-guide-topic-heading] h2')?.textContent?.trim() || ''
    if (normalize(questionTitle + ' ' + answer + ' ' + topicTitle).includes(term)) {
      const images = Array.from(question.querySelectorAll('[data-guide-answer] figure')).map(figure => {
        const image = figure.querySelector('img')
        const caption = figure.querySelector('figcaption')
        const source = caption?.querySelector('a')
        return image ? {
          src: image.currentSrc || image.src || '',
          alt: image.alt || '',
          caption: caption?.childNodes?.[0]?.textContent?.trim() || '',
          sourceUrl: source?.href || '',
          sourceLabel: source?.textContent?.trim() || ''
        } : null
      }).filter(image => image?.src)
      results.push({
        id: question.id || questionTitle,
        kind: 'Question du guide',
        title: questionTitle,
        text: answer,
        images
      })
    }
  }

  for (const entry of document.querySelectorAll('[data-guide-glossary-entry]')) {
    const title = entry.querySelector('dt')?.textContent?.trim() || ''
    const text = entry.querySelector('dd > p')?.textContent?.trim() || ''
    if (normalize(title + ' ' + text).includes(term)) {
      const image = entry.querySelector('dd img')
      const isReverse = normalize(title) === 'reverse'
      const isHolo = normalize(title) === 'holo'
      results.push({
        id: entry.id || title,
        kind: 'Lexique',
        title,
        text,
        image: isReverse
          ? 'https://i.ebayimg.com/images/g/tSsAAOSwsEhmqHii/s-l1200.jpg'
          : isHolo
            ? 'https://i.ebayimg.com/images/g/kyMAAeSwp0Foc9ov/s-l1200.jpg'
            : (image?.currentSrc || image?.src || ''),
        imageAlt: isReverse
          ? 'Vraie carte Reverse Ivysaur 002/165 de l’extension Écarlate et Violet—151, montrant le motif brillant du fond.'
          : isHolo
            ? 'Vraie carte holographique Gengar 057/198 de l’extension Épée et Bouclier—Règne de Glace, dont la zone de l’illustration est brillante.'
            : (image?.alt || ''),
        imageCaption: isReverse
          ? 'Exemple réel : Ivysaur 002/165, Écarlate et Violet—151.'
          : isHolo ? 'Exemple réel : Gengar 057/198, Épée et Bouclier—Règne de Glace (Holo).' : '',
        imageSourceUrl: isReverse
          ? 'https://www.ebay.com/itm/226267876969'
          : isHolo ? 'https://www.ebay.com/itm/116795491171' : '',
        imageSourceLabel: isReverse || isHolo ? 'Voir la source de la photo' : ''
      })
    }
  }

  const matchesReverse = term.length >= 4 && (normalize('Reverse').includes(term) || term.includes('reverse'))
  const hasReverseDefinition = results.some(result => result.kind === 'Lexique' && normalize(result.title) === 'reverse')
  if (matchesReverse && !hasReverseDefinition) {
    results.unshift({
      id: 'guide-reverse-definition',
      kind: 'Lexique',
      title: 'Reverse',
      text: 'Une carte reverse (ou reverse holo) est une variante brillante. Le motif holographique couvre souvent le fond de la carte autour de l’illustration, qui reste visuellement distincte. Le motif exact varie selon les séries et les époques.',
      image: 'https://i.ebayimg.com/images/g/tSsAAOSwsEhmqHii/s-l1200.jpg',
      imageAlt: 'Vraie carte Reverse Ivysaur 002/165 de l’extension Écarlate et Violet—151, montrant le motif brillant du fond.',
      imageCaption: 'Exemple réel : Ivysaur 002/165, Écarlate et Violet—151.',
      imageSourceUrl: 'https://www.ebay.com/itm/226267876969',
      imageSourceLabel: 'Voir la source de la photo'
    })
  }

  const matchesHolo = term.length >= 4 && (normalize('Holo').includes(term) || term.includes('holo'))
  const hasHoloDefinition = results.some(result => result.kind === 'Lexique' && normalize(result.title) === 'holo')
  if (matchesHolo && !hasHoloDefinition) {
    results.unshift({
      id: 'guide-holo-definition',
      kind: 'Lexique',
      title: 'Holo',
      text: 'Une carte Holo (ou holographique) présente généralement un effet brillant sur l’illustration du Pokémon. Sur une Reverse, l’effet brillant se trouve plutôt sur le fond de la carte, autour de l’illustration. Les motifs et finitions varient selon les séries.',
      image: 'https://i.ebayimg.com/images/g/kyMAAeSwp0Foc9ov/s-l1200.jpg',
      imageAlt: 'Vraie carte holographique Gengar 057/198 de l’extension Épée et Bouclier—Règne de Glace, dont la zone de l’illustration est brillante.',
      imageCaption: 'Exemple réel : Gengar 057/198, Épée et Bouclier—Règne de Glace (Holo).',
      imageSourceUrl: 'https://www.ebay.com/itm/116795491171',
      imageSourceLabel: 'Voir la source de la photo'
    })
  }

  return results
}

export default function GuideControls() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const term = normalize(query)
    const hasQuery = Boolean(term)
    const nextResults = hasQuery ? getSearchResults(term) : []
    setResults(nextResults)

    for (const element of document.querySelectorAll('[data-guide-hero], [data-guide-topic-index], [data-guide-topic-list], [data-guide-glossary], [data-guide-note]')) {
      element.hidden = hasQuery
    }

    const noResults = document.querySelector('[data-guide-no-results]')
    if (noResults) noResults.hidden = !hasQuery || nextResults.length > 0
  }, [query])

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 420)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  return <>
    <section className={styles.guideControls} aria-label="Recherche dans le guide">
      <label className={styles.searchLabel} htmlFor="guide-search">Rechercher dans le guide</label>
      <div className={styles.searchField}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
        <input
          id="guide-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Ex. ETB, booster, carte gradée"
          autoComplete="off"
        />
      </div>
      <p className={styles.searchStatus} aria-live="polite">
        {query.trim() ? (results.length ? `${results.length} résultat${results.length > 1 ? 's' : ''} dans le guide et le lexique — réponse${results.length > 1 ? 's' : ''} ci-dessous.` : 'Aucun résultat.') : ''}
      </p>
      {query.trim() && results.length > 0 && <div className={styles.searchResults} aria-label="Résultats de recherche">
        {results.map(result => <article className={styles.searchResult} key={result.id}>
          <span className={styles.resultKind}>{result.kind}</span>
          <h2>{result.title}</h2>
          {result.text && <p>{result.text}</p>}
          {result.images?.length ? result.images.map((image, index) => <GuideIllustration
            key={`${result.id}-image-${index}`}
            src={image.src}
            alt={image.alt}
            caption={image.caption}
            sourceUrl={image.sourceUrl}
            sourceLabel={image.sourceLabel}
            compact
          />) : result.image && <GuideIllustration
            src={result.image}
            alt={result.imageAlt}
            caption={result.imageCaption}
            sourceUrl={result.imageSourceUrl}
            sourceLabel={result.imageSourceLabel}
            compact
          />}
          <p className={styles.answerSignature}><strong>PokéValeur.fr</strong><span>Le guide du collectionneur</span></p>
        </article>)}
      </div>}
    </section>

    {showBackToTop && <button
      className={styles.scrollTopButton}
      type="button"
      aria-label="Remonter en haut de page"
      title="Remonter en haut de page"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >↑</button>}
  </>
}
