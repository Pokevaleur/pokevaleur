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

  useEffect(() => {
    load()
    const timer = setInterval(loadMessages, 5000)
    return () => clearInterval(timer)
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }
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

  if (loading) return <main><section className="panel"><p>Chargement…</p></section></main>

  return (
    <main>
      <section className="panel">
        <span className="eyebrow dark">Communauté</span>
        <h1>Chat PokéValeur</h1>
        <p className="muted">Un premier salon général pour échanger entre collectionneurs. D’autres salons thématiques pourront être ajoutés ensuite.</p>

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
              </div>
            ))}
          </div>

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
          {error && <div className="photoImmediateStatus error">{error}</div>}
        </div>
      </section>
    </main>
  )
}
