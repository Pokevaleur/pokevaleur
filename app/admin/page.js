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

function normalizeMarketText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesSealedMarketSearch(product, query) {
  const normalizedQuery = normalizeMarketText(query).replace(/\bme\s*0?6\b/g, 'me06')
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const name = normalizeMarketText(product.name)
  const series = normalizeMarketText(product.series)
  const type = normalizeMarketText(product.product_type)
  const allText = name + ' ' + series + ' ' + type

  return tokens.every(token => {
    if (token === 'etb') return type === 'etb'
    if (token === 'me') return series.includes('mega evolution')
    if (token === 'me06') return series.includes('mega evolution') && series.includes('regne delta')
    return allText.includes(token)
  })
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [products, setProducts] = useState([])
  const [productKind, setProductKind] = useState('sealed')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketResults, setMarketResults] = useState([])
  const [marketSearchLoading, setMarketSearchLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [cardVariants, setCardVariants] = useState([])
  const [cardVariantsLoading, setCardVariantsLoading] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [cardCondition, setCardCondition] = useState('near_mint')
  const [history, setHistory] = useState([])
  const [observation, setObservation] = useState(emptyObservation)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [reportedMessages, setReportedMessages] = useState([])
  const [communityStatuses, setCommunityStatuses] = useState([])

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!products.length) return
    const params = new URLSearchParams(window.location.search)
    const productId = params.get('product')
    if (!productId || !products.some(product => product.id === productId)) return

    const selectedProduct = products.find(product => product.id === productId)
    setProductKind(selectedProduct?.category === 'sealed' ? 'sealed' : 'card')
    setObservation(current => ({ ...current, product_id: productId }))
    window.history.replaceState({}, '', '/admin#donnee-marche')
    window.requestAnimationFrame(() => {
      document.getElementById('donnee-marche')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [products])

  useEffect(() => {
    const term = marketSearch.trim()
    if (term.length < 2) {
      setMarketResults([])
      setMarketSearchLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setMarketSearchLoading(true)
      if (productKind === 'sealed') {
        const matches = products
          .filter(product => product.category === 'sealed' && matchesSealedMarketSearch(product, term))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
          .slice(0, 30)
        if (cancelled) return
        setMarketResults(matches)
        setMarketSearchLoading(false)
        return
      }

      const pattern = `%${term.replace(/[%,_]/g, ' ')}%`
      const { data, error } = await supabase.from('cards')
        .select('id,card_set_id,collector_number,card_name,card_sets!cards_card_set_id_fkey!inner(set_name,set_code,is_public)')
        .eq('card_sets.is_public', true)
        .ilike('card_name', pattern)
        .order('card_name')
        .limit(30)
      if (cancelled) return
      setMarketResults(error ? [] : data || [])
      setMarketSearchLoading(false)
      if (error) setMessage(`Recherche impossible : ${error.message}`)
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [marketSearch, productKind, products, supabase])

  useEffect(() => {
    if (!selectedCard) {
      setCardVariants([])
      setSelectedVariant(null)
      return
    }
    let cancelled = false
    async function loadVariants() {
      setCardVariantsLoading(true)
      const { data, error } = await supabase.from('card_print_variants')
        .select('id,variant_label,variant_key,finish_code')
        .eq('card_id', selectedCard.id)
        .order('variant_label')
      if (cancelled) return
      setCardVariants(error ? [] : data || [])
      setSelectedVariant(null)
      setCardVariantsLoading(false)
      if (error) setMessage(`Variantes de carte indisponibles : ${error.message}`)
    }
    loadVariants()
    return () => { cancelled = true }
  }, [selectedCard, supabase])

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
      const [{ data: suggestionData }, { data: productData }, { data: historyData }, { data: reportData }, { data: statusData }] = await Promise.all([
        supabase.from('product_suggestions').select('*').order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id,name,series,category,product_type,current_value,zero_defect_value,price_updated_at,zero_defect_updated_at')
          .eq('is_public', true)
          .order('name'),
        supabase
          .from('product_price_history')
          .select('id,product_id,source,price,observed_at,condition_tier,observation_type')
          .order('observed_at', { ascending: false }),
        supabase
          .from('community_reports')
          .select('id,reporter_id,message_id,reason,status,created_at')
          .order('created_at', { ascending:false }),
        supabase
          .from('community_user_status')
          .select('user_id,suspended_until,reason,updated_at')
          .order('updated_at', { ascending:false })
      ])

      setSuggestions(suggestionData || [])
      setProducts(productData || [])
      setHistory(historyData || [])
      const reportRows = reportData || []
      setReports(reportRows)
      setCommunityStatuses(statusData || [])
      if (reportRows.length) {
        const ids = [...new Set(reportRows.map(r => r.message_id))]
        const { data: messageRows } = await supabase
          .from('community_messages')
          .select('id,user_id,author_name,body,created_at,is_hidden')
          .in('id', ids)
        setReportedMessages(messageRows || [])
      } else {
        setReportedMessages([])
      }
    }

    setLoading(false)
  }

  async function moderateMessage(messageId, hide) {
    const { error } = await supabase
      .from('community_messages')
      .update({ is_hidden: hide })
      .eq('id', messageId)
    if (error) return setMessage(error.message)
    setMessage(hide ? 'Message masqué.' : 'Message rétabli.')
    await load()
  }

  async function deleteCommunityMessage(messageId) {
    if (!window.confirm('Supprimer définitivement ce message ?')) return
    const { error } = await supabase.from('community_messages').delete().eq('id', messageId)
    if (error) return setMessage(error.message)
    setMessage('Message supprimé.')
    await load()
  }

  async function updateReportStatus(reportId, status) {
    const { error } = await supabase
      .from('community_reports')
      .update({ status })
      .eq('id', reportId)
    if (error) return setMessage(error.message)
    setMessage(status === 'reviewed' ? 'Signalement traité.' : 'Signalement classé.')
    await load()
  }

  async function suspendCommunityUser(userId, duration) {
    let suspendedUntil = null
    let reason = 'Suspension communautaire'
    if (duration === '24h') suspendedUntil = new Date(Date.now() + 24*60*60*1000).toISOString()
    if (duration === '7d') suspendedUntil = new Date(Date.now() + 7*24*60*60*1000).toISOString()
    if (duration === 'permanent') suspendedUntil = '9999-12-31T23:59:59.000Z'

    const { error } = await supabase.from('community_user_status').upsert({
      user_id:userId,
      suspended_until:suspendedUntil,
      reason,
      updated_at:new Date().toISOString()
    }, { onConflict:'user_id' })
    if (error) return setMessage(error.message)
    setMessage(duration ? 'Accès communautaire suspendu.' : 'Suspension communautaire levée.')
    await load()
  }

  async function addObservation(e) {
    e.preventDefault()

    const hasSelection = productKind === 'sealed' ? observation.product_id : selectedVariant?.id
    if (!hasSelection || !observation.price || !observation.source.trim()) {
      setMessage(productKind === 'sealed'
        ? 'Choisis un produit scellé, une source et un prix.'
        : 'Choisis une carte, sa variante, une source et un prix.')
      return
    }

    const observedAt = observation.observed_at
      ? new Date(observation.observed_at + 'T12:00:00').toISOString()
      : new Date().toISOString()

    const { error } = productKind === 'sealed'
      ? await supabase.from('product_price_history').insert({
        product_id: observation.product_id,
        source: observation.source.trim(),
        price: Number(observation.price),
        observed_at: observedAt,
        condition_tier: observation.condition_tier,
        observation_type: observation.observation_type
      })
      : await supabase.from('card_price_observations').insert({
        card_print_variant_id: selectedVariant.id,
        price_kind: 'raw',
        raw_condition: cardCondition,
        observation_type: observation.observation_type,
        amount: Number(observation.price),
        currency: 'EUR',
        source: observation.source.trim(),
        observed_at: observedAt
      })

    if (error) return setMessage(error.message)

    setObservation(emptyObservation)
    setMarketSearch('')
    setMarketResults([])
    setSelectedCard(null)
    setCardVariants([])
    setSelectedVariant(null)
    setMessage(
      productKind === 'card'
        ? 'Prix de carte enregistré.'
        : observation.observation_type === 'confirmed_sale'
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
  const pendingReports = reports.filter(r => r.status === 'pending')
  const reportedById = Object.fromEntries(reportedMessages.map(m => [m.id,m]))
  const treated = suggestions.filter(item => item.status !== 'pending')
  const noPrice = products.filter(product => product.current_value === null)
  const staleLimit = Date.now() - 30 * 24 * 60 * 60 * 1000
  const stale = products.filter(product =>
    product.current_value !== null &&
    (!product.price_updated_at || new Date(product.price_updated_at).getTime() < staleLimit)
  )
  const selectedSealedProduct = products.find(product => product.id === observation.product_id)

  function changeProductKind(kind) {
    if (kind === productKind) return
    setProductKind(kind)
    setObservation(current => ({ ...current, product_id: '' }))
    setMarketSearch('')
    setMarketResults([])
    setSelectedCard(null)
    setCardVariants([])
    setSelectedVariant(null)
  }

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

      <section className="panel partnerAdminShortcut"><div><span className="eyebrow dark">PARTENAIRES</span><h2>Cadeaux du coffre de Lukulu</h2><p className="muted">Crée les campagnes partenaires, importe leurs codes et surveille les stocks disponibles.</p></div><a className="btn" href="/admin-partenaires">Gérer les partenaires</a></section>

      <section className="panel partnerAdminShortcut"><div><span className="eyebrow dark">CARTES</span><h2>Séries du catalogue</h2><p className="muted">Vérifie le nom affiché, le périmètre du Master Set et la publication des séries de cartes.</p></div><a className="btn" href="/admin/catalogue-cartes">Gérer le catalogue cartes</a></section>

      <section className="panel partnerAdminShortcut"><div><span className="eyebrow dark">CONTENUS</span><h2>Guide PokéValeur et lexique</h2><p className="muted">Modifie les thèmes et les questions-réponses, enrichis le lexique et ajoute des illustrations.</p></div><a className="btn" href="/admin/guide">Gérer le guide</a></section>

      <section className="panel partnerAdminShortcut"><div><span className="eyebrow dark">PRODUITS SCELLÉS ET AUTRES</span><h2>Fiches du catalogue</h2><p className="muted">Corrige les informations des produits existants, dont leur type et le contenu des cases.</p></div><a className="btn" href="/admin/catalogue-produits">Modifier les fiches</a></section>

      <section className="panel partnerAdminShortcut"><div><span className="eyebrow dark">MEMBRES</span><h2>Utilisateurs et activité</h2><p className="muted">Consulte les inscriptions, les dernières connexions et les actions réalisées sur le site.</p></div><a className="btn" href="/admin/utilisateurs">Voir les utilisateurs</a></section>

      <section className="adminStats">
        <div><span>Produits</span><strong>{products.length}</strong></div>
        <div><span>Sans cote</span><strong>{noPrice.length}</strong></div>
        <div><span>Cote &gt; 30 jours</span><strong>{stale.length}</strong></div>
        <div><span>Propositions</span><strong>{pending.length}</strong></div>
        <div><span>Signalements</span><strong>{pendingReports.length}</strong></div>
      </section>

      <section className="panel adminPricePanel" id="donnee-marche">
        <h2>Ajouter une donnée de marché</h2>
        <p className="muted adminHint">Ce formulaire sert à ajouter un prix à un produit déjà présent dans le catalogue. Produit absent ? <a href="/catalogue#proposer-produit">Propose sa fiche au catalogue</a> ; elle sera vérifiée avant publication.</p>
        <form className="adminPriceForm" onSubmit={addObservation}>
          <fieldset className="adminProductKindPicker">
            <legend>Type de catalogue</legend>
            <button
              type="button"
              className={productKind === 'sealed' ? 'selected' : ''}
              aria-pressed={productKind === 'sealed'}
              onClick={() => changeProductKind('sealed')}
            >
              Produits scellés
            </button>
            <button
              type="button"
              className={productKind === 'card' ? 'selected' : ''}
              aria-pressed={productKind === 'card'}
              onClick={() => changeProductKind('card')}
            >
              Cartes
            </button>
          </fieldset>

          <div className="adminMarketPicker">
            <label htmlFor="admin-market-search">
              {productKind === 'sealed' ? 'Produit scellé' : 'Carte'}
              <input
                id="admin-market-search"
                type="search"
                autoComplete="off"
                value={marketSearch}
                onChange={e => setMarketSearch(e.target.value)}
                placeholder={productKind === 'sealed' ? 'Rechercher un produit par nom…' : 'Rechercher une carte par nom…'}
                aria-controls="admin-market-results"
              />
            </label>
            <p className="muted adminMarketSearchHint">Saisis au moins 2 caractères pour lancer la recherche.</p>
            {selectedSealedProduct && productKind === 'sealed' && (
              <div className="adminMarketSelected">
                <span>{selectedSealedProduct.name}{selectedSealedProduct.series ? ` — ${selectedSealedProduct.series}` : ''}</span>
                <button type="button" onClick={() => setObservation(current => ({ ...current, product_id: '' }))}>Changer</button>
              </div>
            )}
            {selectedCard && productKind === 'card' && (
              <div className="adminMarketSelected">
                <span>{selectedCard.card_name} · {selectedCard.collector_number} · {selectedCard.card_sets?.set_name}</span>
                <button type="button" onClick={() => { setSelectedCard(null); setSelectedVariant(null) }}>Changer</button>
              </div>
            )}
            {marketSearch.trim().length >= 2 && !selectedSealedProduct && !selectedCard && (
              <div className="adminMarketResults" id="admin-market-results" aria-live="polite">
                {marketSearchLoading ? <p className="muted">Recherche…</p> : marketResults.length === 0 ? <p className="muted">Aucun résultat pour cette recherche.</p> : marketResults.map(item => {
                  const cardSet = Array.isArray(item.card_sets) ? item.card_sets[0] : item.card_sets
                  const title = productKind === 'sealed' ? item.name : item.card_name
                  const detail = productKind === 'sealed'
                    ? item.series
                    : `${item.collector_number} · ${cardSet?.set_name || 'Série inconnue'}${cardSet?.set_code ? ` (${cardSet.set_code})` : ''}`
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => productKind === 'sealed'
                        ? setObservation(current => ({ ...current, product_id: item.id }))
                        : setSelectedCard({ ...item, card_sets: cardSet })}
                    >
                      <strong>{title}</strong>
                      {detail && <small>{detail}</small>}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedCard && productKind === 'card' && (
              <div className="adminCardVariants" aria-live="polite">
                <span>Variante à coter</span>
                {cardVariantsLoading ? <p className="muted">Chargement des variantes…</p> : cardVariants.length === 0 ? <p className="muted">Aucune variante disponible pour cette carte.</p> : cardVariants.map(variant => (
                  <button
                    type="button"
                    key={variant.id}
                    className={selectedVariant?.id === variant.id ? 'selected' : ''}
                    aria-pressed={selectedVariant?.id === variant.id}
                    onClick={() => setSelectedVariant(variant)}
                  >
                    {variant.variant_label}
                  </button>
                ))}
              </div>
            )}
          </div>

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

          {productKind === 'sealed' ? (
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
          ) : (
            <label>
              État de la carte
              <select value={cardCondition} onChange={e => setCardCondition(e.target.value)}>
                <option value="near_mint">Quasi neuve</option>
                <option value="excellent">Très bon état</option>
                <option value="good">Bon état</option>
                <option value="played">Jouée</option>
                <option value="damaged">Abîmée</option>
                <option value="unassessed">À évaluer</option>
              </select>
            </label>
          )}

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
          <details className="adminNoPriceDisclosure">
            <summary><span>Produits sans cote</span><b>{noPrice.length}</b></summary>
            <p className="muted">Cette liste regroupe les produits sans vente confirmée qui permette de calculer une cote. Ouvre une fiche, puis ajoute ici une vente vérifiée avec sa source, son prix et sa date. Un prix d’annonce reste indicatif et ne change pas la cote.</p>
            <div className="adminSimpleList">
              {noPrice.length === 0 ? <p>Aucun.</p> : noPrice.map(product => (
                <a href={`/admin?product=${encodeURIComponent(product.id)}#donnee-marche`} key={product.id}>
                  <span>{product.name}{product.series ? ` — ${product.series}` : ''}</span>
                  <b>Saisir une cote →</b>
                </a>
              ))}
            </div>
          </details>
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
                <a className="miniBtn primaryMini" href={`/messagerie?view=catalogue&suggestion=${encodeURIComponent(item.id)}`}>Vérifier dans la messagerie</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="listHeader">
          <h2>Modération communauté</h2>
          <span className="adminCount">{pendingReports.length}</span>
        </div>

        <div className="adminSuggestionList">
          {pendingReports.length === 0 ? (
            <p>Aucun signalement en attente.</p>
          ) : pendingReports.map(report => {
            const msg = reportedById[report.message_id]
            return (
              <article className="adminSuggestionCard" key={report.id}>
                <div>
                  <span className="catalogBadge">Signalement</span>
                  <h3>{msg?.author_name || 'Collectionneur'}</h3>
                  <p>{msg?.body || 'Message indisponible ou déjà supprimé.'}</p>
                  <p className="muted"><b>Motif :</b> {report.reason || 'Non précisé'}</p>
                  <small className="muted">
                    Signalé le {new Date(report.created_at).toLocaleString('fr-FR')}
                  </small>
                </div>

                <div className="adminActions">
                  {msg && (
                    <>
                      <button className="miniBtn" onClick={() => moderateMessage(msg.id, !msg.is_hidden)}>
                        {msg.is_hidden ? 'Rétablir' : 'Masquer'}
                      </button>
                      <button className="miniBtn dangerMini" onClick={() => deleteCommunityMessage(msg.id)}>Supprimer</button>
                      <button className="miniBtn" onClick={() => suspendCommunityUser(msg.user_id,'24h')}>Suspendre 24 h</button>
                      <button className="miniBtn" onClick={() => suspendCommunityUser(msg.user_id,'7d')}>Suspendre 7 jours</button>
                      <button className="miniBtn dangerMini" onClick={() => suspendCommunityUser(msg.user_id,'permanent')}>Suspendre définitivement</button>
                      <button className="miniBtn" onClick={() => suspendCommunityUser(msg.user_id,null)}>Lever suspension</button>
                    </>
                  )}
                  <button className="miniBtn primaryMini" onClick={() => updateReportStatus(report.id,'reviewed')}>Traité</button>
                  <button className="miniBtn" onClick={() => updateReportStatus(report.id,'dismissed')}>Classer</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Suspensions communautaires</h2>
        <div className="historyRows">
          {communityStatuses.length === 0 ? <p>Aucune suspension enregistrée.</p> : communityStatuses.map(status => (
            <div key={status.user_id}>
              <span>{status.user_id.slice(0,8)}…</span>
              <b>
                {status.suspended_until
                  ? new Date(status.suspended_until).getFullYear() >= 9999
                    ? 'Définitive'
                    : `Jusqu’au ${new Date(status.suspended_until).toLocaleString('fr-FR')}`
                  : 'Aucune suspension'}
              </b>
            </div>
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
