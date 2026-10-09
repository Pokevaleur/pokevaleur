'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { AVATARS, ProfileAvatar } from '../lib/profile-avatars'

export default function Navigation({ links }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [identity, setIdentity] = useState(null)
  const [authState, setAuthState] = useState('checking')
  const [authVersion, setAuthVersion] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setIsAdmin(false)
      setIdentity(null)
      setAuthState('checking')
      setAuthVersion(value => value + 1)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleProfileUpdated(event) {
      const displayName = event.detail?.displayName
      const avatarKey = event.detail?.avatarKey
      if (typeof displayName !== 'string' || !Object.hasOwn(AVATARS, avatarKey)) return
      setIdentity(current => current ? { ...current, displayName, avatarKey } : current)
    }
    window.addEventListener('pokevaleur-profile-updated', handleProfileUpdated)
    return () => window.removeEventListener('pokevaleur-profile-updated', handleProfileUpdated)
  }, [])

  useEffect(() => {
    let active = true
    async function loadIdentity() {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active) return
      if (error || !user) {
        setIdentity(null)
        setIsAdmin(false)
        setAuthState('signed-out')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name,avatar_key,is_admin')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return

      const displayName = profile?.display_name?.trim() || 'Collectionneur'
      const avatarKey = Object.hasOwn(AVATARS, profile?.avatar_key) ? profile.avatar_key : 'star'
      setIdentity({
        displayName,
        avatarKey,
        email: user.email || '',
      })
      setIsAdmin(!profileError && profile?.is_admin === true)
      setAuthState('signed-in')
    }
    loadIdentity().catch(() => {
      if (active) {
        setIdentity(null)
        setIsAdmin(false)
        setAuthState('error')
      }
    })
    return () => { active = false }
  }, [authVersion])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const visibleLinks = links
    .map(link => link.children
      ? { ...link, children: link.children.filter(child => identity || !child.memberOnly) }
      : link)
    .filter(link => !link.memberOnly || identity)
    .filter(link => !link.children || link.children.length > 0)
  if (isAdmin) visibleLinks.push({ href: '/admin', label: 'Admin' })

  function renderLinks() {
    return visibleLinks.map(link => link.children
      ? (
        <details className="collectionNavGroup" key={link.label}>
          <summary>
            <a
              href={link.href || link.children[0]?.href}
              aria-label={`Aller à ${link.label}`}
              onClick={event => event.stopPropagation()}
            >
              {link.label}
            </a>
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="collectionNavPanel">
            {link.children.map(child => <a href={child.href} key={child.href}>{child.label}</a>)}
          </div>
        </details>
      )
      : <a href={link.href} key={link.href}>{link.label}</a>)
  }
  const accountMenu = identity && (
    <details className="accountMenu">
      <summary aria-label={`Compte de ${identity.displayName}`}>
        <ProfileAvatar className="profileAvatar" avatarKey={identity.avatarKey} aria-hidden="true" />
        <span className="accountMenuName">{identity.displayName}</span>
      </summary>
      <div className="accountMenuPanel">
        <div className="accountMenuIdentity">
          <strong>{identity.displayName}</strong>
          {identity.email && <small>{identity.email}</small>}
        </div>
        <a href="/profil">Mon profil</a>
        <button type="button" onClick={signOut}>Se déconnecter</button>
      </div>
    </details>
  )

  return (
    <>
      <nav className="desktopNav">
        {renderLinks()}
        {accountMenu || (authState === 'signed-out' && <a href="/login" className="btn small">Connexion</a>)}
      </nav>
      <details className="mobileMenu">
        <summary aria-label="Ouvrir le menu">☰</summary>
        <div className="mobileMenuPanel">
          {identity && (
            <section className="mobileAccountCard" aria-label="Mon compte">
              <div className="mobileAccountIdentity">
                <ProfileAvatar className="profileAvatar" avatarKey={identity.avatarKey} aria-hidden="true" />
                <span><strong>{identity.displayName}</strong>{identity.email && <small>{identity.email}</small>}</span>
              </div>
              <a className="mobileProfileLink" href="/profil">Mon profil</a>
              <button className="mobileAccountSignOut" type="button" onClick={signOut}>Se déconnecter</button>
            </section>
          )}
          {renderLinks()}
          {!identity && authState === 'signed-out' && <a href="/login" className="btn small">Connexion</a>}
        </div>
      </details>
    </>
  )
}
