import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './supabase-config'

export function createPublicServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}
