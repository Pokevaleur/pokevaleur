'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function CommunautePage() {
  const supabase = useMemo(() => createClient(), [])
  const [channel, setChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [itemRows, setItemRows] = useState(0)
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    load()
    const timer = setInterval(loadMessages, 5000)
    return () => clearInterval(timer)
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) {
      window.location.href = '/login'
      return
    }
    const { count: collectionCount } = await supabase
      .from('collection_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setItemRows(collectionCount || 0)

    const { data: channelData, error: channelError } = await supabase
      .from('community_channels')
      .select('*')
      .eq('slug', 'general')
      .single()
    if (channelError) {
      setError(channelError.message)
      setLoading(false)
      return
    }
    setChannel(channelData)
    await loadMessages(channelData.id)
    setLoading(false)
  }

  async function loadMessages(channelId = channel?.id) {
    if (!channelId) return
    const { data } = await supabase
      .from('community_messages')
      .select('id,user_id,author_name,body,created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(100)
    setMessages((data || []).reverse())
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text || !channel?.id || sending) return
    setSending(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expirée.')
      if (itemRows < 10) throw new Error('Il faut au moins 10 fiches distinctes dans ta collection pour publier.')
      const { error } = await supabase.from('community_messages').insert({
        channel_id: channel.id,
        user_id: user.id,
        body: text
      })
      if (error) throw error
      setBody('')
      await loadMessages(channel.id)
    } catch (e) {
      setError(e.message || 'Impossible d’envoyer le message.')
    } finally {
      setSending(false)
    }
  }

  async function deleteMessage(message) {
    if (!user || message.user_id !== user.id) return
    if (!window.confirm('Supprimer ce message ?')) return
    const { error } = await supabase.from('community_messages').delete().eq('id', message.id)
    if (error) return setActionMessage('❌ ' + error.message)
    setActionMessage('✓ Message supprimé.')
    await loadMessages(channel?.id)
  }

  async function reportMessage(message) {
    if (!user || message.user_id === user.id) return
    const reason = window.prompt('Pourquoi signales-tu ce message ?')
    if (!reason?.trim()) return
    const { error } = await supabase.from('community_reports').insert({
      reporter_id: user.id,
      message_id: message.id,
      reason: reason.trim()
    })
    if (error) {
      if ((error.message || '').toLowerCase().includes('duplicate')) {
        return setActionMessage('Ce message a déjà été signalé.')
      }
      return setActionMessage('❌ ' + error.message)
    }
    setActionMessage('✓ Signalement transmis à la modération.')
  }

  async function blockUser(message) {
    if (!user || message.user_id === user.id) return
    if (!window.confirm(`Bloquer ${message.author_name || 'ce membre'} ? Ses messages ne seront plus affichés pour toi.`)) return
    const { error } = await supabase.from('community_blocks').upsert({
      blocker_id: user.id,
      blocked_id: message.user_id
    })
    if (error) return setActionMessage('❌ ' + error.message)
    setActionMessage('✓ Membre bloqué.')
    await loadMessages(channel?.id)
  }

  const canPost = itemRows >= 10

  if (loading) return <main><section className="panel"><p>Chargement…</p></section></main>

  return (
    <main>
      <section className="panel">
        <span className="eyebrow dark">Communauté</span>
        <h1>Chat PokéValeur</h1>
        <p className="muted">Un premier salon général pour échanger entre collectionneurs. La lecture est réservée aux membres connectés et la publication se débloque à partir de 10 fiches distinctes dans la collection.</p>

        <div className="message" style={{marginBottom:'16px'}}>
          {canPost
            ? '✓ Accès publication débloqué.'
            : `Lecture seule • ${itemRows}/10 fiches enregistrées. Ajoute encore ${10 - itemRows} produit${10 - itemRows > 1 ? 's' : ''} distinct${10 - itemRows > 1 ? 's' : ''} pour participer.`}
        </div>

        <div className="communityChat">
          <div className="communityMessages">
            {messages.length === 0 ? (
              <p className="muted">Aucun message pour le moment.</p>
            ) : messages.map(message => (
              <div className="communityMessage" key={message.id}>
                <div>
                  <strong>{message.author_name || 'Collectionneur'}</strong>
                  <small>{new Date(message.created_at).toLocaleString('fr-FR')}</small>
                </div>
                <p>{message.body}</p>
                <div className="rowActions">
                  {user?.id === message.user_id ? (
                    <button className="miniBtn dangerMini" type="button" onClick={() => deleteMessage(message)}>Supprimer</button>
                  ) : (
                    <>
                      <button className="miniBtn" type="button" onClick={() => reportMessage(message)}>Signaler</button>
                      <button className="miniBtn" type="button" onClick={() => blockUser(message)}>Bloquer</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canPost ? (
            <form className="communityComposer" onSubmit={sendMessage}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={2000}
                placeholder="Écrire un message…"
                rows={3}
              />
              <button className="primaryButton" disabled={sending || !body.trim()}>
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </form>
          ) : (
            <div className="message">La publication sera disponible dès que ta collection comptera 10 fiches distinctes.</div>
          )}
          {error && <div className="photoImmediateStatus error">{error}</div>}
          {actionMessage && <div className="message">{actionMessage}</div>}
        </div>
      </section>
    </main>
  )
}
