'use client'

import { useEffect, useState } from 'react'
import styles from './guide.module.css'

function normalize(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim()
}

export default function GuideControls() {
  const [query, setQuery] = useState('')
  const [resultCount, setResultCount] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const term = normalize(query)
    const topicElements = Array.from(document.querySelectorAll('[data-guide-topic]'))
    let visibleTopics = 0
    let visibleQuestions = 0

    for (const topic of topicElements) {
      const heading = topic.querySelector('[data-guide-topic-heading]')
      const topicMatches = !term || normalize(heading?.textContent).includes(term)
      const questions = Array.from(topic.querySelectorAll('[data-guide-question]'))
      let topicHasResults = topicMatches && Boolean(term)

      for (const question of questions) {
        const matches = !term || topicMatches || normalize(question.textContent).includes(term)
        question.hidden = !matches
        if (matches) {
          visibleQuestions += 1
          topicHasResults = true
        }
      }

      topic.hidden = Boolean(term) && !topicHasResults
      if (!topic.hidden) visibleTopics += 1
    }

    for (const link of document.querySelectorAll('[data-guide-topic-link]')) {
      const topic = document.getElementById(link.getAttribute('data-guide-topic-link'))
      link.hidden = Boolean(term) && (!topic || topic.hidden)
    }

    const topicIndex = document.querySelector('[data-guide-topic-index]')
    if (topicIndex) topicIndex.hidden = Boolean(term) && visibleTopics === 0

    let visibleGlossary = 0
    const glossaryEntries = Array.from(document.querySelectorAll('[data-guide-glossary-entry]'))
    for (const entry of glossaryEntries) {
      const matches = !term || normalize(entry.textContent).includes(term)
      entry.hidden = !matches
      if (matches) visibleGlossary += 1
    }

    const glossary = document.querySelector('[data-guide-glossary]')
    if (glossary) glossary.hidden = Boolean(term) && visibleGlossary === 0

    const count = visibleQuestions + visibleGlossary
    setResultCount(count)

    const noResults = document.querySelector('[data-guide-no-results]')
    if (noResults) noResults.hidden = !term || count > 0
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
        <span aria-hidden="true">⌕</span>
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
        {query.trim() ? (resultCount ? `${resultCount} résultat(s) dans le guide et le lexique.` : 'Aucun résultat.') : ''}
      </p>
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
