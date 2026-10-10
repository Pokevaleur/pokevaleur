'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './page.module.css'

function displayCode(code) {
  return (code || '').toLowerCase() === 'swsh7' ? 'EB07' : (code || '').toUpperCase()
}

export default function AdminCardCatalogPage() {
  const supabase = useMemo(() => createClient(), [])
  const [sets, setSets] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.replace('/login?next=%2Fadmin%2Fcatalogue-cartes')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (cancelled) return
      if (!profile?.is_admin) { setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)
      const { data, error: loadError } = await supabase.from('card_sets')
        .select('id,set_name,set_code,language,release_date,advertised_card_count,checklist_scope_note,is_public')
        .order('release_date', { ascending: false }).order('set_name')
      if (cancelled) return
      if (loadError) setError('Impossible de charger les séries du catalogue.')
      else {
        setSets(data || [])
        setDrafts(Object.fromEntries((data || []).map(set => [set.id, { set_name: set.set_name || '', checklist_scope_note: set.checklist_scope_note || '', is_public: set.is_public } ])))
      }
      setLoading(false)
    }
    load().catch(() => { if (!cancelled) setError('Une erreur a empêché le chargement du catalogue.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase])

  async function saveSet(set) {
    if (savingId) return
    setSavingId(set.id)
    setNotice('')
    setError('')
    const draft = drafts[set.id]
    const { error: saveError } = await supabase.from('card_sets').update({
      set_name: draft.set_name.trim(),
      checklist_scope_note: draft.checklist_scope_note.trim() || null,
      is_public: Boolean(draft.is_public)
    }).eq('id', set.id)
    if (saveError) setError('Enregistrement refusé : ' + saveError.message)
    else {
      setSets(current => current.map(row => row.id === set.id ? { ...row, ...draft } : row))
      setNotice(displayCode(set.set_code) + ' — ' + draft.set_name.trim() + ' enregistré.')
    }
    setSavingId('')
  }

  function changeDraft(id, key, value) {
    setDrafts(current => ({ ...current, [id]: { ...current[id], [key]: value } }))
  }

  const filtered = sets.filter(set => (displayCode(set.set_code) + ' ' + set.set_name).toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')))

  if (loading) return <main className={styles.page}><p>Chargement des séries…</p></main>
  if (!isAdmin) return <main className={styles.page}><section className={styles.panel}><h1>Accès réservé</h1><p>Cette page est réservée à l’administration.</p><a href="/admin">Retour à l’administration</a></section></main>

  return <main className={styles.page}>
    <div className={styles.breadcrumb}><a href="/admin">← Administration</a><span>Catalogue cartes</span></div>
    <header className={styles.header}>
      <p className={styles.kicker}>Admin · Catalogue de référence</p>
      <h1>Gérer les séries de cartes</h1>
      <p>Vérifie les séries, leur nom affiché et leur publication. Les codes sources restent inchangés ; SWSH7 s’affiche sous l’abréviation EB07.</p>
    </header>
    <label className={styles.search}>Rechercher une série<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom ou code de série…" /></label>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.list} aria-label="Séries du catalogue">
      {filtered.map(set => {
        const draft = drafts[set.id] || {}
        return <article className={styles.row} key={set.id}>
          <div className={styles.rowHeading}>
            <div><strong>{displayCode(set.set_code) || 'Sans code'} <span>—</span> {set.set_name}</strong><small>{set.language || 'FR'} · {set.advertised_card_count ?? '—'} cartes annoncées</small></div>
            <a href={'/catalogue/cartes?set=' + encodeURIComponent(set.id)}>Ouvrir le Catalogue →</a>
          </div>
          <label>Nom de la série<input value={draft.set_name || ''} onChange={event => changeDraft(set.id, 'set_name', event.target.value)} /></label>
          <label>Périmètre du checklist<textarea rows="2" value={draft.checklist_scope_note || ''} onChange={event => changeDraft(set.id, 'checklist_scope_note', event.target.value)} placeholder="Précise les cartes incluses dans le Master Set…" /></label>
          <div className={styles.rowFooter}>
            <label className={styles.publicToggle}><input type="checkbox" checked={Boolean(draft.is_public)} onChange={event => changeDraft(set.id, 'is_public', event.target.checked)} /> Publier cette série dans le Catalogue</label>
            <button type="button" disabled={savingId === set.id || !draft.set_name?.trim()} onClick={() => saveSet(set)}>{savingId === set.id ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </article>
      })}
      {!filtered.length && <p className={styles.empty}>Aucune série ne correspond à cette recherche.</p>}
    </section>
  </main>
}
