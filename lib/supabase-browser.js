import { createBrowserClient } from '@supabase/ssr'
import { supabaseAnonKey, supabaseUrl } from './supabase-config'

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
