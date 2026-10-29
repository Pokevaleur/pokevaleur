import { NextResponse } from 'next/server'

const SUPABASE_URL = 'https://zrvjbvhumyizutnjzljy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpydmpidmh1bXlpenV0bmp6bGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NDY1NzgsImV4cCI6MjEwNjEyMjU3OH0.-_7bTy9dYncvYveoQuGNaqTnR83HL_r9aoWkV-wTqC8'

export const maxDuration = 30

async function getSignedInUser(token) {
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  })
  return response.ok ? response.json() : null
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Lecture visuelle indisponible.' }, { status: 503 })
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Session requise.' }, { status: 401 })

    const user = await getSignedInUser(token)
    if (!user?.id) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const form = await request.formData()
    const image = form.get('image')
    if (!image || typeof image.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Photo de carte manquante.' }, { status: 400 })
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: 'Format d’image non pris en charge.' }, { status: 400 })
    }
    if (image.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'La photo dépasse 8 Mo.' }, { status: 413 })
    }

    const rateResponse = await fetch(SUPABASE_URL + '/rest/v1/rpc/check_api_rate_limit', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_route: 'identify-card', p_limit: 20, p_window_seconds: 3600 })
    })
    const rateAllowed = rateResponse.ok ? await rateResponse.json() : false
    if (!rateAllowed) {
      return NextResponse.json({ error: 'Limite de scans atteinte. Réessaie plus tard.' }, { status: 429 })
    }

    const bytes = Buffer.from(await image.arrayBuffer())
    const imageUrl = 'data:' + image.type + ';base64,' + bytes.toString('base64')
    const prompt = `Lis cette photo d’une seule carte Pokémon pour retrouver sa fiche exacte dans un catalogue.\n\nRègles essentielles :\n- Le nom demandé est le grand nom du Pokémon en haut de la carte, près des PV.\n- Ignore le nom après « Évolution de », ainsi que les noms dans les attaques, talents, descriptions et illustrations.\n- Lis le numéro de collection imprimé en bas de la carte. Conserve le format avec total s’il est visible, par exemple TG04/TG30.\n- N’invente ni nom, ni numéro, ni série. Mets null si tu ne peux pas lire le champ.\n- Réponds uniquement avec un objet JSON : {"card_name":string|null,"collector_number":string|null,"set_name":string|null,"language":"FR"|"JP"|"CN"|"EN"|null,"confidence":"high"|"medium"|"low"}.`

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [{ role: 'user', content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: imageUrl, detail: 'original' }
        ] }],
        text: { format: { type: 'json_object' } }
      })
    })
    const payload = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: 'La lecture visuelle a échoué.' }, { status: 502 })
    }

    const outputText = payload.output?.flatMap(item => item.content || [])
      .find(item => item.type === 'output_text')?.text
    if (!outputText) return NextResponse.json({ error: 'Aucun texte lisible sur la carte.' }, { status: 502 })

    const result = JSON.parse(outputText)
    const clean = value => typeof value === 'string' ? value.trim().slice(0, 100) || null : null
    return NextResponse.json({
      card_name: clean(result.card_name),
      collector_number: clean(result.collector_number),
      set_name: clean(result.set_name),
      language: ['FR', 'JP', 'CN', 'EN'].includes(result.language) ? result.language : null,
      confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low'
    })
  } catch {
    return NextResponse.json({ error: 'Impossible de lire cette photo.' }, { status: 500 })
  }
}
