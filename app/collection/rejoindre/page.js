'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'

const TERMS_VERSION = 'social-v1-2026-10-03'

export default function JoinCollectionPage() {
  const [token, setToken] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('Vérification de l’invitation…')
  const [accepting, setAccepting] = useState(false)
  const [transferAccepted, setTransferAccepted] = useState(false)
  const [minorAssent, setMinorAssent] = useState(false)
  const [savingAssent, setSavingAssent] = useState(false)
  const [assentSaved, setAssentSaved] = useState(false)

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
    setTransferAccepted(true)
    setMessage('La collection est transférée. Tu peux maintenant choisir séparément si tu souhaites accéder aux fonctions sociales.')
    setAccepting(false)
  }

  async function enableMinorSocialAccess() {
    if (!minorAssent || savingAssent) return
    setSavingAssent(true)
    setMessage('Enregistrement de ton accord…')
    const ageResult = await supabase.rpc('record_under_15_age_declaration')
    if (ageResult.error) {
      setMessage(ageResult.error.message || 'Impossible d’enregistrer ta tranche d’âge.')
      setSavingAssent(false)
      return
    }
    const { error } = await supabase.rpc('record_transferred_child_social_assent', {
      raw_token: token,
      p_child_assent: true,
      p_terms_version: TERMS_VERSION
    })
    if (error) {
      setMessage('Aucun accord parental n’est associé à ce lien. Ta collection reste transférée. Demande à ton parent de créer une nouvelle collection enfant et de t’envoyer un lien avec son accord.')
      setSavingAssent(false)
      return
    }
    setAssentSaved(true)
    setMessage('Ton accord est enregistré. Ouverture de ta collection…')
    window.setTimeout(goToCollection, 700)
  }

  function goToCollection() {
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
        {user && token.length === 64 && !transferAccepted && (
          <button className="btn" type="button" onClick={acceptTransfer} disabled={accepting}>
            {accepting ? 'Transfert…' : 'Accepter le transfert complet'}
          </button>
        )}
        {user && transferAccepted && (
          <div className="formGrid">
            <p>Si tu as moins de 15 ans et que ton parent ou tuteur a donné son accord lors de la création du lien, tu peux aussi donner ton propre accord aux fonctions sociales. Ce choix est séparé du transfert de ta collection.</p>
            <label style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <input type="checkbox" checked={minorAssent} onChange={event => setMinorAssent(event.target.checked)} />
              <span>J’ai moins de 15 ans et j’accepte les règles : rester respectueux, ne pas partager mes coordonnées personnelles et organiser les échanges sans paiement dans PokéValeur.</span>
            </label>
            <button className="btn ghost" type="button" onClick={enableMinorSocialAccess} disabled={!minorAssent || savingAssent || assentSaved}>
              {assentSaved ? 'Accord enregistré…' : savingAssent ? 'Enregistrement…' : 'Donner mon accord social'}
            </button>
            {!savingAssent && !assentSaved && <button className="btn" type="button" onClick={goToCollection}>Continuer vers ma collection</button>}
          </div>
        )}
      </section>
    </main>
  )
}
