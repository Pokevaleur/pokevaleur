'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './page.module.css'

const ACTIVE_PREFIX = 'PokéValeur priorité · Vente confirmée · '
const INACTIVE_PREFIX = 'Vente confirmée saisie · '
const SALE_SOURCES = ['eBay', 'Cardmarket', 'Vinted', 'Leboncoin', 'Autre']

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatPrice(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value))
}

function saleSource(row) {
  return String(row?.source || '').replace(ACTIVE_PREFIX, '').replace(INACTIVE_PREFIX, '')
}

export default function AdminCardPricesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [variants, setVariants] = useState([])
  const [salesByVariant, setSalesByVariant] = useState({})
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/login?next=%2Fadmin%2Fcotes-cartes'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!active) return
      if (!profile?.is_admin) { setLoading(false); return }
      setIsAdmin(true)
      setLoading(false)
    })().catch(() => { if (active) { setError('Impossible de vérifier les droits d’accès.'); setLoading(false) } })
    return () => { active = false }
  }, [supabase])

  async function searchCards(event) {
    event?.preventDefault()
    const term = query.trim()
    if (!term) { setResults([]); return }
    setSearching(true)
    setNotice('')
    setError('')
    const safeTerm = term.replace(/[%,()]/g, ' ').trim()
    const { data, error: searchError } = await supabase.from('cards')
      .select('id,card_set_id,card_name,collector_number,image_url,rarity_label')
      .or(`card_name.ilike.%${safeTerm}%,collector_number.ilike.%${safeTerm}%`)
      .order('card_name').limit(40)
    if (searchError) setError('La recherche des cartes a échoué : ' + searchError.message)
    else {
      const setIds = [...new Set((data || []).map(card => card.card_set_id).filter(Boolean))]
      const { data: sets } = setIds.length
        ? await supabase.from('card_sets').select('id,set_name,set_code,language').in('id', setIds)
        : { data: [] }
      const setsById = new Map((sets || []).map(set => [set.id, set]))
      setResults((data || []).map(card => ({ ...card, set: setsById.get(card.card_set_id) || null })))
      setSelectedCard(null)
      setVariants([])
      setSalesByVariant({})
    }
    setSearching(false)
  }

  async function chooseCard(card) {
    setSelectedCard(card)
    setNotice('')
    setError('')
    const { data, error: variantError } = await supabase.from('card_print_variants')
      .select('id,variant_key,variant_label,finish_code,is_master_set_target')
      .eq('card_id', card.id)
      .order('is_master_set_target', { ascending: false })
      .order('variant_label')
    if (variantError) { setError('Impossible de charger les variantes : ' + variantError.message); return }
    const nextVariants = data || []
    setVariants(nextVariants)
    setDrafts(Object.fromEntries(nextVariants.map(variant => [variant.id, { amount: '', source: 'eBay', sourceUrl: '', date: localToday() }])))
    if (!nextVariants.length) { setSalesByVariant({}); return }
    const { data: sales, error: salesError } = await supabase.from('card_price_observations')
      .select('id,card_print_variant_id,amount,currency,source,source_url,observed_at')
      .in('card_print_variant_id', nextVariants.map(variant => variant.id))
      .eq('price_kind', 'raw').eq('observation_type', 'confirmed_sale')
      .like('source', `${ACTIVE_PREFIX}%`)
      .order('observed_at', { ascending: false })
    if (salesError) { setError('Impossible de charger les ventes prioritaires : ' + salesError.message); return }
    const grouped = {}
    for (const sale of sales || []) (grouped[sale.card_print_variant_id] ||= []).push(sale)
    setSalesByVariant(grouped)
  }

  function updateDraft(variantId, key, value) {
    setDrafts(current => ({ ...current, [variantId]: { ...current[variantId], [key]: value } }))
  }

  async function saveSale(variant) {
    const draft = drafts[variant.id] || {}
    const amount = Number(String(draft.amount || '').replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0 || !draft.date || !draft.source) {
      setError('Indique un prix positif, une source et la date de vente.')
      return
    }
    setBusyId(variant.id)
    setNotice('')
    setError('')
    const previousRows = salesByVariant[variant.id] || []
    async function restorePreviousPriority() {
      let restoreError = null
      for (const row of previousRows) {
        const { error: result } = await supabase.from('card_price_observations')
          .update({ source: ACTIVE_PREFIX + saleSource(row) })
          .eq('id', row.id)
        if (result) { restoreError = result; break }
      }
      return restoreError
    }
    let demoteError = null
    for (const row of previousRows) {
      const { error: updateError } = await supabase.from('card_price_observations')
        .update({ source: INACTIVE_PREFIX + saleSource(row) })
        .eq('id', row.id)
      if (updateError) { demoteError = updateError; break }
    }
    if (demoteError) {
      const restoreError = await restorePreviousPriority()
      setError('La vente prioritaire précédente n’a pas pu être remplacée : ' + demoteError.message + (restoreError ? ' La restauration de l’ancienne priorité a aussi échoué.' : ''))
      setBusyId('')
      return
    }
    const observedAt = new Date(`${draft.date}T12:00:00`).toISOString()
    const { error: insertError } = await supabase.from('card_price_observations').insert({
      card_print_variant_id: variant.id,
      price_kind: 'raw',
      observation_type: 'confirmed_sale',
      amount,
      currency: 'EUR',
      source: ACTIVE_PREFIX + draft.source,
      source_url: draft.sourceUrl.trim() || null,
      observed_at: observedAt
    })
    if (insertError) {
      const restoreError = await restorePreviousPriority()
      setError('Enregistrement refusé : ' + insertError.message + (restoreError ? ' La restauration de l’ancienne priorité a aussi échoué.' : ''))
    }
    else {
      await chooseCard(selectedCard)
      setNotice(`${selectedCard.card_name} · ${variant.variant_label || variant.finish_code || 'variante'} : vente à ${formatPrice(amount)} enregistrée et utilisée comme cote PokéValeur.`)
    }
    setBusyId('')
  }

  async function removePriority(variant) {
    const currentRows = salesByVariant[variant.id] || []
    if (!currentRows.length) return
    setBusyId(variant.id)
    setNotice('')
    setError('')
    let updateError = null
    for (const row of currentRows) {
      const { error: result } = await supabase.from('card_price_observations')
        .update({ source: INACTIVE_PREFIX + saleSource(row) })
        .eq('id', row.id)
      if (result) { updateError = result; break }
    }
    if (updateError) setError('Impossible de retirer la priorité : ' + updateError.message)
    else {
      await chooseCard(selectedCard)
      setNotice('La cote automatique reprend la priorité. La vente confirmée reste conservée dans l’historique.')
    }
    setBusyId('')
  }

  if (loading) return <main className={styles.page}><p>Chargement…</p></main>
  if (!isAdmin) return <main className={styles.page}><section className={styles.panel}><h1>Accès réservé</h1><p>Cette page est réservée à l’administration.</p><a href="/admin">Retour à l’administration</a></section></main>

  return <main className={styles.page}>
    <div className={styles.breadcrumb}><a href="/admin">← Administration</a><span>Cotes des cartes</span></div>
    <header className={styles.header}>
      <p className={styles.kicker}>Admin · Cartes</p>
      <h1>Ventes confirmées et cotes prioritaires</h1>
      <p>Enregistre le prix réellement payé pour une carte. Tu peux donner la priorité à cette vente pour remplacer la cote PokéValeur automatique sur cette variante. La source, la date et le lien restent associés à la vente.</p>
    </header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <form className={styles.search} onSubmit={searchCards}>
      <label htmlFor="card-search">Rechercher une carte par nom ou numéro</label>
      <div><input id="card-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pomdorochi ou 188" /><button disabled={searching || !query.trim()}>{searching ? 'Recherche…' : 'Rechercher'}</button></div>
    </form>
    {results.length > 0 && <section className={styles.results} aria-label="Résultats de recherche">
      <h2>Résultats ({results.length})</h2>
      {results.map(card => <button type="button" className={selectedCard?.id === card.id ? styles.cardSelected : styles.cardResult} key={card.id} onClick={() => chooseCard(card)}>
        {card.image_url ? <img src={card.image_url} alt="" /> : <span className={styles.imagePlaceholder}>Carte</span>}
        <span><strong>{card.card_name}</strong><small>{card.collector_number} · {card.set?.set_name || 'Série inconnue'} · {card.set?.language || 'FR'}</small></span>
        <b>{selectedCard?.id === card.id ? 'Sélectionnée' : 'Choisir'}</b>
      </button>)}
    </section>}
    {selectedCard && <section className={styles.selected}>
      <h2>{selectedCard.card_name} · {selectedCard.collector_number}</h2>
      <p>{selectedCard.set?.set_name} · {selectedCard.set?.language || 'FR'}. Une vente prioritaire remplace la cote pour la variante sélectionnée et reste visible dans l’historique des ventes observées.</p>
      {variants.map(variant => {
        const rows = salesByVariant[variant.id] || []
        const active = rows[0]
        const draft = drafts[variant.id] || {}
        return <article className={styles.variant} key={variant.id}>
          <div className={styles.variantHeading}><strong>{variant.variant_label || variant.variant_key || variant.finish_code || 'Variante'}</strong><small>{variant.finish_code || 'Finition non précisée'}{variant.is_master_set_target ? ' · variante suivie au catalogue' : ''}</small></div>
          {active && <div className={styles.activeOverride}><span>Vente prioritaire : <b>{formatPrice(active.amount)}</b> · {saleSource(active)} · {new Date(active.observed_at).toLocaleDateString('fr-FR')}</span><button type="button" disabled={busyId === variant.id} onClick={() => removePriority(variant)}>Retirer la priorité</button></div>}
          <div className={styles.fields}>
            <label>Prix payé (€)<input inputMode="decimal" value={draft.amount} onChange={event => updateDraft(variant.id, 'amount', event.target.value)} placeholder="12,00" /></label>
            <label>Source<select value={draft.source} onChange={event => updateDraft(variant.id, 'source', event.target.value)}>{SALE_SOURCES.map(source => <option key={source}>{source}</option>)}</select></label>
            <label>Date de la vente<input type="date" value={draft.date || ''} onChange={event => updateDraft(variant.id, 'date', event.target.value)} /></label>
            <label className={styles.urlField}>Lien de la vente (facultatif)<input type="url" value={draft.sourceUrl} onChange={event => updateDraft(variant.id, 'sourceUrl', event.target.value)} placeholder="https://…" /></label>
            <button type="button" disabled={busyId === variant.id} onClick={() => saveSale(variant)}>{busyId === variant.id ? 'Enregistrement…' : 'Enregistrer et utiliser cette cote'}</button>
          </div>
        </article>
      })}
      {!variants.length && <p>Aucune variante de carte n’est associée à cette fiche.</p>}
    </section>}
    {!results.length && query.trim() && !searching && <p className={styles.empty}>Aucun résultat. Essaie le nom complet ou le numéro de collection.</p>}
  </main>
}
