'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './page.module.css'

const PAGE_SIZE = 50

function formatDate(value) {
  if (!value) return 'Jamais connecté'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function displaySeries(code, name) {
  const shownCode = (code || '').toLowerCase() === 'swsh7' ? 'EB07' : (code || '').toUpperCase()
  return [shownCode, name].filter(Boolean).join(' · ') || 'Série inconnue'
}

function groupedActivity(rows, accountCreatedAt) {
  const groups = new Map()
  for (const row of rows || []) {
    const summary = row.summary || {}
    const groupKey = [row.transaction_key, row.event_type, row.entity_type, row.entity_id, summary.collection || ''].join(':')
    const existing = groups.get(groupKey)
    if (existing && ['card_added', 'card_removed'].includes(row.event_type)) {
      existing.quantity += 1
    } else if (!existing) {
      groups.set(groupKey, { ...row, summary, quantity: 1 })
    }
  }
  const events = [...groups.values()]
  if (accountCreatedAt) events.push({ event_id: 'account-created', occurred_at: accountCreatedAt, event_type: 'account_created', summary: {} })
  return events.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
}

function eventTitle(event) {
  const labels = {
    account_created: 'Compte créé',
    card_added: 'Carte ajoutée',
    card_removed: 'Carte retirée',
    card_updated: 'Carte modifiée',
    sealed_added: 'Produit ajouté à la collection',
    sealed_removed: 'Produit retiré de la collection',
    sealed_quantity_changed: 'Quantité modifiée',
    collection_created: 'Collection créée',
    collection_deleted: 'Collection supprimée'
  }
  return labels[event.event_type] || 'Action enregistrée'
}

function eventDescription(event) {
  const { summary = {} } = event
  if (event.event_type === 'card_added' || event.event_type === 'card_removed' || event.event_type === 'card_updated') {
    const card = [summary.number ? `N° ${summary.number}` : '', summary.card || 'Carte'].filter(Boolean).join(' · ')
    const variant = summary.variant ? ` · ${summary.variant}` : ''
    const qty = event.quantity > 1 ? ` · ${event.quantity} exemplaires` : ''
    const collection = summary.collection ? ` · ${summary.collection}` : ''
    const series = displaySeries(summary.series_code, summary.series)
    return `${series} · ${card}${variant}${qty}${collection}`
  }
  if (event.event_type === 'sealed_quantity_changed') {
    return `${summary.product || 'Produit'} · ${summary.quantity_before ?? '—'} → ${summary.quantity_after ?? '—'}${summary.collection ? ` · ${summary.collection}` : ''}`
  }
  if (event.event_type === 'sealed_added' || event.event_type === 'sealed_removed') {
    return `${summary.product || 'Produit'} · quantité ${summary.quantity ?? 1}${summary.series ? ` · ${summary.series}` : ''}${summary.collection ? ` · ${summary.collection}` : ''}`
  }
  if (event.event_type === 'collection_created' || event.event_type === 'collection_deleted') {
    return [summary.collection, summary.type === 'child' ? 'profil famille' : 'collection principale'].filter(Boolean).join(' · ')
  }
  return 'Inscription au site'
}

export default function AdminUsersPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [activity, setActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = useCallback(async (nextOffset = 0, query = '') => {
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_list_users', {
      p_limit: PAGE_SIZE,
      p_offset: nextOffset,
      p_search: query.trim() || null
    })
    if (rpcError) {
      setError('Impossible de charger les comptes. Réessaie dans un instant.')
      setUsers([])
      setTotal(0)
      return
    }
    const rows = data || []
    setUsers(rows)
    setTotal(Number(rows[0]?.total_count || 0))
    setOffset(nextOffset)
  }, [supabase])

  useEffect(() => {
    let active = true
    async function initialize() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!active) return
      if (authError || !user) {
        window.location.replace('/login?next=%2Fadmin%2Futilisateurs')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!active) return
      if (!profile?.is_admin) {
        setLoading(false)
        setIsAdmin(false)
        return
      }
      setIsAdmin(true)
      const { data: stats, error: statsError } = await supabase.rpc('admin_user_overview')
      if (!active) return
      if (statsError) setError('Impossible de charger les statistiques des comptes.')
      else setOverview(stats?.[0] || null)
      await loadUsers(0, '')
      if (active) setLoading(false)
    }
    initialize().catch(() => { if (active) { setError('Une erreur a empêché le chargement des comptes.'); setLoading(false) } })
    return () => { active = false }
  }, [supabase, loadUsers])

  async function openUser(user) {
    if (selectedId === user.user_id) {
      setSelectedId('')
      setActivity([])
      return
    }
    setSelectedId(user.user_id)
    setLoadingActivity(true)
    setActivity([])
    const { data, error: activityError } = await supabase.rpc('admin_user_activity', {
      p_user_id: user.user_id,
      p_limit: 100
    })
    if (activityError) setError('Impossible de charger l’historique de ce compte.')
    else setActivity(groupedActivity(data || [], user.account_created_at))
    setLoadingActivity(false)
  }

  async function applySearch(event) {
    event.preventDefault()
    const query = search.trim()
    setAppliedSearch(query)
    setSelectedId('')
    setActivity([])
    await loadUsers(0, query)
  }

  async function changePage(nextOffset) {
    setSelectedId('')
    setActivity([])
    await loadUsers(nextOffset, appliedSearch)
  }

  if (loading) return <main className={styles.page}><section className={styles.panel}><p>Chargement des comptes…</p></section></main>
  if (!isAdmin) return <main className={styles.page}><section className={styles.panel}><h1>Accès réservé</h1><p>Cette page est réservée à l’administration.</p><a href="/admin">Retour à l’administration</a></section></main>

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}><a href="/admin">← Administration</a><span>Utilisateurs</span></div>
      <header className={styles.header}>
        <p className={styles.kicker}>Administration · Membres</p>
        <h1>Utilisateurs et activité</h1>
        <p>Consulte les inscriptions, les dernières connexions et les principales actions réalisées sur le site.</p>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.stats} aria-label="Vue d’ensemble des comptes">
        <article><span>Comptes créés</span><strong>{overview?.accounts_total ?? '—'}</strong></article>
        <article><span>Inscriptions · 7 derniers jours</span><strong>{overview?.accounts_last_7_days ?? '—'}</strong></article>
        <article><span>Connectés · 30 derniers jours</span><strong>{overview?.active_last_30_days ?? '—'}</strong></article>
      </section>

      <form className={styles.search} onSubmit={applySearch}>
        <label htmlFor="user-search">Rechercher un compte par e-mail ou pseudo</label>
        <div><input id="user-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="E-mail ou pseudo…" /><button type="submit">Rechercher</button></div>
      </form>

      <section className={styles.list} aria-label="Comptes membres">
        {!users.length && <p className={styles.empty}>{appliedSearch ? 'Aucun compte ne correspond à cette recherche.' : 'Aucun compte à afficher.'}</p>}
        {users.map(user => {
          const expanded = selectedId === user.user_id
          return (
            <article className={`${styles.user} ${expanded ? styles.expanded : ''}`} key={user.user_id}>
              <button type="button" className={styles.userButton} aria-expanded={expanded} onClick={() => openUser(user)}>
                <span className={styles.identity}><strong>{user.display_name || 'Collectionneur'}</strong><span>{user.email || 'E-mail indisponible'}</span></span>
                <span className={styles.userMeta}><span>Inscription {formatDate(user.account_created_at)}</span><span>Connexion {formatDate(user.last_sign_in_at)}</span></span>
                <span className={styles.counts}><span>{user.collection_count} collections</span><span>{user.card_copy_count} cartes · {user.sealed_quantity} produits</span></span>
                <span className={styles.expandMark} aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>
              {expanded && (
                <div className={styles.detail}>
                  <div className={styles.detailHeading}><h2>Activité du compte</h2><p>Les connexions récentes sont indiquées ci-dessus. L’historique des actions commence à partir de l’activation du suivi.</p></div>
                  {loadingActivity ? <p className={styles.empty}>Chargement de l’historique…</p> : activity.length ? (
                    <ol className={styles.timeline}>
                      {activity.map(event => <li key={event.event_id}><span className={styles.dot} /><div><strong>{eventTitle(event)}</strong><p>{eventDescription(event)}</p><time dateTime={event.occurred_at}>{formatDate(event.occurred_at)}</time></div></li>)}
                    </ol>
                  ) : <p className={styles.empty}>Aucune action enregistrée pour le moment.</p>}
                </div>
              )}
            </article>
          )
        })}
      </section>

      <footer className={styles.pagination}>
        <span>{total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} sur ${total} comptes` : '0 compte'}</span>
        <div><button type="button" disabled={offset === 0} onClick={() => changePage(Math.max(offset - PAGE_SIZE, 0))}>Précédent</button><button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => changePage(offset + PAGE_SIZE)}>Suivant</button></div>
      </footer>
      <p className={styles.privacy}>Les détails d’action affichés ici se limitent aux ajouts, retraits et changements de quantité. Les prix, notes privées et photos des collections ne sont pas suivis.</p>
    </main>
  )
}
