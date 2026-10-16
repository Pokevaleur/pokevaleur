'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { fetchAllRows } from '../../lib/supabase-pagination'
import styles from './page.module.css'

const notifyInbox = () => window.dispatchEvent(new Event('pokevaleur-inbox-updated'))
const formatDate = date => new Date(date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const normalizedProductName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, ' ').trim()
const safeHttpUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null } }

export default function MessagingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [threads, setThreads] = useState([])
  const [archived, setArchived] = useState(false)
  const [view, setView] = useState('inbox')
  const [selected, setSelected] = useState(null)
  const [threadData, setThreadData] = useState(null)
  const [messages, setMessages] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [recipient, setRecipient] = useState('')
  const [asTeam, setAsTeam] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [reports, setReports] = useState([])
  const [productSuggestions, setProductSuggestions] = useState([])
  const [suggestionAuthors, setSuggestionAuthors] = useState({})
  const [catalogueProducts, setCatalogueProducts] = useState([])
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(null)
  const [suggestionDraft, setSuggestionDraft] = useState(null)
  const [verifiedSuggestion, setVerifiedSuggestion] = useState(false)
  const selectedRef = useRef(null)
  const requestRef = useRef(0)
  const sendingRef = useRef(false)
  const clientRef = useRef(null)
  const messageArea = useRef(null)
  const shouldScroll = useRef(true)

  const api = useCallback(async (action, payload = {}) => {
    const { data, error } = await supabase.rpc('messaging', { p_action: action, p_payload: payload })
    if (error) throw new Error(error.message?.includes('Could not find') ? 'La messagerie sera bientôt disponible. Réessaie dans quelques instants.' : error.message)
    return data
  }, [supabase])

  const loadProductSuggestions = useCallback(async () => {
    const [{ data: suggestions, error: suggestionsError }, productResult] = await Promise.all([
      supabase.from('product_suggestions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      fetchAllRows(() => supabase.from('products')
        .select('id,name,series,category,product_type,case_reference,official_source_url,is_public')
        .eq('is_public', true).order('name'))
    ])
    if (suggestionsError) throw new Error('Impossible de charger les propositions de produits.')
    if (productResult.error) throw new Error('Impossible de charger le catalogue pour vérifier les doublons.')
    const rows = suggestions || []
    const authorIds = [...new Set(rows.map(item => item.user_id).filter(Boolean))]
    let authors = {}
    if (authorIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,display_name').in('id', authorIds)
      authors = Object.fromEntries((profiles || []).map(profile => [profile.id, profile.display_name || 'Collectionneur']))
    }
    setProductSuggestions(rows)
    setSuggestionAuthors(authors)
    setCatalogueProducts(productResult.data || [])
    return rows
  }, [supabase])

  const refreshInbox = useCallback(async () => {
    const [state, list] = await Promise.all([api('status'), api('inbox', { archived })])
    if (state?.is_admin) {
      const { count, error } = await supabase.from('product_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      setStatus({ ...state, catalogue_pending: error ? 0 : count || 0 })
    } else setStatus(state)
    setThreads(list || [])
  }, [api, archived, supabase])

  const loadThread = useCallback(async (id, beforeId = null) => {
    const request = ++requestRef.current
    if (!threadData || threadData.thread.id !== id) setThreadLoading(true)
    try {
      const data = await api('thread', { thread_id: id, before_id: beforeId })
      if (selectedRef.current !== id || request !== requestRef.current) return
      setThreadData(data)
      setMessages(current => [...new Map([...current, ...data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id))
      if (beforeId || shouldScroll.current) setHasOlder(data.messages.length === 50)
      if (!beforeId && data.messages.length && document.visibilityState === 'visible' && document.hasFocus()) {
        await api('read', { thread_id: id, last_id: data.messages[data.messages.length - 1].id })
        notifyInbox()
        await refreshInbox()
      }
    } catch (e) {
      if (selectedRef.current === id && request === requestRef.current) setError(e.message)
    } finally {
      if (request === requestRef.current) setThreadLoading(false)
    }
  }, [api, refreshInbox, threadData])
  const threadLoader = useRef(loadThread)
  useEffect(() => { threadLoader.current = loadThread }, [loadThread])

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.replace('/login?next=%2Fmessagerie')
    })
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.replace('/login?next=%2Fmessagerie'); return }
        const state = await api('status')
        if (!active) return
        setUser(user); setStatus(state)
        const params = new URLSearchParams(window.location.search)
        const target = params.get('to')
        if (target && /^[0-9a-f-]{36}$/i.test(target)) { setRecipient(target); setView('new') }
        if (params.get('view') === 'catalogue' && state.is_admin) {
          setView('catalogue')
          setSelectedSuggestionId(params.get('suggestion'))
        }
      } catch (e) { if (active) setError(e.message) }
      finally { if (active) setLoading(false) }
    }
    init()
    return () => { active = false; subscription.unsubscribe() }
  }, [api, supabase])

  useEffect(() => {
    if (!status?.active || !status.is_admin || view !== 'catalogue') return
    let active = true
    loadProductSuggestions().catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [loadProductSuggestions, status?.active, status?.is_admin, view])

  const selectedSuggestion = productSuggestions.find(item => item.id === selectedSuggestionId) || null
  useEffect(() => {
    if (!selectedSuggestion) { setSuggestionDraft(null); setVerifiedSuggestion(false); return }
    setSuggestionDraft({
      name: selectedSuggestion.name || '',
      series: selectedSuggestion.series || '',
      category: selectedSuggestion.category || 'sealed',
      product_type: '',
      release_date: '',
      release_period: '',
      reference_code: selectedSuggestion.reference_code || '',
      official_source_url: selectedSuggestion.source_url || '',
      image_url: '',
      image_source_url: '',
      image_credit: ''
    })
    setVerifiedSuggestion(false)
  }, [selectedSuggestion?.id])

  useEffect(() => {
    if (!status?.active) return
    let active = true
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      refreshInbox().catch(e => { if (active) setError(e.message) })
      if (selectedRef.current) threadLoader.current(selectedRef.current)
    }
    refresh()
    const timer = setInterval(refresh, 12000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [status?.active, refreshInbox])

  useEffect(() => {
    if (!status?.active || view !== 'new') return
    let active = true
    const timer = setTimeout(async () => {
      try {
        const data = await api('members', { search })
        let options = data || []
        if (status.is_admin && recipient && !options.some(item => item.id === recipient)) {
          const { data: target } = await supabase.from('profiles').select('id,display_name,is_admin').eq('id', recipient).maybeSingle()
          if (target) options = [target, ...options]
        }
        if (active) setMembers(options)
      } catch (e) { if (active) setError(e.message) }
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [api, search, status?.active, status?.is_admin, view, recipient, supabase])

  useEffect(() => {
    if (messages.length && shouldScroll.current && messageArea.current) {
      messageArea.current.scrollTop = messageArea.current.scrollHeight
      shouldScroll.current = false
    }
  }, [messages])

  async function run(action) {
    if (sendingRef.current) return
    sendingRef.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e.message) }
    finally { sendingRef.current = false; setBusy(false) }
  }
  function clearDraft() { setBody(''); setSubject(''); setPreview(null); clientRef.current = null }
  function changeView(next) {
    if (body.trim() && !window.confirm('Quitter ce message sans l’envoyer ?')) return false
    selectedRef.current = null; requestRef.current++; setSelected(null); setThreadData(null); setMessages([])
    setView(next); clearDraft(); setError(''); setNotice(''); setAsTeam(false); setThreadLoading(false)
    if (next === 'settings') run(async () => setBlocks(await api('blocks')))
    if (next === 'reports') run(async () => setReports(await api('reports')))
    return true
  }
  function openThread(id) {
    if (body.trim() && !window.confirm('Quitter ce message sans l’envoyer ?')) return
    selectedRef.current = id; setSelected(id); setView('inbox'); clearDraft(); setError(''); setNotice('')
    setThreadData(null); setMessages([]); shouldScroll.current = true
    threadLoader.current(id)
  }

  async function reviewSuggestion(e, action, productId = null) {
    e?.preventDefault()
    if (!selectedSuggestionId) return
    run(async () => {
      const payload = { suggestion_id: selectedSuggestionId }
      if (action === 'approve') Object.assign(payload, suggestionDraft || {}, { verified: verifiedSuggestion })
      if (productId) payload.product_id = productId
      const { error } = await supabase.rpc('review_product_suggestion', { p_action: action, p_payload: payload })
      if (error) throw new Error(error.message)
      setNotice(action === 'approve' ? 'Produit vérifié et ajouté au catalogue.' : action === 'link' ? 'Proposition reliée au produit déjà présent.' : 'Proposition refusée.')
      setSelectedSuggestionId(null)
      setSuggestionDraft(null)
      setVerifiedSuggestion(false)
      const pendingRows = await loadProductSuggestions()
      setStatus({ ...(await api('status')), catalogue_pending: pendingRows.length })
      notifyInbox()
    })
  }
  async function send(e) {
    e.preventDefault()
    run(async () => {
      if (!clientRef.current) clientRef.current = crypto.randomUUID()
      const payload = { body: body.trim(), subject: subject.trim(), client_id: clientRef.current }
      let action = 'send'
      if (view === 'announce') {
        if (!preview || preview.body !== body.trim() || preview.subject !== subject.trim()) return
        action = 'announce'; payload.expected_recipients = preview.recipients
      } else if (selected) payload.thread_id = selected
      else { payload.team = view === 'team' || (status.is_admin && asTeam); payload.recipient_id = recipient || null }
      const result = await api(action, payload)
      clearDraft(); setNotice('Message envoyé.'); notifyInbox()
      selectedRef.current = result.thread_id; setSelected(result.thread_id); setView('inbox'); setThreadData(null); setMessages([])
      shouldScroll.current = true
      await threadLoader.current(result.thread_id)
      await refreshInbox()
    })
  }
  const selectedThread = threads.find(t => t.id === selected)
  const composer = view === 'new' || view === 'team' || view === 'announce'
  const duplicateCandidates = suggestionDraft
    ? catalogueProducts.filter(item => {
      const requested = normalizedProductName(suggestionDraft.name)
      const existing = normalizedProductName(item.name)
      return requested && (existing.includes(requested) || requested.includes(existing))
    }).slice(0, 6)
    : []

  if (loading) return <main className={styles.page}><section className="panel"><h1>Messagerie</h1><p role="status">Chargement…</p></section></main>
  if (!status) return <main className={styles.page}><section className="panel"><h1>Messagerie</h1><p role="alert">{error || 'Impossible de charger la messagerie.'}</p><button className="btn" onClick={() => window.location.reload()}>Réessayer</button></section></main>
  if (!status.eligible) return <main className={styles.page}><section className="panel"><h1>Messagerie réservée aux adultes</h1><p>Seul le titulaire majeur du compte peut échanger. Les profils enfants et les comptes identifiés comme mineurs n’ont pas de messagerie.</p><a className="btn" href="/collection/accueil">Retour à ma collection</a></section></main>
  if (!status.active) return <main className={styles.page}><section className={`panel ${styles.activation}`}><span className="eyebrow dark">Échanges privés</span><h1>Bienvenue dans ta messagerie</h1><p>Écris aux autres collectionneurs et à Lukulu — l’équipe PokéValeur. Ton adresse mail reste privée.</p><label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Je confirme avoir au moins 18 ans et être le titulaire de ce compte.</label><p className="muted">Les profils enfants rattachés à une collection ne peuvent pas utiliser la messagerie. Reste respectueux, évite les envois répétés et signale les messages inappropriés. L’équipe peut consulter les messages que tu signales.</p>{error && <p role="alert" className={styles.error}>{error}</p>}<button className="btn" disabled={!confirmed || busy} onClick={() => run(async () => { await api('activate', { confirmed }); setStatus(await api('status')); notifyInbox() })}>{busy ? 'Activation…' : 'Ouvrir ma messagerie'}</button></section></main>

  return <main className={styles.page}>
    <header className={styles.heading}><div><span className="eyebrow dark">Entre collectionneurs</span><h1>Ma messagerie</h1><p>Des échanges privés, au cœur de ta collection.</p></div><span className={styles.total} aria-live="polite"><span>{status.unread} non lu{status.unread > 1 ? 's' : ''}</span>{status.is_admin && status.catalogue_pending > 0 && <span>{status.catalogue_pending} produit{status.catalogue_pending > 1 ? 's' : ''} à vérifier</span>}</span></header>
    <div className={styles.toolbar}>
      <button className="btn" onClick={() => changeView('new')}>Nouveau message</button>
      <button className="btn ghost" onClick={() => changeView('team')}>Écrire à Lukulu / à l’équipe</button>
      {status.is_admin && <button className="btn ghost" onClick={() => changeView('announce')}>Annonce à tous</button>}
      {status.is_admin && <button className="btn ghost" onClick={() => changeView('catalogue')}>Produits à vérifier{status.catalogue_pending ? ` (${status.catalogue_pending})` : ''}</button>}
      <button className="miniBtn" onClick={() => changeView('settings')}>Réglages</button>
      {status.is_admin && <button className="miniBtn" onClick={() => changeView('reports')}>Signalements</button>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={`${styles.workspace} ${selected || view !== 'inbox' ? styles.detailOpen : ''}`}>
      <aside className={styles.sidebar} aria-label="Conversations">
        <div className={styles.tabs}><button aria-pressed={!archived} onClick={() => { if (changeView('inbox')) setArchived(false) }}>Réception</button><button aria-pressed={archived} onClick={() => { if (changeView('inbox')) setArchived(true) }}>Archives</button></div>
        {!threads.length && <p className={styles.empty}>{archived ? 'Aucune conversation archivée.' : 'Aucun message pour le moment. Commence un échange !'}</p>}
        {threads.map(t => <button className={`${styles.thread} ${selected === t.id ? styles.current : ''}`} key={t.id} onClick={() => openThread(t.id)} aria-current={selected === t.id ? 'true' : undefined}>
          <span className={styles.threadTop}><strong>{t.correspondent}</strong>{t.unread > 0 && <span className={styles.count}>{t.unread}<span className={styles.srOnly}> non lus</span></span>}</span>
          {t.kind !== 'direct' && <small className={styles.badge}>{t.kind === 'announcement' ? 'Annonce de l’équipe' : 'Équipe PokéValeur'}</small>}
          <span className={styles.subject}>{t.subject}</span><span className={styles.preview}>{t.preview}</span><small>{formatDate(t.updated_at)}</small>
        </button>)}
      </aside>
      <section className={styles.content} aria-label="Détail de la conversation">
        {(selected || view !== 'inbox') && <button className={styles.back} onClick={() => changeView('inbox')}>← Mes conversations</button>}
        {view === 'inbox' && !selected && <div className={styles.welcome}><span aria-hidden="true">✉</span><h2>Un message rapproche les collectionneurs</h2><p>Choisis une conversation ou écris à un membre. L’équipe est aussi là pour t’aider.</p></div>}
        {view === 'catalogue' && status.is_admin && <section className={styles.settings}>
          <h2>Propositions de produits à vérifier</h2>
          <p>Une proposition reste privée jusqu’à sa vérification. Contrôle le produit, recherche un éventuel doublon et complète les informations avant publication.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!productSuggestions.length && <p className={styles.empty}>Aucune proposition en attente.</p>}
          {productSuggestions.map(item => <article className={styles.announcementPreview} key={item.id}>
            <div className={styles.conversationHeading}><div><strong>{item.name}</strong><p>{item.series || 'Série non renseignée'} · {item.category === 'sealed' ? 'Scellé' : item.category}</p></div><small>{formatDate(item.created_at)}</small></div>
            <p>Proposé par : {suggestionAuthors[item.user_id] || 'Collectionneur'}</p>
            {item.reference_code && <p><b>Code fourni :</b> {item.reference_code}</p>}
            {safeHttpUrl(item.source_url) && <p><b>Lien fourni :</b> <a href={safeHttpUrl(item.source_url)} target="_blank" rel="noreferrer">Ouvrir la source</a></p>}
            {item.notes && <p><b>Précisions :</b> {item.notes}</p>}
            <div className={styles.tools}>
              <button className="miniBtn" onClick={() => { setSelectedSuggestionId(item.id); setError(''); setNotice('') }}>Vérifier et compléter</button>
              {item.user_id && <a className="miniBtn" href={`/messagerie?to=${encodeURIComponent(item.user_id)}`}>Écrire au membre</a>}
            </div>
          </article>)}
          {selectedSuggestion && suggestionDraft && <form className={styles.composer} onSubmit={e => reviewSuggestion(e, 'approve')}>
            <h3>Fiche à publier : {selectedSuggestion.name}</h3>
            <p>Les champs sont préremplis avec la proposition. Corrige-les à partir d’une source fiable. Le code-barres est facultatif : ne le devine pas.</p>
            <label htmlFor="suggestion-name">Nom officiel</label><input id="suggestion-name" required value={suggestionDraft.name} onChange={e => setSuggestionDraft({ ...suggestionDraft, name: e.target.value })} />
            <label htmlFor="suggestion-series">Série / extension</label><input id="suggestion-series" value={suggestionDraft.series} onChange={e => setSuggestionDraft({ ...suggestionDraft, series: e.target.value })} />
            <label htmlFor="suggestion-category">Catégorie</label><select id="suggestion-category" value={suggestionDraft.category} onChange={e => setSuggestionDraft({ ...suggestionDraft, category: e.target.value })}><option value="sealed">Produit scellé</option><option value="card">Carte</option><option value="accessory">Accessoire</option><option value="other">Autre</option></select>
            <label htmlFor="suggestion-type">Type précis</label><input id="suggestion-type" placeholder="Ex. Pokébox" value={suggestionDraft.product_type} onChange={e => setSuggestionDraft({ ...suggestionDraft, product_type: e.target.value })} />
            <label htmlFor="suggestion-reference">Référence / code-barres vérifié</label><input id="suggestion-reference" value={suggestionDraft.reference_code} onChange={e => setSuggestionDraft({ ...suggestionDraft, reference_code: e.target.value })} />
            <label htmlFor="suggestion-source">Source consultée</label><input id="suggestion-source" type="url" required value={suggestionDraft.official_source_url} onChange={e => setSuggestionDraft({ ...suggestionDraft, official_source_url: e.target.value })} placeholder="Lien officiel ou source fiable" />
            <label htmlFor="suggestion-release-date">Date de sortie exacte</label><input id="suggestion-release-date" type="date" value={suggestionDraft.release_date} onChange={e => setSuggestionDraft({ ...suggestionDraft, release_date: e.target.value })} />
            <label htmlFor="suggestion-release-period">Période de sortie si la date exacte est inconnue</label><input id="suggestion-release-period" value={suggestionDraft.release_period} onChange={e => setSuggestionDraft({ ...suggestionDraft, release_period: e.target.value })} placeholder="Ex. octobre 2026" />
            <label htmlFor="suggestion-image">Lien du visuel</label><input id="suggestion-image" type="url" value={suggestionDraft.image_url} onChange={e => setSuggestionDraft({ ...suggestionDraft, image_url: e.target.value })} />
            <label htmlFor="suggestion-image-source">Source du visuel</label><input id="suggestion-image-source" type="url" value={suggestionDraft.image_source_url} onChange={e => setSuggestionDraft({ ...suggestionDraft, image_source_url: e.target.value })} />
            <label htmlFor="suggestion-image-credit">Crédit du visuel</label><input id="suggestion-image-credit" value={suggestionDraft.image_credit} onChange={e => setSuggestionDraft({ ...suggestionDraft, image_credit: e.target.value })} />
            {duplicateCandidates.length > 0 && <section className={styles.announcementPreview}><strong>Produits proches déjà au catalogue</strong>{duplicateCandidates.map(product => <div className={styles.blockRow} key={product.id}><span><b>{product.name}</b><br />{product.series || product.product_type || 'Produit'}{product.case_reference ? ` · ${product.case_reference}` : ''}</span><button type="button" className="miniBtn" disabled={busy} onClick={() => reviewSuggestion(null, 'link', product.id)}>Relier à ce produit</button></div>)}</section>}
            <label className={styles.check}><input type="checkbox" checked={verifiedSuggestion} onChange={e => setVerifiedSuggestion(e.target.checked)} />J’ai vérifié le nom et les informations auprès de la source indiquée.</label>
            <div className={styles.sendRow}><button type="button" className="miniBtn dangerMini" disabled={busy} onClick={() => reviewSuggestion(null, 'reject')}>Refuser</button><button className="btn" disabled={busy || !verifiedSuggestion || !suggestionDraft.official_source_url.trim()}>{busy ? 'Enregistrement…' : 'Publier la fiche vérifiée'}</button></div>
          </form>}
        </section>}
        {threadLoading && !threadData && <p role="status">Chargement de la conversation…</p>}
        {selected && threadData && <>
          <div className={styles.conversationHeading}><div><h2>{selectedThread?.correspondent || (threadData.thread.kind === 'direct' ? 'Conversation privée' : 'Équipe PokéValeur')}</h2><p>{threadData.thread.subject}</p></div>
            <div className={styles.tools}><button className="miniBtn" disabled={busy} onClick={() => run(async () => { await api('archive', { thread_id: selected, archived: !archived }); selectedRef.current = null; setSelected(null); setThreadData(null); await refreshInbox(); setNotice(archived ? 'Conversation rétablie.' : 'Conversation archivée.') })}>{archived ? 'Rétablir' : 'Archiver'}</button>
            {threadData.peer_id && <button className="miniBtn" disabled={busy} onClick={() => run(async () => { await api('block', { user_id: threadData.peer_id, blocked: !threadData.blocked }); await threadLoader.current(selected); setNotice(threadData.blocked ? 'Membre débloqué.' : 'Membre bloqué pour les messages privés.') })}>{threadData.blocked ? 'Débloquer' : 'Bloquer'}</button>}</div>
          </div>
          <div className={styles.messages} ref={messageArea} tabIndex={0} aria-label="Messages de la conversation" onScroll={e => { const el = e.currentTarget; shouldScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
            {hasOlder && <button className="miniBtn" onClick={() => threadLoader.current(selected, messages[0]?.id)}>Voir les messages précédents</button>}
            {messages.map(m => <article key={m.id} className={`${styles.bubble} ${m.sender_id === user.id ? styles.mine : ''}`}><div className={styles.messageMeta}><strong>{m.sender_name}</strong>{m.from_team && <span className={styles.badge}>Équipe</span>}<time dateTime={m.created_at}>{formatDate(m.created_at)}</time></div><p>{m.body}</p>
              {m.sender_id !== user.id && <button className={styles.report} onClick={() => { const reason = window.prompt('Pourquoi signales-tu ce message ? Seul ce message sera transmis à l’équipe.'); if (reason?.trim()) run(async () => { await api('report', { message_id: m.id, reason: reason.trim() }); setNotice('Signalement transmis à l’équipe.') }) }}>Signaler</button>}
            </article>)}
          </div>
          {threadData.thread.kind === 'announcement' ? <div className={styles.announcementNote}><p>Cette annonce t’a été adressée individuellement. Ta réponse restera privée.</p><button className="btn" onClick={() => { changeView('team'); setBody(`À propos de « ${threadData.thread.subject} » :\n\n`) }}>Répondre à l’équipe</button></div> : threadData.cannot_send ? <p className={styles.empty}>L’envoi de messages est indisponible dans cette conversation.</p> : <form className={styles.composer} onSubmit={send}><label htmlFor="reply">Ta réponse</label><textarea id="reply" rows={3} maxLength={4000} value={body} disabled={busy} onChange={e => { setBody(e.target.value); clientRef.current = null }} /><div className={styles.sendRow}><small>{body.length}/4 000</small><button className="btn" disabled={busy || !body.trim()}>{busy ? 'Envoi…' : 'Envoyer'}</button></div></form>}
        </>}
        {composer && <form className={styles.composer} onSubmit={send}>
          <h2>{view === 'announce' ? 'Une annonce pour tous les membres' : view === 'team' ? 'Lukulu — l’équipe PokéValeur' : 'Nouveau message privé'}</h2>
          {view === 'team' && <p>Un problème, une idée ou une question ? Écris ici : un administrateur pourra te répondre.</p>}
          {view === 'new' && <><label htmlFor="member-search">Trouver un membre par son pseudo</label><input id="member-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pseudo du collectionneur" />
            <label htmlFor="recipient">Destinataire</label><select required id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Choisir un membre</option>{members.map(m => <option value={m.id} key={m.id}>{m.display_name || 'Collectionneur'}{m.is_admin ? ' · Administrateur' : ''}</option>)}</select>
            {!members.length && <p className="muted">Aucun membre correspondant. Les profils enfants ne figurent pas dans cet annuaire.</p>}
            {status.is_admin && <label className={styles.check}><input type="checkbox" checked={asTeam} onChange={e => setAsTeam(e.target.checked)} />Envoyer au nom de l’équipe PokéValeur</label>}
          </>}
          {view !== 'team' && <><label htmlFor="subject">Titre{view === 'announce' ? ' de l’annonce' : ''}</label><input id="subject" maxLength={120} required={view === 'announce'} value={subject} disabled={busy} onChange={e => { setSubject(e.target.value); setPreview(null); clientRef.current = null }} /></>}
          <label htmlFor="message-body">Ton message</label><textarea id="message-body" rows={7} maxLength={4000} required value={body} disabled={busy} onChange={e => { setBody(e.target.value); setPreview(null); clientRef.current = null }} />
          <small>{body.length}/4 000 caractères</small>
          {view === 'announce' && <p className="muted">Chaque titulaire de compte recevra cette annonce dans sa boîte. Les comptes identifiés comme enfants sont exclus. Aucun envoi par courriel et aucune réponse collective.</p>}
          {preview && <section className={styles.announcementPreview} aria-label="Aperçu avant envoi"><strong>{preview.subject}</strong><p>{preview.body}</p><b>{preview.recipients} destinataire{preview.recipients > 1 ? 's' : ''}</b><p>Vérifie ce message avant de confirmer l’envoi à tous.</p></section>}
          <div className={styles.sendRow}>{view === 'announce' && !preview ? <button type="button" className="btn" disabled={busy || !body.trim() || !subject.trim()} onClick={() => run(async () => { const data = await api('announcement_preview'); setPreview({ ...data, body: body.trim(), subject: subject.trim() }) })}>Voir l’aperçu et les destinataires</button> : <button className="btn" disabled={busy || !body.trim() || (view === 'new' && !recipient) || (view === 'announce' && !preview?.recipients)}>{busy ? 'Envoi…' : view === 'announce' ? 'Confirmer l’envoi à tous' : 'Envoyer le message'}</button>}</div>
        </form>}
        {view === 'settings' && <div className={styles.settings}><h2>Mes réglages</h2><label className={styles.check}><input type="checkbox" checked={status.allow_direct} disabled={busy} onChange={e => { const value = e.target.checked; run(async () => { await api('preferences', { allow_direct: value }); setStatus(await api('status')); setNotice('Préférence enregistrée.') }) }} />Accepter les messages privés des membres</label><p>L’équipe reste joignable et ses annonces restent accessibles.</p><h3>Membres bloqués</h3>{!blocks.length && <p>Aucun membre bloqué.</p>}{blocks.map(b => <div className={styles.blockRow} key={b.blocked_id}><span>{b.display_name || 'Collectionneur'}</span><button className="miniBtn" disabled={busy} onClick={() => run(async () => { await api('block', { user_id: b.blocked_id, blocked: false }); setBlocks(await api('blocks')) })}>Débloquer</button></div>)}</div>}
        {view === 'reports' && status.is_admin && <div className={styles.settings}><h2>Messages signalés</h2><p>Seuls les messages transmis par leurs destinataires sont affichés ici.</p>{!reports.length && <p>Aucun signalement.</p>}{reports.map(r => <article className={styles.announcementPreview} key={r.id}><strong>{r.snapshot.sender}</strong><p>{r.snapshot.body}</p><p>Motif : {r.reason}</p><small>{formatDate(r.created_at)}</small>{r.resolved_at ? <p>Traité</p> : <button className="miniBtn" disabled={busy} onClick={() => run(async () => { await api('resolve_report', { report_id: r.id }); setReports(await api('reports')) })}>Marquer comme traité</button>}</article>)}</div>}
      </section>
    </div>
  </main>
}
