'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import CollectionMockup from '../../collection-mockup'

export default function CollectionOverviewPage() {
  const supabase = useMemo(() => createClient(), [])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function verifySession() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active) return
      if (error || !user) {
        window.location.replace('/login?next=' + encodeURIComponent('/collection/accueil'))
        return
      }
      setReady(true)
    }

    verifySession()
    return () => { active = false }
  }, [supabase])

  if (!ready) {
    return <main className="narrow" aria-live="polite"><p>Chargement de ta collection…</p></main>
  }

  return <CollectionMockup isMember />
}
