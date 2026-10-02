'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

const AVATARS = {
  star: { emoji: '⭐', label: 'Étoile' },
  fire: { emoji: '🔥', label: 'Feu' },
  water: { emoji: '💧', label: 'Eau' },
  leaf: { emoji: '🍃', label: 'Feuille' },
  spark: { emoji: '⚡', label: 'Éclair' },
  crystal: { emoji: '💎', label: 'Cristal' },
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState('loading')
  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    let active = true

    async function loadProfile() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!active) return
      if (authError || !user) {
        setStatus('signed-out')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name,avatar_key')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (error || !data) {
        setStatus('error')
        return
      }

      setProfile(data)
      setEmail(user.email || '')
      setStatus('ready')
    }

    loadProfile().catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [supabase])

  if (status === 'loading') {
    return <main className="narrow profilePage"><section className="panel"><h1>Mon profil</h1><p role="status" className="muted">Chargement…</p></section></main>
  }

  if (status === 'signed-out') {
    return (
      <main className="narrow profilePage">
        <section className="panel">
          <h1>Mon profil</h1>
          <p>Connecte-toi pour consulter les informations de ton profil.</p>
          <a className="btn" href={`/login?next=${encodeURIComponent('/profil')}`}>Connexion</a>
        </section>
      </main>
    )
  }

  if (status === 'error') {
    return <main className="narrow profilePage"><section className="panel"><h1>Mon profil</h1><p role="alert">Impossible de charger ton profil. Réessaie dans quelques instants.</p></section></main>
  }

  const avatar = AVATARS[profile.avatar_key] || AVATARS.star

  return (
    <main className="narrow profilePage">
      <section className="panel">
        <span className="eyebrow dark">Mon compte</span>
        <h1>Mon profil</h1>
        <div className="profileHero">
          <span className="profileAvatarLarge" aria-hidden="true">{avatar.emoji}</span>
          <div><h2>{profile.display_name || 'Collectionneur'}</h2><p>Ton pseudo et ton avatar</p></div>
        </div>
        <dl className="profileDetails">
          <div><dt>Pseudo</dt><dd>{profile.display_name || 'Non renseigné'}</dd></div>
          <div><dt>Avatar</dt><dd>{avatar.emoji} {avatar.label}</dd></div>
          <div><dt>Adresse e-mail du compte</dt><dd>{email || 'Non renseignée'}</dd></div>
        </dl>
        <div className="profileActions">
          <a className="btn" href="/collection">Ma collection</a>
        </div>
      </section>
    </main>
  )
}
