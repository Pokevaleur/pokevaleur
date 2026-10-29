import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://zrvjbvhumyizutnjzljy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpydmpidmh1bXlpenV0bmp6bGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NDY1NzgsImV4cCI6MjEwNjEyMjU3OH0.-_7bTy9dYncvYveoQuGNaqTnR83HL_r9aoWkV-wTqC8'

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request: { headers: request.headers } })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      }
    }
  })

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const protectedPrefixes = ['/messagerie', '/collection', '/communaute', '/opportunites', '/trades', '/admin', '/admin-partenaires']
  const publicCardScanner = pathname === '/collection/cartes/scanner'
  const needsAuth = !publicCardScanner && protectedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))

  if (needsAuth || publicCardScanner) response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')

  if (needsAuth && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    const redirect = NextResponse.redirect(loginUrl)
    redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    return redirect
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/admin-partenaires') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      const redirect = NextResponse.redirect(new URL('/', request.url))
      redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      return redirect
    }
  }

  return response
}

export const config = {
  matcher: [
    '/messagerie/:path*',
    '/collection/:path*',
    '/communaute/:path*',
    '/opportunites/:path*',
    '/trades/:path*',
    '/admin/:path*',
    '/admin-partenaires'
  ]
}
