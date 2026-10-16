import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '../../../../lib/supabase-config'

export const dynamic = 'force-dynamic'

const editableFields = new Set([
  'name', 'category', 'series', 'release_date', 'image_url', 'current_value', 'currency',
  'is_public', 'price_source', 'price_source_url', 'price_updated_at', 'zero_defect_value',
  'zero_defect_source', 'zero_defect_updated_at', 'image_source_url', 'image_credit',
  'image_usage_status', 'language', 'product_type', 'official_source_url', 'release_year',
  'release_period', 'case_unit_product_id', 'case_unit_count', 'case_reference',
  'case_packaging_note', 'booster_packaging', 'booster_artwork'
])

const productFields = [
  'id', 'name', 'category', 'series', 'release_date', 'image_url', 'current_value', 'currency',
  'is_public', 'created_at', 'price_source', 'price_source_url', 'price_updated_at',
  'zero_defect_value', 'zero_defect_source', 'zero_defect_updated_at', 'image_source_url',
  'image_credit', 'image_usage_status', 'language', 'product_type', 'official_source_url',
  'release_year', 'release_period', 'case_unit_product_id', 'case_unit_count', 'case_reference',
  'case_packaging_note', 'booster_packaging', 'booster_artwork'
].join(',')

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function getAdminClient(request) {
  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return { error: jsonError('Connecte-toi avec un compte administrateur.', 401) }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken)
  const user = authData?.user
  if (authError || !user?.id) return { error: jsonError('Ta session a expiré. Reconnecte-toi.', 401) }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) return { error: jsonError('L’édition sécurisée du catalogue n’est pas configurée.', 503) }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data: profile, error: profileError } = await adminClient
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (profileError || profile?.is_admin !== true) return { error: jsonError('Accès réservé à l’administration.', 403) }
  return { adminClient }
}

export async function GET(request) {
  const { adminClient, error } = await getAdminClient(request)
  if (error) return error
  const { data, error: queryError } = await adminClient.from('products').select(productFields).order('name').order('id')
  if (queryError) return jsonError('Impossible de charger les fiches du catalogue.', 503)
  return NextResponse.json({ products: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return jsonError('Requête refusée.', 403)
  const { adminClient, error } = await getAdminClient(request)
  if (error) return error

  let body
  try { body = await request.json() } catch { return jsonError('Demande invalide.', 400) }
  if (typeof body?.product_id !== 'string' || !body.product_id.trim()) return jsonError('Choisis une fiche produit à modifier.', 400)
  if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) return jsonError('Aucun champ à enregistrer.', 400)

  const entries = Object.entries(body.fields)
  if (!entries.length || entries.some(([key]) => !editableFields.has(key))) return jsonError('La fiche contient un champ non modifiable.', 400)
  const fields = Object.fromEntries(entries)
  for (const [key, value] of entries) {
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) return jsonError('Valeur invalide pour un champ du catalogue.', 400)
    if (typeof value === 'string' && value.length > 10000) return jsonError('Un champ dépasse la longueur autorisée.', 400)
    if (['current_value', 'zero_defect_value'].includes(key) && value !== null && (!Number.isFinite(Number(value)) || Number(value) < 0)) return jsonError('Les valeurs de prix doivent être positives ou vides.', 400)
    if (key === 'case_unit_count' && value !== null && (!Number.isInteger(Number(value)) || Number(value) < 1)) return jsonError('Le nombre d’unités dans la case doit être un entier positif ou vide.', 400)
    if (key === 'release_year' && value !== null && (!Number.isInteger(Number(value)) || Number(value) < 1900 || Number(value) > 2200)) return jsonError('L’année de sortie doit être valide ou vide.', 400)
  }
  if ('name' in fields && (typeof fields.name !== 'string' || !fields.name.trim())) return jsonError('Le nom du produit ne peut pas être vide.', 400)
  if ('category' in fields && (typeof fields.category !== 'string' || !fields.category.trim())) return jsonError('La catégorie ne peut pas être vide.', 400)
  if (fields.case_unit_product_id && fields.case_unit_product_id === body.product_id) return jsonError('Une case ne peut pas contenir sa propre fiche produit.', 400)
  for (const key of Object.keys(fields)) if (typeof fields[key] === 'string' && fields[key].trim() === '') fields[key] = null

  const { data, error: updateError } = await adminClient.from('products').update(fields)
    .eq('id', body.product_id).select(productFields).maybeSingle()
  if (updateError) return jsonError('La fiche n’a pas pu être enregistrée. Vérifie les références et les formats.', 400)
  if (!data) return jsonError('La fiche produit est introuvable.', 404)
  return NextResponse.json({ product: data }, { headers: { 'Cache-Control': 'no-store' } })
}
