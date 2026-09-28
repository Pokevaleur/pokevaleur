'use client'

import { useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const supabase = useMemo(() => createClient(), [])

  function validate() {
    if (!email.trim()) {
      setMessage('Entre ton adresse e-mail.')
      return false
    }
    if (!password || password.length < 6) {
      setMessage('Le mot de passe doit contenir au moins 6 caractères.')
      return false
    }
    return true
  }

  async function signUp() {
    if (!validate()) return
    setMessage('Création du compte...')
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    setMessage(
      error
        ? error.message
        : 'Compte créé. Vérifie ton e-mail si Supabase demande une confirmation.'
    )
  }

  async function signIn(e) {
    e.preventDefault()
    if (!validate()) return
    setMessage('Connexion...')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return setMessage(error.message)
    window.location.href = '/collection'
  }

  return (
    <main className="narrow">
      <section className="panel authCard">
        <h1>Connexion à PokéValeur</h1>
        <p>Crée un compte gratuit ou connecte-toi pour enregistrer ta collection.</p>

        <form onSubmit={signIn}>
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
              autoComplete="current-password"
            />
          </label>

          <div className="actions">
            <button className="btn" type="submit">
              Se connecter
            </button>
            <button className="btn ghost" type="button" onClick={signUp}>
              Créer mon compte
            </button>
          </div>
        </form>

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  )
}
