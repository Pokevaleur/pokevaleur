'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from './supabase-browser'

let snapshot = null
let generation = 0
let cleanup = null
const listeners = new Set()
const emit = value => { snapshot = value; listeners.forEach(listener => listener()) }

function connect() {
  const supabase = createClient()
  let alive = true
  let pending = false
  let queued = false
  let retry = null
  const refresh = async () => {
    if (!alive || document.visibilityState !== 'visible') return
    if (pending) { queued = true; return }
    pending = true
    const request = generation
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (alive && request === generation) emit(null); return }
      const { data, error } = await supabase.rpc('messaging', { p_action: 'status', p_payload: {} })
      if (error) {
        if (alive && request === generation) emit(null)
        return
      }
      let cataloguePending = 0
      if (data?.is_admin) {
        const { count, error: suggestionError } = await supabase
          .from('product_suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!suggestionError) cataloguePending = count || 0
      }
      if (alive && request === generation) emit({ ...data, catalogue_pending: cataloguePending })
    } catch { if (alive && request === generation) emit(null) }
    finally {
      pending = false
      if (queued && alive) { queued = false; queueMicrotask(refresh) }
    }
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
    generation++; emit(null)
    clearTimeout(retry)
    retry = setTimeout(refresh, 0)
  })
  refresh()
  const timer = setInterval(refresh, 30000)
  window.addEventListener('focus', refresh)
  window.addEventListener('pokevaleur-inbox-updated', refresh)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    alive = false; generation++; clearTimeout(retry); clearInterval(timer); subscription.unsubscribe()
    window.removeEventListener('focus', refresh)
    window.removeEventListener('pokevaleur-inbox-updated', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}
function subscribe(listener) {
  listeners.add(listener)
  if (!cleanup) cleanup = connect()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { cleanup?.(); cleanup = null; snapshot = null }
  }
}
export function useInboxStatus() {
  return useSyncExternalStore(subscribe, () => snapshot, () => null)
}
