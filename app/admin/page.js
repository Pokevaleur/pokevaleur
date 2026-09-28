'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const admin = Boolean(profile?.is_admin)
    setIsAdmin(admin)

    if (admin) {
      const { data } = await supabase
        .from('product_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
      setSuggestions(data || [])
    }

    setLoading(false)
  }

  async function approve(suggestion) {
    setMessage('Ajout au catalogue...')

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name: suggestion.name,
        series: suggestion.series || null,
        category: suggestion.category,
        currency: 'EUR',
        is_public: true
      })
      .select('id')
      .single()

    if (productError) {
      setMessage(productError.message)
      return
    }

    const { error: statusError } = await supabase
      .from('product_suggestions')
      .update({ status: 'approved' })
      .eq('id', suggestion.id)

    if (statusError) {
      setMessage(statusError.message)
      return
    }

    setMessage('Produit ajouté au catalogue.')
    await load()
  }

  async function reject(id) {
    const { error } = await supabase
      .from('product_suggestions')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Proposition refusée.')
    await load()
  }

  if (loading) {
    return <main><section className="panel"><p>Chargement...</p></section></main>
  }

  if (!user) {
    return (
      <main className="narrow">
        <section className="panel">
          <h1>Administration</h1>
          <p>Connecte-toi pour accéder à cet espace.</p>
          <a className="btn" href="/login">Connexion</a>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="narrow">
        <section className="panel">
          <h1>Administration</h1>
          <p>Accès réservé à l’administrateur PokéValeur.</p>
        </section>
      </main>
    )
  }

  const pending = suggestions.filter(item => item.status === 'pending')
  const treated = suggestions.filter(item => item.status !== 'pending')

  return (
    <main>
      <section className="catalogHero">
        <span className="eyebrow dark">Administration</span>
        <h1>Modération du catalogue</h1>
        <p className="muted">
          Valide ou refuse les produits proposés par les membres avant leur publication.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="panel">
        <div className="listHeader">
          <h2>Propositions en attente</h2>
          <span className="adminCount">{pending.length}</span>
        </div>

        <div className="adminSuggestionList">
          {pending.length === 0 ? (
            <p>Aucune proposition en attente.</p>
          ) : (
            pending.map(item => (
              <article className="adminSuggestionCard" key={item.id}>
                <div>
                  <span className="catalogBadge">
                    {item.category === 'sealed' ? 'Scellé' : item.category}
                  </span>
                  <h3>{item.name}</h3>
                  <p className="muted">{item.series || 'Série non renseignée'}</p>
                  {item.notes && <p>{item.notes}</p>}
                  <small className="muted">
                    Proposé le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                  </small>
                </div>

                <div className="adminActions">
                  <button className="miniBtn primaryMini" onClick={() => approve(item)}>
                    Accepter
                  </button>
                  <button className="miniBtn dangerMini" onClick={() => reject(item.id)}>
                    Refuser
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel adminHistory">
        <h2>Historique récent</h2>
        <div className="historyRows">
          {treated.slice(0, 20).map(item => (
            <div key={item.id}>
              <span>{item.name}</span>
              <b className={item.status === 'approved' ? 'gain' : 'loss'}>
                {item.status === 'approved' ? 'Accepté' : 'Refusé'}
              </b>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
