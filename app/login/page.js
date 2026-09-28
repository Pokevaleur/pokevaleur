'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const supabase = createClient()

  async function signUp(e) {
    e.preventDefault()
    setMessage('Création du compte...')
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Compte créé. Vérifie ton e-mail si une confirmation est demandée.')
  }

  async function signIn(e) {
    e.preventDefault()
    setMessage('Connexion...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setMessage(error.message)
    window.location.href = '/collection'
  }

  return (
    <main className="narrow">
      <section className="panel authCard">
        <h1>Connexion à PokéValeur</h1>
        <p>Crée un compte gratuit ou connecte-toi pour enregistrer ta collection.</p>
        <form>
          <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></label>
          <div className="actions">
            <button className="btn" onClick={signIn}>Se connecter</button>
            <button className="btn ghost" onClick={signUp}>Créer mon compte</button>
          </div>
        </form>
        {message && <p className="message">{message}</p>}
      </section>
    </main>
  )
}
