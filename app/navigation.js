'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

export default function Navigation({ links }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [authVersion, setAuthVersion] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setIsAdmin(false)
      setAuthVersion(value => value + 1)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    async function loadRole() {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active || error || !user) return
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (active) setIsAdmin(!profileError && profile?.is_admin === true)
    }
    loadRole().catch(() => { if (active) setIsAdmin(false) })
    return () => { active = false }
  }, [authVersion])

  const visibleLinks = isAdmin ? [...links, ['/admin', 'Admin']] : links
  const items = visibleLinks.map(([href, label]) => <a href={href} key={href}>{label}</a>)
  return <>
    <nav className="desktopNav">
      {items}<a href="/login" className="btn small">Connexion</a>
    </nav>
    <details className="mobileMenu">
      <summary aria-label="Ouvrir le menu">☰</summary>
      <div className="mobileMenuPanel">
        {items}<a href="/login" className="btn small">Connexion</a>
      </div>
    </details>
  </>
}
