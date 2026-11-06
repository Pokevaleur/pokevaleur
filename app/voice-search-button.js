'use client'

import { useEffect, useState } from 'react'
import { correctKnownVoiceCardName } from '../lib/voice-search.mjs'
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
    recognition.maxAlternatives = 5
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = event => {
      setListening(false)
      setMessage(event.error === 'not-allowed'
        ? 'Autorise le micro dans ton navigateur pour utiliser la recherche vocale.'
        : 'La reconnaissance vocale a échoué. Tu peux saisir ta recherche.')
    }
    recognition.onresult = event => {
      const alternatives = Array.from(event.results?.[0] || [])
        .map(result => result?.transcript?.trim())
        .filter(Boolean)
      const score = transcript => {
        const normalized = transcript.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return Number(Boolean(correctKnownVoiceCardName(transcript))) * 4
          + Number(/\b(lovdisc|love\s+disk|love\s*disc)\b/.test(normalized)) * 2
          + Number(/\b(reverse|revers|rivers?)\b/.test(normalized)) * 2
      }
      const transcript = alternatives
        .sort((left, right) => score(right) - score(left))[0]
      const correctedTranscript = correctKnownVoiceCardName(transcript) || transcript
      if (correctedTranscript) window.location.assign('/recherche?search=' + encodeURIComponent(correctedTranscript))
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
