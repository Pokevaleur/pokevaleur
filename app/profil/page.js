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
  const [confirmationText, setConfirmationText] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deletionMessage, setDeletionMessage] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

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

  async function deleteAccount(event) {
    event.preventDefault()
    setDeletionMessage('')

    if (confirmationText.trim() !== 'SUPPRIMER') {
      setDeletionMessage('Écris SUPPRIMER pour confirmer.')
      return
    }
    if (confirmationEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setDeletionMessage('L’adresse e-mail ne correspond pas à celle du compte.')
      return
    }
    if (!password) {
      setDeletionMessage('Saisis ton mot de passe pour confirmer que c’est bien toi.')
      return
    }

    setIsDeleting(true)
    setDeletionMessage('Vérification du mot de passe…')
    try {
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (passwordError) {
        setDeletionMessage('Le mot de passe est incorrect. Le compte n’a pas été supprimé.')
        return
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        setDeletionMessage('La session a expiré. Reconnecte-toi puis réessaie.')
        return
      }

      setDeletionMessage('Suppression du compte et de ses données…')
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          confirmation: 'SUPPRIMER',
          confirmedEmail: confirmationEmail.trim(),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        setDeletionMessage(result.error || 'La suppression a échoué. Le compte est conservé.')
        return
      }

      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      window.location.assign('/?compte=supprime')
    } catch {
      setDeletionMessage('Impossible de joindre le service. Le compte n’a pas été supprimé.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (status === 'loading') {
    return <main className="narrow profilePage"><section className="panel"><h1>Mon profil</h1><p role="status" className="muted">Chargement…</p></section></main>
  }

  if (status === 'signed-out') {
    return (
      <main className="narrow profilePage">
        <section className="panel">
          <h1>Mon profil</h1>
          <p>Connecte-toi pour consulter les informations de ton profil.</p>
          <a className="btn" href={\`/login?next=\${encodeURIComponent('/profil')}\`}>Connexion</a>
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

        <details className="profileDangerZone" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e3e7ec" }}>
          <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", color: "#9b1c1c", fontWeight: 800 }}>Supprimer mon compte</summary>
          <div className="profileDangerContent" style={{ marginTop: 12, padding: 16, borderRadius: 14, border: "1px solid #f1c7c7", background: "#fff7f7" }}>
            <h2 style={{ color: "#8d1717", fontSize: 20 }}>Suppression définitive</h2>
            <p>Cette action effacera ton compte, tes collections gérées avec ce compte, les photos associées et les autres données personnelles liées. Elle est définitive.</p>
            <p>Pour éviter une erreur, confirme ton adresse e-mail, saisis le mot SUPPRIMER et retape ton mot de passe.</p>
            <form className="profileDeleteForm" onSubmit={deleteAccount} style={{ display: "grid", gap: 12, marginTop: 16 }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Écris SUPPRIMER
                <input
                  type="text"
                  value={confirmationText}
                  onChange={event => setConfirmationText(event.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Confirme l’adresse e-mail de ton compte
                <input
                  type="email"
                  value={confirmationEmail}
                  onChange={event => setConfirmationEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Mot de passe actuel
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="profileDeleteButton" type="submit" disabled={isDeleting} style={{ minHeight: 48, border: 0, borderRadius: 10, padding: "10px 14px", background: isDeleting ? "#8c7777" : "#a61b1b", color: "white", font: "inherit", fontWeight: 800, cursor: isDeleting ? "wait" : "pointer" }}>
                {isDeleting ? 'Suppression en cours…' : 'Effacer définitivement mon compte'}
              </button>
              {deletionMessage && <p role="status" className="profileDeleteMessage" style={{ margin: 0, color: "#6b2222" }}>{deletionMessage}</p>}
            </form>
          </div>
        </details>
      </section>
    </main>
  )
}
