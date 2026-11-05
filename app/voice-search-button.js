'use client'

import { useEffect, useState } from 'react'
import styles from './voice-search-button.module.css'

export default function VoiceSearchButton() {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  function startVoiceSearch() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition || listening) return

    setMessage('')
    const recognition = new Recognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = event => {
      setListening(false)
      setMessage(event.error === 'not-allowed'
        ? 'Autorise le micro dans ton navigateur pour utiliser la recherche vocale.'
        : 'La reconnaissance vocale a échoué. Tu peux saisir ta recherche.')
    }
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) window.location.assign('/recherche?search=' + encodeURIComponent(transcript))
      else setMessage('Je n’ai pas reconnu de recherche. Réessaie ou saisis-la.')
    }

    try { recognition.start() }
    catch {
      setListening(false)
      setMessage('Le micro ne peut pas démarrer. Tu peux saisir ta recherche.')
    }
  }

  if (!supported) return null

  return <>
    <button className={listening ? `${styles.button} ${styles.listening}` : styles.button}
      type="button" onClick={startVoiceSearch} disabled={listening}
      aria-label={listening ? 'Écoute en cours' : 'Rechercher par la voix'}
      aria-pressed={listening} title={listening ? 'Écoute en cours…' : 'Rechercher par la voix'}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" />
      </svg>
    </button>
    <span className={styles.status} role="status" aria-live="polite">{message}</span>
  </>
}
