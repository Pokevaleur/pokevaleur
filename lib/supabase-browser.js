import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://zrvjbvhumyizutnjzljy.supabase.co'

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_hQQ1KeQSkMR7mIGXMcDp7g_6tgimcy8'

export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}
