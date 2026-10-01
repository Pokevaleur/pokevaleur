'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

const AVATARS = [
  { key: 'star', emoji: '⭐', label: 'Étoile' },
  { key: 'fire', emoji: '🔥', label: 'Feu' },
  { key: 'water', emoji: '💧', label: 'Eau' },
  { key: 'leaf', emoji: '🍃', label: 'Feuille' },
  { key: 'spark', emoji: '⚡', label: 'Éclair' },
  { key: 'crystal', emoji: '💎', label: 'Cristal' },
]

const POST_LOGIN_PREFIXES = ['/collection', '/communaute', '/opportunites', '/trades', '/admin']

function getPostLoginPath() {
  const savedPath = window.localStorage.getItem('pokevaleur-post-login-path')
  const requestedPath = new URLSearchParams(window.location.search).get('next')
  const candidate = savedPath || requestedPath || '/collection'
  try {
    const parsed = new URL(candidate, window.location.origin)
    const isAllowedPath = POST_LOGIN_PREFIXES.some(prefix => parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/'))
    if (parsed.origin === window.location.origin && isAllowedPath) {
      return parsed.pathname + parsed.search + parsed.hash
    }
  } catch {}
  return '/collection'
}

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarKey, setAvatarKey] = useState('star')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const isSignUp = mode === 'signup'

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') === 'invalid') {
      setMessage('Ce lien de réinitialisation est invalide ou a expiré. Demande un nouveau lien.')
    }
  }, [])

  function authErrorMessage(error, context) {
    const detail = error?.message?.toLowerCase() || ''
    if (detail.includes('invalid login credentials') || detail.includes('invalid credentials')) {
      return 'Adresse e-mail ou mot de passe incorrect.'
    }
    if (detail.includes('email not confirmed') || detail.includes('email_not_confirmed')) {
      return 'Confirme ton adresse e-mail avant de te connecter.'
    }
    if (detail.includes('too many requests') || detail.includes('rate limit')) {
      return 'Trop de tentatives. Attends quelques minutes avant de réessayer.'
    }
    return context === 'signin'
      ? 'La connexion a échoué. Vérifie tes informations puis réessaie.'
      : 'La création du compte a échoué. Réessaie dans quelques instants.'
  }

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
      const returnPath = getPostLoginPath()
      const transferToken = new URL(returnPath, window.location.origin).searchParams.get('token')
      const emailRedirectTo = transferToken
        ? `${window.location.origin}/collection?transfer=${encodeURIComponent(transferToken)}`
        : `${window.location.origin}${returnPath}`
      const { data, error } = await supabase.auth.signUp({
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
        if (data.user && data.user.identities?.length === 0) {
          setMessage('Cette adresse e-mail est déjà associée à un compte. Connecte-toi avec ce compte ou utilise « Mot de passe oublié ? » si tu ne connais plus son mot de passe.')
          return
        }
        setMode('signin')
        setMessage('Compte créé. Confirme ton adresse avec le lien reçu par e-mail, puis connecte-toi avec cette adresse. Si un autre compte est déjà ouvert, déconnecte-le avant de te connecter à celui-ci.')
        return
      }
      const lowerMessage = error.message.toLowerCase()
      if (lowerMessage.includes('already registered') || lowerMessage.includes('already exists')) {
        setMessage('Cette adresse e-mail est déjà utilisée.')
      } else if (lowerMessage.includes('database error') || lowerMessage.includes('duplicate key')) {
        setMessage('La création a échoué. Ce pseudo est peut-être déjà pris : essaie-en un autre.')
      } else {
        setMessage(authErrorMessage(error, 'signup'))
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
      if (error) return setMessage(authErrorMessage(error, 'signin'))
      const destination = getPostLoginPath()
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

  async function requestPasswordReset() {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setMessage('Entre ton adresse e-mail pour recevoir un lien de réinitialisation.')
      return
    }
    setIsSubmitting(true)
    setMessage('Envoi de la demande…')
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/update-password')}`
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
      if (error) {
        const detail = error.message?.toLowerCase() || ''
        setMessage(detail.includes('rate limit') || detail.includes('too many requests')
          ? 'Trop de demandes. Attends quelques minutes avant de réessayer.'
          : 'La demande n’a pas pu être envoyée. Vérifie ton adresse puis réessaie.')
        return
      }
      setMessage('Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé. Vérifie aussi tes courriers indésirables.')
    } catch {
      setMessage('Connexion impossible au service. Vérifie ta connexion puis réessaie.')
    } finally {
      setIsSubmitting(false)
    }
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
            <div className="passwordField">
              <input
                id="account-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              <button
                className="passwordToggle"
                type="button"
                aria-controls="account-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(visible => !visible)}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </label>

          {!isSignUp && (
            <button
              className="passwordRecoveryLink"
              type="button"
              disabled={isSubmitting}
              onClick={requestPasswordReset}
            >
              Mot de passe oublié ?
            </button>
          )}

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
