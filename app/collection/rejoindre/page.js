'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'

export default function JoinCollectionPage() {
  const [token, setToken] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('Vérification de l’invitation…')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    async function checkSession() {
      const currentToken = new URLSearchParams(window.location.search).get('token') || ''
      setToken(currentToken)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      if (!currentToken || currentToken.length !== 64) {
        setMessage('Ce lien de transfert semble incomplet ou invalide.')
        return
      }
      if (!currentUser) {
        window.localStorage.setItem('pokevaleur-post-login-path', window.location.pathname + window.location.search)
        setMessage('Connecte-toi ou crée ton compte pour accepter le transfert.')
        return
      }
      setMessage('Ton compte est prêt à recevoir la collection. Confirme le transfert complet pour continuer.')
    }
    checkSession()
  }, [supabase])

  async function acceptTransfer() {
    setAccepting(true)
    setMessage('Transfert en cours…')
    const { data: profileId, error } = await supabase.rpc('accept_collection_transfer_invite', { raw_token: token })
    if (error) {
      setMessage(error.message)
      setAccepting(false)
      return
    }
    window.localStorage.setItem(`pokevaleur-collection:${user.id}`, profileId)
    window.localStorage.removeItem('pokevaleur-post-login-path')
    window.location.href = '/collection'
  }

  return (
    <main className="narrow">
      <section className="panel">
        <h1>Recevoir une collection PokéValeur</h1>
        <p>{message}</p>
        {!user && token.length === 64 && (
          <a className="btn" href="/login">Connexion / création de compte</a>
        )}
        {user && token.length === 64 && (
          <button className="btn" type="button" onClick={acceptTransfer} disabled={accepting}>
            {accepting ? 'Transfert…' : 'Accepter le transfert complet'}
          </button>
        )}
      </section>
    </main>
  )
}
