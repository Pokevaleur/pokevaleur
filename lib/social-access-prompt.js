'use client'

import { useState } from 'react'

const TERMS_VERSION = 'social-v1-2026-10-03'

export function SocialAccessPrompt({ supabase, verificationError, onRetry, onGranted }) {
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function confirmAdultAccess(event) {
    event.preventDefault()
    if (!confirmed || saving) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.rpc('record_adult_social_consent', {
      p_age_confirmed: true,
      p_terms_version: TERMS_VERSION,
    })
    if (error) {
      setMessage('Impossible d’enregistrer ton accord. Réessaie.')
      setSaving(false)
      return
    }
    await onGranted()
    setSaving(false)
  }

  return (
    <div className="formGrid">
      {verificationError ? (
        <>
          <p className="message" role="alert">Impossible de vérifier ton accès. Réessaie.</p>
          <button className="btn" type="button" onClick={onRetry}>Réessayer</button>
        </>
      ) : (
        <>
          <p>Pour entrer, confirme ton âge et accepte les règles de la communauté.</p>
          <form className="formGrid" onSubmit={confirmAdultAccess}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />
              <span>J’ai 15 ans ou plus et j’accepte les règles : respect, pas de coordonnées personnelles, et échanges sans paiement dans PokéValeur.</span>
            </label>
            <button className="btn" type="submit" disabled={!confirmed || saving}>
              {saving ? 'Enregistrement…' : 'Confirmer et entrer'}
            </button>
          </form>
          {message && <p className="message" role="status">{message}</p>}
          <p className="muted">Moins de 15 ans ? Demande à ton parent de créer une collection enfant et de t’envoyer un lien avec son accord. Même si tu as déjà un compte, tu gardes ta collection actuelle.</p>
        </>
      )}
      <a className="btn ghost" href="/collection">← Ma collection</a>
    </div>
  )
}
