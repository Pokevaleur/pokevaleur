'use client'

import { useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

const AVATARS = [
  { key: 'star', emoji: '⭐', label: 'Étoile' },
  { key: 'fire', emoji: '🔥', label: 'Feu' },
  { key: 'water', emoji: '💧', label: 'Eau' },
  { key: 'leaf', emoji: '🍃', label: 'Feuille' },
  { key: 'spark', emoji: '⚡', label: 'Éclair' },
  { key: 'crystal', emoji: '💎', label: 'Cristal' },
]

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarKey, setAvatarKey] = useState('star')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const isSignUp = mode === 'signup'

  function validate() {
    if (!email.trim()) {
      setMessage('Entre ton adresse e-mail.')
      return false
    }
    if (!password || password.length < 6) {
      setMessage('Le mot de passe doit contenir au moins 6 caractères.')
      return false
    }
    if (isSignUp) {
      const trimmedName = displayName.trim()
      if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(trimmedName)) {
        setMessage('Choisis un pseudo de 3 à 24 caractères : lettres, chiffres, tiret ou tiret bas.')
        return false
      }
    }
    return true
  }

  async function signUp() {
    if (!validate()) return
    setIsSubmitting(true)
    setMessage('Création du compte...')
    try {
      const returnPath = window.localStorage.getItem('pokevaleur-post-login-path') || '/collection'
      const transferToken = new URL(returnPath, window.location.origin).searchParams.get('token')
      const emailRedirectTo = transferToken
        ? `${window.location.origin}/collection?transfer=${encodeURIComponent(transferToken)}`
        : `${window.location.origin}/collection`
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: {
            display_name: displayName.trim(),
            avatar_key: avatarKey,
          },
        },
      })
      if (!error) {
        setMessage('Compte créé. Vérifie ton e-mail si Supabase demande une confirmation.')
        return
      }
      const lowerMessage = error.message.toLowerCase()
      if (lowerMessage.includes('already registered') || lowerMessage.includes('already exists')) {
        setMessage('Cette adresse e-mail est déjà utilisée.')
      } else if (lowerMessage.includes('database error') || lowerMessage.includes('duplicate key')) {
        setMessage('La création a échoué. Ce pseudo est peut-être déjà pris : essaie-en un autre.')
      } else {
        setMessage(error.message)
      }
    } catch {
      setMessage('Connexion impossible au service. Vérifie ta connexion puis réessaie.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signIn(e) {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    setMessage('Connexion...')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return setMessage(error.message)
      const savedDestination = window.localStorage.getItem('pokevaleur-post-login-path') || '/collection'
      let destination = '/collection'
      try {
        const parsedDestination = new URL(savedDestination, window.location.origin)
        if (parsedDestination.origin === window.location.origin && parsedDestination.pathname === '/collection/rejoindre') {
          destination = parsedDestination.pathname + parsedDestination.search
        }
      } catch {}
      window.localStorage.removeItem('pokevaleur-post-login-path')
      window.location.href = destination
    } catch {
      setMessage('Connexion impossible au service. Vérifie ta connexion puis réessaie.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (isSignUp) return signUp()
    return signIn(e)
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setMessage('')
  }

  return (
    <main className="narrow">
      <section className="panel authCard">
        <h1>{isSignUp ? 'Créer ton compte PokéValeur' : 'Connexion à PokéValeur'}</h1>
        <p>
          {isSignUp
            ? 'Choisis ton pseudo et ton avatar pour créer ton profil de collectionneur.'
            : 'Connecte-toi pour retrouver et gérer ta collection.'}
        </p>

        <form onSubmit={submit}>
          {isSignUp && (
            <>
              <label>
                Pseudo
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  minLength={3}
                  maxLength={24}
                  autoComplete="nickname"
                  required
                />
                <small className="muted">Ce pseudo sera distinct de ton adresse e-mail.</small>
              </label>

              <fieldset className="avatarFieldset">
                <legend>Choisis ton avatar</legend>
                <div className="avatarPicker" aria-label="Avatar">
                  {AVATARS.map(avatar => (
                    <button
                      type="button"
                      key={avatar.key}
                      className={avatarKey === avatar.key ? 'avatarOption selected' : 'avatarOption'}
                      aria-pressed={avatarKey === avatar.key}
                      aria-label={avatar.label}
                      onClick={() => setAvatarKey(avatar.key)}
                    >
                      <span className={`avatarIcon avatar-${avatar.key}`} aria-hidden="true">{avatar.emoji}</span>
                      <span>{avatar.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </label>

          <div className="actions">
            <button className="btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Patiente…' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={isSubmitting}
              onClick={() => changeMode(isSignUp ? 'signin' : 'signup')}
            >
              {isSignUp ? 'J’ai déjà un compte' : 'Créer un compte gratuit'}
            </button>
          </div>
        </form>

        {message && <p className="message" role="status">{message}</p>}
      </section>
    </main>
  )
}
