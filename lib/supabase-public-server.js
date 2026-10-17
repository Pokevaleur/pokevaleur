import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './supabase-config'

export function createPublicServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      // Editorial content changes in Supabase should appear on the guide
      // immediately instead of reusing a cached REST response.
      fetch: (input, init = {}) => fetch(input, { ...init, cache: 'no-store' })
    }
  })
}
