import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '../../../../lib/supabase-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 500_000
const allowedHosts = [
  'pokepedia.fr', 'hikarudistribution.com', 'king-jouet.com', 'oupi.eu',
  'imaginaire.com', 'cmay-collections.com', 'shopify.com', 'pokezenith.com',
  'pokemon.com', 'pokemoncenter.com', 'tcgplayer.com', 'ebayimg.com',
  'gradedcardcenter.com', 'bcd-jeux.fr', 'pokemagic.fr', 'dracaugames.com',
  'tcgdirect.fr', 'plazatcg.com', 'ultrajeux.com', 'sneyzencorp.com',
  'pokevalue.fr', 'dexocard.com', 'bulbagarden.net', 'totalcards.net'
]

function imageResponse(bytes, contentType, cached = false) {
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}

export async function GET(_request, { params }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id || '')) return NextResponse.json({ error: 'Fiche introuvable.' }, { status: 404 })
  const publicDb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let { data: product, error } = await publicDb.from('products')
    .select('id,is_public,image_url,image_thumbnail_data')
    .eq('id', params.id).eq('is_public', true).maybeSingle()
  if (error) {
    // An image-cache column may not yet be visible to PostgREST after a schema
    // change. The public image can still be served from its original URL.
    console.error('[product-image] cached lookup failed', error.code || '', error.message || '')
    const fallback = await publicDb.from('products').select('id,is_public,image_url')
      .eq('id', params.id).eq('is_public', true).maybeSingle()
    product = fallback.data ? { ...fallback.data, image_thumbnail_data: null } : null
    error = fallback.error
    if (error) {
      console.error('[product-image] public product lookup failed', error.code || '', error.message || '')
      return NextResponse.json({ error: 'Fiche temporairement indisponible.' }, { status: 503 })
    }
  }
  if (!product) return NextResponse.json({ error: 'Fiche introuvable.' }, { status: 404 })

  const saved = String(product.image_thumbnail_data || '').match(new RegExp('^data:(image/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$'))
  if (saved) {
    const bytes = Buffer.from(saved[2], 'base64')
    if (bytes.length && bytes.length <= MAX_IMAGE_BYTES) return imageResponse(bytes, saved[1], true)
  }

  let source
  try { source = new URL(product.image_url) } catch { return NextResponse.json({ error: 'Image source invalide.' }, { status: 404 }) }
  const hostAllowed = allowedHosts.some(host => source.hostname === host || source.hostname.endsWith('.' + host))
  if (source.protocol !== 'https:' || !hostAllowed) return NextResponse.json({ error: 'Source image non autorisée.' }, { status: 404 })

  let upstream
  try {
    upstream = await fetch(source, { signal: AbortSignal.timeout(8000), headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' } })
  } catch { return NextResponse.json({ error: 'Image temporairement inaccessible.' }, { status: 502 }) }
  const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const length = Number(upstream.headers.get('content-length') || 0)
  if (!upstream.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType) || length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image source indisponible.' }, { status: 502 })
  }
  const bytes = Buffer.from(await upstream.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 413 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const dataUri = `data:${contentType};base64,${bytes.toString('base64')}`
    const { error: saveError } = await admin.from('products').update({ image_thumbnail_data: dataUri })
      .eq('id', product.id).is('image_thumbnail_data', null)
    if (saveError) console.error('[product-image] thumbnail save failed', saveError.code || '', saveError.message || '')
  }
  return imageResponse(bytes, contentType)
}