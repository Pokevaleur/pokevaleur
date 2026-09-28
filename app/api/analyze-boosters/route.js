import { NextResponse } from 'next/server'

const SUPABASE_URL = 'https://zrvjbvhumyizutnjzljy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpydmpidmh1bXlpenV0bmp6bGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NDY1NzgsImV4cCI6MjEwNjEyMjU3OH0.-_7bTy9dYncvYveoQuGNaqTnR83HL_r9aoWkV-wTqC8'

export const maxDuration = 60

async function supabaseFetch(path, token) {
  return fetch(SUPABASE_URL + path, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  })
}

function normalizeExpansion(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^eb\s*\d+\s*[—-]?\s*/i, '')
    .replace(/^epee et bouclier\s*[—-]\s*/i, '')
    .trim()
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

    const boosterResponse = await supabaseFetch('/rest/v1/collection_item_boosters?collection_item_id=eq.' + encodeURIComponent(itemId) + '&user_id=eq.' + encodeURIComponent(user.id) + '&select=position,expansion_name,artwork_name,confirmed&order=position.asc', token)
    const knownBoosters = boosterResponse.ok ? await boosterResponse.json() : []

    const refsResponseBefore = await supabaseFetch('/rest/v1/booster_reference_images?select=expansion_name,artwork_name,image_url,source_url,image_usage_status', token)
    const referenceBoosters = refsResponseBefore.ok ? await refsResponseBefore.json() : []

    const item = items[0]
    const knownComposition = knownBoosters.length
      ? knownBoosters.map(b => {
          const allowed = referenceBoosters
            .filter(r => normalizeExpansion(r.expansion_name) === normalizeExpansion(b.expansion_name))
            .map(r => r.artwork_name)
          return `Position ${b.position}: extension=${b.expansion_name || 'inconnue'}, artwork=${b.artwork_name || 'inconnu'}, confirmé=${b.confirmed ? 'oui' : 'non'}, artworks possibles=${allowed.length ? allowed.join(' | ') : 'non référencés'}`
        }).join('\n')
      : 'Aucune position déjà enregistrée.'

    const instructions = `Tu analyses des photos d'un exemplaire Pokémon scellé afin d'identifier les boosters visibles à l'intérieur.
Toutes les images montrent LE MÊME exemplaire sous plusieurs angles.
Nom saisi: ${item.custom_name || 'inconnu'}.
Composition déjà renseignée: ${item.booster_configuration || 'aucune'}.
Note variante: ${item.variant_note || 'aucune'}.
Composition déjà connue par position:
${knownComposition}

Règles impératives:
- Une extension déjà renseignée pour une position est une contrainte forte : ne la remplace jamais par une autre extension.
- Une ligne confirmée par l'utilisateur est verrouillée : ne change ni son extension ni son artwork.
- Si l'extension est connue mais l'artwork manque, identifie uniquement l'artwork parmi ceux de CETTE extension.
- Le but est d'identifier les boosters même lorsqu'ils ne sont visibles qu'en partie derrière la fenêtre du coffret.
- Ne demande pas systématiquement une photo complète de chaque booster. Exploite les fragments visibles : palette de couleurs, silhouette ou morceau du Pokémon, fond, bordure, logo d'extension, typographie, position dans le coffret et correspondances entre plusieurs angles.
- Une petite portion distinctive peut suffire à proposer un artwork avec une confiance medium ou high si elle permet de le distinguer raisonnablement des autres artworks plausibles.
- Utilise le nom du produit comme contexte pour réduire l'ensemble des extensions plausibles, sans supposer que deux exemplaires du même coffret ont la même composition.
- Croise toutes les photos du même exemplaire avant de conclure pour chaque position.
- Si plusieurs candidats restent plausibles, propose le meilleur candidat avec confidence low ou medium et indique brièvement l'alternative dans evidence, au lieu de laisser systématiquement artwork_name à null.
- Mets expansion_name ou artwork_name à null seulement si aucun candidat raisonnable ne peut être proposé à partir des indices visibles.
- confirmed n'est jamais décidé par l'IA : l'utilisateur validera ensuite.
- needs_additional_photo=true uniquement lorsqu'une nouvelle photo est réellement nécessaire pour départager des candidats plausibles. Dans ce cas, demande une zone précise, pas de photographier chaque booster séparément.
- Pour chaque booster incertain, renvoie aussi jusqu'à 3 candidats plausibles classés du plus probable au moins probable.
- Chaque candidat contient expansion_name, artwork_name et confidence.
- Réponds uniquement avec du JSON valide, sans markdown, sous la forme:
{"boosters":[{"position":1,"expansion_name":"... ou null","artwork_name":"... ou null","confidence":"high|medium|low","evidence":"indice visuel bref, et alternative éventuelle","candidates":[{"expansion_name":"...","artwork_name":"...","confidence":"high|medium|low"}]}],"needs_additional_photo":true,"photo_instruction":"... ou null"}`

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
      evidence: b.evidence || null,
      candidates: Array.isArray(b.candidates) ? b.candidates.slice(0, 3).map(candidate => ({
        expansion_name: candidate.expansion_name || null,
        artwork_name: candidate.artwork_name || null,
        confidence: ['high','medium','low'].includes(candidate.confidence) ? candidate.confidence : 'low'
      })) : []
    })) : []

    // SECOND PASS TARGETED ARTWORK: for unresolved/low-confidence positions, analyze again
    // with the extension locked and only its known pack artworks as candidates.
    const unresolved = result.boosters.filter(b => {
      const known = knownBoosters.find(k => Number(k.position) === Number(b.position))
      if (known?.confirmed) return false
      return !b.artwork_name || b.confidence === 'low'
    })

    const unresolvedWithChoices = unresolved.map(b => {
      const known = knownBoosters.find(k => Number(k.position) === Number(b.position))
      const expansion = known?.expansion_name || b.expansion_name
      const choices = referenceBoosters
        .filter(r => normalizeExpansion(r.expansion_name) === normalizeExpansion(expansion))
        .map(r => r.artwork_name)
      return { position: b.position, expansion, choices }
    }).filter(x => x.expansion && x.choices.length)

    if (unresolvedWithChoices.length) {
      const secondPassPrompt = `Fais une seconde inspection VISUELLE, plus fine, des mêmes photos.
Chaque ligne ci-dessous a une extension verrouillée. Tu dois seulement choisir l'artwork parmi la liste autorisée pour cette position.
Observe les petits fragments visibles: couleurs, silhouette, orientation du Pokémon, fond, zones sombres/claires, bordures, éléments distinctifs. Croise toutes les photos.
Ne change jamais l'extension. Si tu hésites entre deux artworks, donne le meilleur candidat avec confidence medium et une courte evidence.

Positions à résoudre:
${unresolvedWithChoices.map(x => `Position ${x.position} — extension: ${x.expansion} — choix autorisés: ${x.choices.join(' | ')}`).join('\n')}

Réponds uniquement en JSON:
{"boosters":[{"position":1,"artwork_name":"...","confidence":"high|medium|low","evidence":"..."}]}`

      const secondResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5.6-luna',
          input: [{ role: 'user', content: [{ type: 'input_text', text: secondPassPrompt }, ...images] }],
          text: { format: { type: 'json_object' } }
        })
      })

      if (secondResponse.ok) {
        const secondAi = await secondResponse.json()
        const secondText = secondAi.output?.flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text
        if (secondText) {
          const refined = JSON.parse(secondText)
          const refinedBoosters = Array.isArray(refined.boosters) ? refined.boosters : []
          result.boosters = result.boosters.map(b => {
            const known = knownBoosters.find(k => Number(k.position) === Number(b.position))
            if (known?.confirmed) return b
            const r = refinedBoosters.find(x => Number(x.position) === Number(b.position))
            if (!r?.artwork_name) return b

            const expansion = known?.expansion_name || b.expansion_name
            const allowed = referenceBoosters
              .filter(ref => normalizeExpansion(ref.expansion_name) === normalizeExpansion(expansion))
              .map(ref => ref.artwork_name.toLowerCase())

            if (!allowed.includes(String(r.artwork_name).toLowerCase())) return b

            return {
              ...b,
              expansion_name: known?.expansion_name || b.expansion_name,
              artwork_name: r.artwork_name,
              confidence: ['high','medium','low'].includes(r.confidence) ? r.confidence : 'medium',
              evidence: r.evidence || b.evidence
            }
          })
        }
      }
    }

        const candidatePairs = result.boosters.flatMap(b => b.candidates || []).filter(c => c.expansion_name && c.artwork_name)
    if (candidatePairs.length) {
      const refsResponse = await supabaseFetch('/rest/v1/booster_reference_images?select=expansion_name,artwork_name,image_url,source_url,image_usage_status', token)
      const refs = refsResponse.ok ? await refsResponse.json() : []
      result.boosters = result.boosters.map(booster => ({
        ...booster,
        candidates: (booster.candidates || []).map(candidate => {
          const ref = refs.find(r =>
            String(r.expansion_name || '').toLowerCase() === String(candidate.expansion_name || '').toLowerCase() &&
            String(r.artwork_name || '').toLowerCase() === String(candidate.artwork_name || '').toLowerCase()
          )
          return {
            ...candidate,
            image_url: ref?.image_url || null,
            source_url: ref?.source_url || null
          }
        })
      }))
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('analyze-boosters', error)
    return NextResponse.json({ error: 'Erreur pendant l’analyse des photos.' }, { status: 500 })
  }
}
