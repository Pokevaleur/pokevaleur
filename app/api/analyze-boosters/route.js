import { NextResponse } from 'next/server'

const SUPABASE_URL = 'https://zrvjbvhumyizutnjzljy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoienJ2amJ2aHVteWl6dXRuanpsankiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc5MDU0NjU3OCwiZXhwIjoyMTA2MTIyNTc4fQ.-_7bTy9dYncvYveoQuGNaqTnR83HL_r9aoWkV-wTqC8'

export const maxDuration = 60

async function supabaseFetch(path, token) {
  return fetch(SUPABASE_URL + path, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  })
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY absente sur le serveur.' }, { status: 503 })
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Session requise.' }, { status: 401 })
    const { itemId } = await request.json()
    if (!itemId) return NextResponse.json({ error: 'Produit manquant.' }, { status: 400 })

    const userResponse = await supabaseFetch('/auth/v1/user', token)
    if (!userResponse.ok) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
    const user = await userResponse.json()

    const itemResponse = await supabaseFetch('/rest/v1/collection_items?id=eq.' + encodeURIComponent(itemId) + '&user_id=eq.' + encodeURIComponent(user.id) + '&select=id,custom_name,booster_configuration,variant_note', token)
    const items = await itemResponse.json()
    if (!itemResponse.ok || !items?.length) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })

    const photosResponse = await supabaseFetch('/rest/v1/collection_item_photos?collection_item_id=eq.' + encodeURIComponent(itemId) + '&user_id=eq.' + encodeURIComponent(user.id) + '&select=photo_path&order=sort_order.asc', token)
    const photoRows = await photosResponse.json()
    if (!photosResponse.ok || !photoRows?.length) return NextResponse.json({ error: 'Aucune photo à analyser.' }, { status: 400 })

    const images = []
    for (const photo of photoRows.slice(0, 6)) {
      const imageResponse = await fetch(SUPABASE_URL + '/storage/v1/object/authenticated/collection-images/' + photo.photo_path.split('/').map(encodeURIComponent).join('/'), {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
      })
      if (!imageResponse.ok) continue
      const type = imageResponse.headers.get('content-type') || 'image/jpeg'
      const bytes = Buffer.from(await imageResponse.arrayBuffer())
      images.push({ type: 'input_image', image_url: 'data:' + type + ';base64,' + bytes.toString('base64'), detail: 'high' })
    }
    if (!images.length) return NextResponse.json({ error: 'Les photos n’ont pas pu être lues.' }, { status: 400 })

    const item = items[0]
    const instructions = `Tu analyses des photos d'un exemplaire Pokémon scellé afin d'identifier les boosters visibles à l'intérieur.
Toutes les images montrent LE MÊME exemplaire sous plusieurs angles.
Nom saisi: ${item.custom_name || 'inconnu'}.
Composition déjà renseignée: ${item.booster_configuration || 'aucune'}.
Note variante: ${item.variant_note || 'aucune'}.

Règles impératives:
- N'invente jamais un artwork. Si le fragment visible est insuffisant, artwork_name doit être null et confidence low.
- Utilise d'abord les indices visibles: logo/nom d'extension, couleurs, Pokémon/artwork, position et fragments.
- Plusieurs photos doivent être croisées pour une même position.
- confirmed n'est jamais décidé par l'IA: l'utilisateur validera ensuite.
- Si une autre photo aiderait, needs_additional_photo=true et photo_instruction explique précisément quelle zone/quel angle photographier.
- Réponds uniquement avec du JSON valide, sans markdown, sous la forme:
{"boosters":[{"position":1,"expansion_name":"... ou null","artwork_name":"... ou null","confidence":"high|medium|low","evidence":"indice visuel bref"}],"needs_additional_photo":true,"photo_instruction":"... ou null"}`

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [{ role: 'user', content: [{ type: 'input_text', text: instructions }, ...images] }],
        text: { format: { type: 'json_object' } }
      })
    })
    const ai = await openaiResponse.json()
    if (!openaiResponse.ok) return NextResponse.json({ error: ai?.error?.message || 'Erreur du moteur IA.' }, { status: 502 })
    const outputText = ai.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text
    if (!outputText) return NextResponse.json({ error: 'L’analyse n’a retourné aucun résultat.' }, { status: 502 })
    const result = JSON.parse(outputText)
    result.boosters = Array.isArray(result.boosters) ? result.boosters.map((b, i) => ({
      position: Number(b.position) || i + 1,
      expansion_name: b.expansion_name || null,
      artwork_name: b.artwork_name || null,
      confidence: ['high','medium','low'].includes(b.confidence) ? b.confidence : 'low',
      evidence: b.evidence || null
    })) : []
    return NextResponse.json(result)
  } catch (error) {
    console.error('analyze-boosters', error)
    return NextResponse.json({ error: 'Erreur pendant l’analyse des photos.' }, { status: 500 })
  }
}
