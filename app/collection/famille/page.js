'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { ProfileAvatar } from '../../../lib/profile-avatars'
import styles from './family-profiles.module.css'

const ACTIVE_PROFILE_KEY = 'pokevaleur-collection:'

export default function FamilyProfilesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [adultAvatarKey, setAdultAvatarKey] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState('')
  const [childName, setChildName] = useState('')
  const [message, setMessage] = useState('')
  const [transferLink, setTransferLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfiles() {
      const { data: { user: signedInUser } } = await supabase.auth.getUser()
      if (cancelled) return
      setUser(signedInUser || null)
      if (!signedInUser) {
        setLoading(false)
        return
      }

      const { data: identity } = await supabase.from('profiles')
        .select('avatar_key').eq('id', signedInUser.id).maybeSingle()
      if (cancelled) return
      setAdultAvatarKey(identity?.avatar_key || null)

      const { data, error } = await supabase.from('collection_profiles')
        .select('id,profile_type,is_default,display_name,avatar_key,transferred_at')
        .order('created_at')
      if (cancelled) return
      if (error) {
        setMessage('Impossible de charger les collections : ' + error.message)
        setLoading(false)
        return
      }

      const rows = data || []
      const savedId = window.localStorage.getItem(ACTIVE_PROFILE_KEY + signedInUser.id)
      const selected = rows.find(profile => profile.id === savedId)
        || rows.find(profile => profile.is_default)
        || rows[0]
      setProfiles(rows)
      if (selected) {
        setActiveProfileId(selected.id)
        window.localStorage.setItem(ACTIVE_PROFILE_KEY + signedInUser.id, selected.id)
      }
      setLoading(false)
    }

    loadProfiles().catch(error => {
      if (!cancelled) {
        setMessage('Impossible de charger les collections : ' + (error.message || 'réessaie.'))
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [supabase])

  function chooseProfile(profileId) {
    if (!user || !profileId) return
    setActiveProfileId(profileId)
    window.localStorage.setItem(ACTIVE_PROFILE_KEY + user.id, profileId)
    const profile = profiles.find(row => row.id === profileId)
    const name = profile?.is_default ? 'Ma collection' : profile?.display_name || 'cette collection'
    setMessage(`« ${name} » sera sélectionnée pour les prochains ajouts dans le catalogue.`)
  }

  async function createChildProfile(event) {
    event.preventDefault()
    if (!user || busy) return
    const name = childName.trim()
    if (name.length < 1 || name.length > 32) {
      setMessage('Le prénom ou pseudo doit contenir de 1 à 32 caractères.')
      return
    }

    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.from('collection_profiles').insert({
      manager_user_id: user.id,
      profile_type: 'child',
      display_name: name,
      avatar_key: 'star'
    }).select('id,profile_type,is_default,display_name,avatar_key,transferred_at').single()
    if (error) {
      setMessage('La collection n’a pas pu être créée : ' + error.message)
      setBusy(false)
      return
    }

    const nextProfiles = [...profiles, data]
    setProfiles(nextProfiles)
    setChildName('')
    setActiveProfileId(data.id)
    window.localStorage.setItem(ACTIVE_PROFILE_KEY + user.id, data.id)
    setMessage(`La collection de ${name} est créée et sélectionnée. Tu peux maintenant lui ajouter des cartes dans le catalogue.`)
    setBusy(false)
  }

  async function createTransferLink(profile) {
    if (!user || busy) return
    const parentConsent = window.confirm('Si l’enfant a moins de 15 ans, confirme être son parent ou tuteur et autoriser son accès à la Communauté et aux Trades après son propre accord. Les règles demandent de rester respectueux, de ne pas partager ses coordonnées et de ne pas effectuer de paiement dans PokéValeur. Choisir « Annuler » crée quand même le lien de transfert, sans accès social.')
    setBusy(true)
    setMessage('')
    setTransferLink('')
    const { data, error } = await supabase.rpc('create_collection_transfer_invite_with_parent_consent', {
      profile_id: profile.id,
      p_parent_consent: parentConsent,
      p_terms_version: 'social-v1-2026-10-03'
    })
    if (error) {
      setMessage('Le lien de transfert n’a pas pu être créé : ' + error.message)
      setBusy(false)
      return
    }

    const link = `${window.location.origin}/collection/rejoindre?token=${encodeURIComponent(data)}`
    setTransferLink(link)
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Lien de transfert copié. Il est valable 7 jours et ne peut servir qu’une fois.')
    } catch {
      setMessage('Lien créé. Copie-le et transmets-le à l’enfant : il est valable 7 jours et ne peut servir qu’une fois.')
    }
    setBusy(false)
  }

  return (
    <main className={`collectionWorkspace ${styles.page}`}>
      <header className={styles.header}>
        <a className={styles.backLink} href="/collection">← Ma collection</a>
        <p className={styles.kicker}>Ma collection · Famille</p>
        <h1>Collections de la famille</h1>
        <p>Crée et choisis un profil pour gérer séparément la collection de chaque enfant.</p>
      </header>

      {!user && !loading && <section className="panel">
        <p>Connecte-toi pour gérer les collections de ta famille.</p>
        <a className="btn" href={`/login?next=${encodeURIComponent('/collection/famille')}`}>Connexion</a>
      </section>}

      {loading && <p className="muted" role="status">Chargement des collections…</p>}

      {user && !loading && <>
        <section className={`panel ${styles.profilePanel}`} aria-labelledby="family-profiles-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="family-profiles-heading">Profils disponibles</h2>
              <p className="muted">Choisis le profil qui recevra les prochains ajouts de cartes.</p>
            </div>
            <a className="miniBtn primaryMini" href="/catalogue/cartes">Ajouter des cartes</a>
          </div>

          <div className={styles.profileList}>
            {profiles.map(profile => {
              const isActive = profile.id === activeProfileId
              const displayName = profile.is_default ? 'Ma collection' : profile.display_name || 'Collection familiale'
              return <article className={`${styles.profileCard} ${isActive ? styles.profileCardActive : ''}`} key={profile.id}>
                <ProfileAvatar className="collectionProfileAvatar" avatarKey={profile.is_default ? adultAvatarKey : profile.avatar_key} aria-hidden="true" />
                <div className={styles.profileInfo}>
                  <strong>{displayName}</strong>
                  <span>{profile.is_default ? 'Profil adulte' : 'Profil enfant'}{profile.transferred_at ? ' · collection transférée' : ''}</span>
                </div>
                <button className={isActive ? 'miniBtn' : 'btn ghost'} type="button" disabled={busy || isActive} onClick={() => chooseProfile(profile.id)}>
                  {isActive ? 'Sélectionnée' : 'Choisir'}
                </button>
              </article>
            })}
            {!profiles.length && <p className="muted">Aucune collection n’est disponible pour ce compte.</p>}
          </div>
        </section>

        <section className={`panel ${styles.createPanel}`} aria-labelledby="create-child-heading">
          <h2 id="create-child-heading">Créer une collection pour un enfant</h2>
          <p className="muted">L’enfant peut commencer sans compte. Tu pourras ensuite lui transférer sa collection s’il crée le sien.</p>
          <form className={styles.createForm} onSubmit={createChildProfile}>
            <label htmlFor="child-profile-name">Prénom ou pseudo de l’enfant</label>
            <div className={styles.createControls}>
              <input id="child-profile-name" value={childName} onChange={event => setChildName(event.target.value)} placeholder="Ex. Sévan" maxLength={32} disabled={busy} />
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : '＋ Créer sa collection'}</button>
            </div>
          </form>
        </section>

        {profiles.some(profile => profile.profile_type === 'child') && <section className={`panel ${styles.transferPanel}`} aria-labelledby="transfer-heading">
          <h2 id="transfer-heading">Transférer une collection</h2>
          <p className="muted">Si un enfant crée son compte, génère un lien à usage unique pour lui transférer sa collection.</p>
          <div className={styles.transferList}>
            {profiles.filter(profile => profile.profile_type === 'child').map(profile => (
              <div className={styles.transferRow} key={`transfer-${profile.id}`}>
                <strong>{profile.display_name}</strong>
                <button type="button" className="btn ghost" disabled={busy} onClick={() => createTransferLink(profile)}>
                  Transférer après création de son compte
                </button>
              </div>
            ))}
          </div>
        </section>}

        {message && <p className={`message ${styles.message}`} role="status">{message}</p>}
        {transferLink && <p className={styles.linkBox}><a href={transferLink}>{transferLink}</a></p>}
      </>}
    </main>
  )
}
