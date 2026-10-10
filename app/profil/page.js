'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { AVATARS, ProfileAvatar } from '../../lib/profile-avatars'

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState('loading')
  const [profile, setProfile] = useState(null)
  const [userId, setUserId] = useState('')
  const [editedDisplayName, setEditedDisplayName] = useState('')
  const [editedAvatarKey, setEditedAvatarKey] = useState('star')
  const [profileMessage, setProfileMessage] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [socialAccess, setSocialAccess] = useState(null)
  const [socialConsentMessage, setSocialConsentMessage] = useState('')
  const [withdrawingSocialConsent, setWithdrawingSocialConsent] = useState(false)
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

      const { data: socialData, error: socialError } = await supabase.rpc('get_social_access_status')
      if (!active) return
      const socialRow = Array.isArray(socialData) ? socialData[0] : socialData
      setSocialAccess(socialError ? null : Boolean(socialRow?.can_access))

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
      setUserId(user.id)
      setEditedDisplayName(data.display_name || '')
      setEditedAvatarKey(AVATARS[data.avatar_key] ? data.avatar_key : 'star')
      setEmail(user.email || '')
      setStatus('ready')
    }

    loadProfile().catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [supabase])

  async function withdrawSocialConsent() {
    if (withdrawingSocialConsent || socialAccess !== true) return
    if (!window.confirm('Retirer ton accord fermera ton accès à la Communauté et aux Trades. La collection et son transfert restent disponibles. Continuer ?')) return
    setWithdrawingSocialConsent(true)
    setSocialConsentMessage('')
    const { error } = await supabase.rpc('withdraw_social_access_consent')
    if (error) {
      setSocialConsentMessage('Impossible de retirer ton accord pour le moment. Réessaie.')
    } else {
      setSocialAccess(false)
      setSocialConsentMessage('Ton accord est retiré. L’accès à la Communauté et aux Trades est fermé ; ta collection reste disponible.')
    }
    setWithdrawingSocialConsent(false)
  }

  async function saveProfile(event) {
    event.preventDefault()
    setProfileMessage('')

    const displayName = editedDisplayName.trim()
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(displayName)) {
      setProfileMessage('Choisis un pseudo de 3 à 24 caractères : lettres, chiffres, point, tiret ou tiret bas.')
      return
    }
    if (!AVATARS[editedAvatarKey]) {
      setProfileMessage('Choisis un avatar proposé.')
      return
    }

    setIsSavingProfile(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName, avatar_key: editedAvatarKey })
        .eq('id', userId)
        .select('display_name,avatar_key')
        .maybeSingle()

      if (error) {
        if (error.code === '23505') {
          setProfileMessage('Ce pseudo est déjà utilisé. Choisis-en un autre.')
        } else if (error.code === '23514') {
          setProfileMessage('Le pseudo ou l’avatar ne respecte pas les règles autorisées.')
        } else {
          setProfileMessage('La modification n’a pas pu être enregistrée. Réessaie.')
        }
        return
      }
      if (!data) {
        setProfileMessage('La modification n’a pas été enregistrée. Recharge la page puis réessaie.')
        return
      }

      setProfile(data)
      setEditedDisplayName(data.display_name)
      setEditedAvatarKey(data.avatar_key)
      setProfileMessage('Ton profil a été mis à jour.')
      window.dispatchEvent(new CustomEvent('pokevaleur-profile-updated', {
        detail: { displayName: data.display_name, avatarKey: data.avatar_key },
      }))
    } catch {
      setProfileMessage('Impossible de joindre le service. Réessaie.')
    } finally {
      setIsSavingProfile(false)
    }
  }

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
      window.location.assign('/compte-supprime')
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
          <ProfileAvatar className="profileAvatarLarge" avatarKey={profile.avatar_key} aria-hidden="true" />
          <div><h2>{profile.display_name || 'Collectionneur'}</h2><p>Ton pseudo et ton avatar</p></div>
        </div>
        <dl className="profileDetails">
          <div><dt>Pseudo</dt><dd>{profile.display_name || 'Non renseigné'}</dd></div>
          <div><dt>Avatar</dt><dd className="profileAvatarDetail"><ProfileAvatar className="profileAvatarDetailMark" avatarKey={profile.avatar_key} aria-hidden="true" /><span>{avatar.label}</span></dd></div>
          <div><dt>Adresse e-mail du compte</dt><dd>{email || 'Non renseignée'}</dd></div>
        </dl>
        <section className="profileEditPanel" style={{ margin: '20px 0', padding: 18, borderRadius: 16, background: '#f4f7fb' }}>
          <h2 style={{ marginTop: 0, fontSize: 21 }}>PokéValeur sur ton téléphone</h2>
          <p>Ajoute un raccourci à l’écran d’accueil pour retrouver ta collection avec une icône.</p>
          <button className="btn ghost" type="button" onClick={() => window.dispatchEvent(new Event('pokevaleur-open-install-help'))}>
            Comment ajouter le raccourci ?
          </button>
        </section>
        <section className="profileEditPanel" style={{ margin: '20px 0', padding: 18, borderRadius: 16, background: '#f4f7fb' }}>
          <h2 style={{ marginTop: 0, fontSize: 21 }}>Accès sociaux</h2>
          {socialAccess === true ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <p>Ton accord permet d’accéder à la Communauté et aux Trades.</p>
              <button className="btn ghost" type="button" onClick={withdrawSocialConsent} disabled={withdrawingSocialConsent}>
                {withdrawingSocialConsent ? 'Retrait…' : 'Retirer mon accord social'}
              </button>
            </div>
          ) : socialAccess === false ? (
            <p>Les fonctions sociales sont fermées. Ta collection et son transfert restent disponibles.</p>
          ) : (
            <p role="status">Impossible de vérifier le statut du consentement social.</p>
          )}
          {socialConsentMessage && <p role="status" className="message">{socialConsentMessage}</p>}
        </section>
        <section className="profileEditPanel" style={{ margin: '20px 0', padding: 18, borderRadius: 16, background: '#f4f7fb' }}>
          <h2 style={{ marginTop: 0, fontSize: 21 }}>Modifier mon profil</h2>
          <form onSubmit={saveProfile} style={{ display: 'grid', gap: 14 }}>
            <label>
              Pseudo
              <input
                type="text"
                value={editedDisplayName}
                onChange={event => setEditedDisplayName(event.target.value)}
                minLength={3}
                maxLength={24}
                autoComplete="nickname"
                required
                aria-describedby="profile-name-help"
              />
              <small id="profile-name-help" style={{ color: '#697789', fontWeight: 400 }}>
                3 à 24 caractères : lettres, chiffres, point, tiret ou tiret bas.
              </small>
            </label>
            <fieldset className="profileAvatarFieldset">
              <legend>Avatars illustrés</legend>
              <div className="profileAvatarChoices">
                {Object.entries(AVATARS).filter(([, option]) => option.cell).map(([key, option]) => (
                  <button
                    key={key}
                    className="profileAvatarChoice"
                    type="button"
                    aria-pressed={editedAvatarKey === key}
                    aria-label={`Choisir ${option.label}`}
                    onClick={() => setEditedAvatarKey(key)}
                  >
                    <ProfileAvatar className="profileAvatarOptionImage" avatarKey={key} aria-hidden="true" />
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="profileAvatarFieldset">
              <legend>Avatars classiques</legend>
              <div className="profileAvatarChoices profileAvatarChoicesClassic">
                {Object.entries(AVATARS).filter(([, option]) => option.emoji).map(([key, option]) => (
                  <button
                    key={key}
                    className="profileAvatarChoice"
                    type="button"
                    aria-pressed={editedAvatarKey === key}
                    aria-label={`Choisir ${option.label}`}
                    onClick={() => setEditedAvatarKey(key)}
                  >
                    <ProfileAvatar className="profileAvatarOptionImage" avatarKey={key} aria-hidden="true" />
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="btn" type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? 'Enregistrement…' : 'Enregistrer mon profil'}
            </button>
            {profileMessage && <p role="status" aria-live="polite" style={{ margin: 0 }}>{profileMessage}</p>}
          </form>
        </section>
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
