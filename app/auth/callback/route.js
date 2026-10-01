import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { supabaseAnonKey, supabaseUrl } from '../../../lib/supabase-config'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const destination = next === '/update-password' ? '/update-password?recovery=1' : '/login?reset=invalid'
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')

  if (!code || next !== '/update-password') return response

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?reset=invalid', request.url), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  }
  return response
}
