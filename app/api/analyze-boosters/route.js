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

    const itemResponse = await supabaseFetch('/rest/v1/collection_items?id=eq.' + encodeURIComponent(itemId) + '&user_id=eq.' + encodeURIComponent(user.id) + '&select=id,custom_name,booster_configuration,variant_note,product_id', token)
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
    let knownBoosters = boosterResponse.ok ? await boosterResponse.json() : []

    const refsResponseBefore = await supabaseFetch('/rest/v1/booster_reference_images?select=expansion_name,artwork_name,image_url,source_url,image_usage_status,visual_cues', token)
    const referenceBoosters = refsResponseBefore.ok ? await refsResponseBefore.json() : []

    const item = items[0]

    let expectedProductContents = []
    let expectedSeriesDefaults = []

    if (item.product_id) {
      const [expectedResponse, defaultsResponse] = await Promise.all([
        supabaseFetch('/rest/v1/product_contents?product_id=eq.' + encodeURIComponent(item.product_id) + '&content_type=eq.booster&select=item_name,quantity,source_label,confidence', token),
        supabaseFetch('/rest/v1/product_expected_booster_series?product_id=eq.' + encodeURIComponent(item.product_id) + '&select=series_name,expected_quantity,source_label,confidence', token)
      ])
      expectedProductContents = expectedResponse.ok ? await expectedResponse.json() : []
      expectedSeriesDefaults = defaultsResponse.ok ? await defaultsResponse.json() : []
    }

    const expectedBoosterSummary = expectedProductContents.length
      ? expectedProductContents.map(x => `${x.quantity} × ${x.item_name}`).join(' | ')
      : expectedSeriesDefaults.length
        ? expectedSeriesDefaults.map(x => `${x.expected_quantity ? x.expected_quantity + ' × ' : ''}${x.series_name}`).join(' | ')
        : 'Aucune composition catalogue connue.'

    // FIRST PASS EXTENSIONS ONLY:
    // If this item has no booster series yet, identify the visible series first and lock them
    // before attempting any artwork recognition. This prevents artwork guesses from dragging
    // the model into the wrong expansion.
    if (!knownBoosters.length) {
      const extensionPrompt = `Tu analyses plusieurs photos du MÊME coffret Pokémon scellé.
Ta seule mission est d'identifier les EXTENSIONS/SÉRIES des boosters visibles, PAS les artworks.
Composition catalogue attendue : ${expectedBoosterSummary}

Règles:
- Ignore complètement le Pokémon illustré sauf s'il aide à lire/reconnaître le design de la série.
- Base-toi d'abord sur le logo/nom de l'extension, la typographie, la mise en page du booster, les couleurs de fond et le design global.
- Plusieurs boosters peuvent appartenir à la même extension : conserve les doublons.
- Si la composition catalogue attendue est connue, respecte exactement ces quantités et utilise la photo seulement pour attribuer chaque série à une position.
- Ne cherche PAS encore le nom de l'artwork.
- Donne exactement une ligne par booster visible, avec sa position.
- Si une extension est partiellement masquée, propose la meilleure lecture avec confidence medium plutôt que d'inventer une autre série.
- Réponds uniquement en JSON valide:
{"boosters":[{"position":1,"expansion_name":"...","confidence":"high|medium|low","evidence":"indice visuel de série"}]}`

      try {
        const extensionResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-5.6-luna',
            input: [{ role: 'user', content: [{ type: 'input_text', text: extensionPrompt }, ...images] }],
            text: { format: { type: 'json_object' } }
          })
        })
        if (extensionResponse.ok) {
          const extAi = await extensionResponse.json()
          const extText = extAi.output?.flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text
          if (extText) {
            const extResult = JSON.parse(extText)
            if (Array.isArray(extResult.boosters)) {
              knownBoosters = extResult.boosters
                .filter(b => b?.expansion_name)
                .map((b, i) => ({
                  position: Number(b.position) || i + 1,
                  expansion_name: b.expansion_name,
                  artwork_name: null,
                  confirmed: false,
                  confidence: ['high','medium','low'].includes(b.confidence) ? b.confidence : 'low',
                  evidence: b.evidence || null
                }))
            }
          }
        }
      } catch {
        // Fall back to the general pass below if extension-only analysis fails.
      }
    }

    const knownComposition = knownBoosters.length
      ? knownBoosters.map(b => {
          const allowed = referenceBoosters
            .filter(r => normalizeExpansion(r.expansion_name) === normalizeExpansion(b.expansion_name))
            .map(r => r.artwork_name + (r.visual_cues ? ' [' + r.visual_cues + ']' : ''))
          return `Position ${b.position}: extension=${b.expansion_name || 'inconnue'}, artwork=${b.artwork_name || 'inconnu'}, confirmé=${b.confirmed ? 'oui' : 'non'}, artworks possibles=${allowed.length ? allowed.join(' | ') : 'non référencés'}`
        }).join('\n')
      : 'Aucune position déjà enregistrée.'

    const instructions = `Tu analyses des photos d'un exemplaire Pokémon scellé afin d'identifier les boosters visibles à l'intérieur.
Toutes les images montrent LE MÊME exemplaire sous plusieurs angles.
Composition catalogue attendue pour ce produit : ${expectedBoosterSummary}
Nom saisi: ${item.custom_name || 'inconnu'}.
Composition déjà renseignée: ${item.booster_configuration || 'aucune'}.
Note variante: ${item.variant_note || 'aucune'}.
Composition déjà connue par position:
${knownComposition}

Règles impératives:
- Si une composition catalogue attendue est fournie, elle est PRIORITAIRE pour les séries et les quantités. L'analyse visuelle doit répartir ces séries entre les positions visibles, pas inventer d'autres extensions.
- Une extension déjà renseignée pour une position est VERROUILLÉE : ne la remplace jamais par une autre extension.
- Si ces extensions viennent de la première passe, considère-les comme la base de travail et cherche seulement l'artwork à l'intérieur de chacune.
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
      evidence: b.evidence || knownBoosters.find(k => Number(k.position) === (Number(b.position) || i + 1))?.evidence || null,
      candidates: Array.isArray(b.candidates) ? b.candidates.slice(0, 3).map(candidate => ({
        expansion_name: candidate.expansion_name || null,
        artwork_name: candidate.artwork_name || null,
        confidence: ['high','medium','low'].includes(candidate.confidence) ? candidate.confidence : 'low'
      })) : []
    })) : []

    // SECOND PASS TARGETED ARTWORK: inspect each unresolved position separately.
    // One request per slot gives the model a narrower visual task and avoids cross-position swaps.
    const unresolved = result.boosters.filter(b => {
      const known = knownBoosters.find(k => Number(k.position) === Number(b.position))
      if (known?.confirmed) return false
      return !b.artwork_name || b.confidence === 'low' || b.confidence === 'medium'
    })

    const slotNames = {
      1: 'haut gauche',
      2: 'haut droite',
      3: 'bas gauche',
      4: 'bas droite'
    }

    const refinements = await Promise.all(unresolved.map(async booster => {
      const known = knownBoosters.find(k => Number(k.position) === Number(booster.position))
      const expansion = known?.expansion_name || booster.expansion_name
      const choices = referenceBoosters
        .filter(r => normalizeExpansion(r.expansion_name) === normalizeExpansion(expansion))
        .map(r => ({
          artwork_name: r.artwork_name,
          visual_cues: r.visual_cues || ''
        }))

      if (!expansion || !choices.length) return null

      const slot = slotNames[Number(booster.position)] || ('position ' + booster.position)
      const prompt = `Tu dois identifier UN SEUL booster visible dans un coffret Pokémon.
Emplacement à examiner : ${slot} (position ${booster.position}).
Extension VERROUILLÉE : ${expansion}.
Tu n'as pas le droit de changer l'extension.
Artworks autorisés et indices discriminants :
${choices.map(x => '- ' + x.artwork_name + ': ' + (x.visual_cues || 'aucun indice spécifique')).join('\n')}.

Inspecte très précisément les fragments visibles sur TOUTES les photos : couleurs dominantes, silhouette, tête/corps du Pokémon, orientation, fond, lignes graphiques, zones claires/sombres, bordures et éléments distinctifs.
Ignore les autres boosters sauf pour te repérer spatialement.
Choisis l'artwork le plus probable parmi la liste autorisée. Si deux restent possibles, donne le meilleur candidat en confidence medium et indique l'alternative dans evidence.
Réponds uniquement en JSON :
{"position":${booster.position},"artwork_name":"...","confidence":"high|medium|low","evidence":"...","candidates":[{"artwork_name":"...","confidence":"high|medium|low"}]}`

      try {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-5.6-luna',
            input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, ...images] }],
            text: { format: { type: 'json_object' } }
          })
        })
        if (!response.ok) return null
        const ai2 = await response.json()
        const text2 = ai2.output?.flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text
        if (!text2) return null
        const refined = JSON.parse(text2)
        return { booster, known, expansion, choices, refined }
      } catch {
        return null
      }
    }))

    for (const refinement of refinements) {
      if (!refinement) continue
      const { booster, known, expansion, choices, refined } = refinement
      if (!refined?.artwork_name) continue

      const allowedLower = choices.map(x => x.artwork_name.toLowerCase())
      if (!allowedLower.includes(String(refined.artwork_name).toLowerCase())) continue

      const target = result.boosters.find(x => Number(x.position) === Number(booster.position))
      if (!target) continue

      target.expansion_name = known?.expansion_name || target.expansion_name
      target.artwork_name = refined.artwork_name
      target.confidence = ['high','medium','low'].includes(refined.confidence) ? refined.confidence : 'medium'
      target.evidence = refined.evidence || target.evidence
      target.candidates = Array.isArray(refined.candidates)
        ? refined.candidates
            .filter(x => x?.artwork_name && allowedLower.includes(String(x.artwork_name).toLowerCase()))
            .slice(0,3)
            .map(x => ({
              expansion_name: known?.expansion_name || expansion,
              artwork_name: x.artwork_name,
              confidence: ['high','medium','low'].includes(x.confidence) ? x.confidence : 'low'
            }))
        : target.candidates
    }

    const candidatePairs = result.boosters.flatMap(b => b.candidates || []).filter(c => c.expansion_name && c.artwork_name)
    if (candidatePairs.length) {
      const refs = referenceBoosters
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
            source_url: ref?.source_url || null,
            visual_cues: ref?.visual_cues || null
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
