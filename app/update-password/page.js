'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function UpdatePasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const [isChecking, setIsChecking] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    const recoveryRequested = new URLSearchParams(window.location.search).get('recovery') === '1'
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      setIsRecovery(recoveryRequested && !error && Boolean(data.user))
      if (!recoveryRequested || error || !data.user) {
        setMessage('Ce lien de réinitialisation est invalide ou a expiré. Demande un nouveau lien depuis la page de connexion.')
      }
      setIsChecking(false)
    })
    return () => { active = false }
  }, [supabase])

  async function submit(event) {
    event.preventDefault()
    if (password.length < 6) {
      setMessage('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmation) {
      setMessage('Les deux mots de passe ne correspondent pas.')
      return
    }
    setIsSubmitting(true)
    setMessage('Mise à jour du mot de passe…')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage('La mise à jour a échoué. Le lien a peut-être expiré : demande-en un nouveau depuis la page de connexion.')
      setIsSubmitting(false)
      return
    }
    window.location.replace('/collection')
  }

  return (
    <main className="narrow">
      <section className="panel authCard">
        <h1>Réinitialiser le mot de passe</h1>
        {isChecking ? <p>Vérification du lien…</p> : isRecovery ? (
          <>
            <p>Choisis un nouveau mot de passe pour ton compte PokéValeur.</p>
            <form onSubmit={submit}>
              <label>
                Nouveau mot de passe
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirme le nouveau mot de passe
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button
                className="passwordRecoveryLink"
                type="button"
                aria-pressed={showPasswords}
                onClick={() => setShowPasswords(visible => !visible)}
              >
                {showPasswords ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
              </button>
              <div className="actions">
                <button className="btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Patiente…' : 'Enregistrer le nouveau mot de passe'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <p><a href="/login">Retour à la connexion</a></p>
        )}
        {message && <p className="message" role="status">{message}</p>}
      </section>
    </main>
  )
}
