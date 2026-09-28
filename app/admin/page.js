'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const emptyObservation = {
  product_id: '',
  source: 'GCC',
  price: '',
  observed_at: '',
  condition_tier: 'standard',
  observation_type: 'confirmed_sale'
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [observation, setObservation] = useState(emptyObservation)
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
      const [{ data: suggestionData }, { data: productData }, { data: historyData }] = await Promise.all([
        supabase.from('product_suggestions').select('*').order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id,name,series,category,current_value,zero_defect_value,price_updated_at,zero_defect_updated_at')
          .eq('is_public', true)
          .order('name'),
        supabase
          .from('product_price_history')
          .select('id,product_id,source,price,observed_at,condition_tier,observation_type')
          .order('observed_at', { ascending: false })
      ])

      setSuggestions(suggestionData || [])
      setProducts(productData || [])
      setHistory(historyData || [])
    }

    setLoading(false)
  }

  async function approve(suggestion) {
    setMessage('Ajout au catalogue...')

    const { error: productError } = await supabase
      .from('products')
      .insert({
        name: suggestion.name,
        series: suggestion.series || null,
        category: suggestion.category,
        currency: 'EUR',
        is_public: true
      })

    if (productError) return setMessage(productError.message)

    const { error: statusError } = await supabase
      .from('product_suggestions')
      .update({ status: 'approved' })
      .eq('id', suggestion.id)

    if (statusError) return setMessage(statusError.message)

    setMessage('Produit ajouté au catalogue.')
    await load()
  }

  async function reject(id) {
    const { error } = await supabase
      .from('product_suggestions')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) return setMessage(error.message)

    setMessage('Proposition refusée.')
    await load()
  }

  async function addObservation(e) {
    e.preventDefault()

    if (!observation.product_id || !observation.price || !observation.source.trim()) {
      setMessage('Choisis un produit, une source et un prix.')
      return
    }

    const observedAt = observation.observed_at
      ? new Date(observation.observed_at + 'T12:00:00').toISOString()
      : new Date().toISOString()

    const payload = {
      product_id: observation.product_id,
      source: observation.source.trim(),
      price: Number(observation.price),
      observed_at: observedAt,
      condition_tier: observation.condition_tier,
      observation_type: observation.observation_type
    }

    const { error } = await supabase
      .from('product_price_history')
      .insert(payload)

    if (error) return setMessage(error.message)

    setObservation(emptyObservation)
    setMessage(
      observation.observation_type === 'confirmed_sale'
        ? 'Vente enregistrée. La cote a été recalculée automatiquement.'
        : 'Prix d’annonce enregistré sans modifier la cote.'
    )
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
  const noPrice = products.filter(product => product.current_value === null)
  const staleLimit = Date.now() - 30 * 24 * 60 * 60 * 1000
  const stale = products.filter(product =>
    product.current_value !== null &&
    (!product.price_updated_at || new Date(product.price_updated_at).getTime() < staleLimit)
  )

  return (
    <main>
      <section className="catalogHero">
        <span className="eyebrow dark">Administration</span>
        <h1>Tableau de bord PokéValeur</h1>
        <p className="muted">
          Modère le catalogue et alimente les cotes à partir de ventes confirmées ou de prix observés.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="adminStats">
        <div><span>Produits</span><strong>{products.length}</strong></div>
        <div><span>Sans cote</span><strong>{noPrice.length}</strong></div>
        <div><span>Cote &gt; 30 jours</span><strong>{stale.length}</strong></div>
        <div><span>Propositions</span><strong>{pending.length}</strong></div>
      </section>

      <section className="panel adminPricePanel">
        <h2>Ajouter une donnée de marché</h2>
        <form className="adminPriceForm" onSubmit={addObservation}>
          <label>
            Produit
            <select
              required
              value={observation.product_id}
              onChange={e => setObservation({ ...observation, product_id:e.target.value })}
            >
              <option value="">Choisir un produit...</option>
              {products.map(product => (
                <option value={product.id} key={product.id}>
                  {product.name}{product.series ? ` — ${product.series}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            Source
            <input
              required
              value={observation.source}
              onChange={e => setObservation({ ...observation, source:e.target.value })}
              placeholder="GCC, Voggt, Whatnot, Vinted..."
            />
          </label>

          <label>
            Prix (€)
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={observation.price}
              onChange={e => setObservation({ ...observation, price:e.target.value })}
            />
          </label>

          <label>
            Date
            <input
              type="date"
              value={observation.observed_at}
              onChange={e => setObservation({ ...observation, observed_at:e.target.value })}
            />
          </label>

          <label>
            État
            <select
              value={observation.condition_tier}
              onChange={e => setObservation({ ...observation, condition_tier:e.target.value })}
            >
              <option value="standard">Marché standard</option>
              <option value="zero_defect">Zéro défaut</option>
              <option value="light_defect">Défaut léger</option>
            </select>
          </label>

          <label>
            Type de donnée
            <select
              value={observation.observation_type}
              onChange={e => setObservation({ ...observation, observation_type:e.target.value })}
            >
              <option value="confirmed_sale">Vente confirmée</option>
              <option value="observed_listing">Prix d’annonce observé</option>
            </select>
          </label>

          <button className="btn" type="submit">Enregistrer la donnée</button>
        </form>
        <p className="muted adminHint">
          Une vente confirmée recalcule automatiquement la médiane de la cote correspondante.
          Une annonce observée est conservée à titre indicatif sans modifier la cote.
        </p>
      </section>

      <section className="adminTwoColumns">
        <div className="panel">
          <h2>Produits sans cote</h2>
          <div className="adminSimpleList">
            {noPrice.length === 0 ? <p>Aucun.</p> : noPrice.map(product => (
              <a href={`/catalogue/${product.id}`} key={product.id}>
                <span>{product.name}</span>
                <b>À renseigner</b>
              </a>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Cotes à rafraîchir</h2>
          <div className="adminSimpleList">
            {stale.length === 0 ? <p>Aucune.</p> : stale.map(product => (
              <a href={`/catalogue/${product.id}`} key={product.id}>
                <span>{product.name}</span>
                <b>
                  {product.price_updated_at
                    ? new Date(product.price_updated_at).toLocaleDateString('fr-FR')
                    : 'Jamais'}
                </b>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="listHeader">
          <h2>Propositions en attente</h2>
          <span className="adminCount">{pending.length}</span>
        </div>

        <div className="adminSuggestionList">
          {pending.length === 0 ? (
            <p>Aucune proposition en attente.</p>
          ) : pending.map(item => (
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
                <button className="miniBtn primaryMini" onClick={() => approve(item)}>Accepter</button>
                <button className="miniBtn dangerMini" onClick={() => reject(item.id)}>Refuser</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel adminHistory">
        <h2>Historique des propositions</h2>
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
