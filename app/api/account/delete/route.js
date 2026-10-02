import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '../../../../lib/supabase-config'

export const dynamic = 'force-dynamic'

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonError('Requête refusée.', 403)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Demande invalide.', 400)
  }

  if (body?.confirmation !== 'SUPPRIMER') {
    return jsonError('Confirme explicitement la suppression.', 400)
  }

  if (typeof body?.confirmedEmail !== 'string' || !body.confirmedEmail.trim()) {
    return jsonError('Confirme l’adresse e-mail du compte.', 400)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return jsonError('Reconnecte-toi puis réessaie.', 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken)
  const user = authData?.user
  if (authError || !user?.id || !user.email) {
    return jsonError('Ta session a expiré. Reconnecte-toi puis réessaie.', 401)
  }

  const lastSignInAt = Date.parse(user.last_sign_in_at || '')
  if (!Number.isFinite(lastSignInAt) || Date.now() - lastSignInAt > 10 * 60 * 1000) {
    return jsonError('Pour protéger ton compte, confirme à nouveau ton mot de passe puis réessaie.', 401)
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) {
    return jsonError('La suppression sécurisée du compte n’est pas encore configurée. Contacte l’équipe PokéValeur.', 503)
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Collection photos are stored under the authenticated user's UUID.
  // Remove them before the Auth user so storage failures cannot leave an unusable account.
  const bucket = adminClient.storage.from('collection-images')
  const paths = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(user.id, { limit: 100, offset })
    if (error) {
      return jsonError('Les photos du compte n’ont pas pu être préparées à la suppression. Rien d’autre n’a été supprimé.', 503)
    }
    const files = (data || []).filter(entry => entry.id && entry.name)
    paths.push(...files.map(entry => user.id + '/' + entry.name))
    if (!data || data.length < 100) break
  }

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await bucket.remove(paths.slice(index, index + 100))
    if (error) {
      return jsonError('Les photos du compte n’ont pas pu être supprimées. Le compte est conservé.', 503)
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return jsonError('Le compte n’a pas pu être supprimé. Réessaie ou contacte l’équipe PokéValeur.', 503)
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
