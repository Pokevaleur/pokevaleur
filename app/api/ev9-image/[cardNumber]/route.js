const cardImages = {
  '100': [
    'https://app.getzukan.com/img/tcgdex/fr/sv/sv09/100/high.webp'
  ],
  '101': [
    'https://www.pokepedia.fr/images/7/76/Carte_%C3%89carlate_et_Violet_Aventures_Ensemble_101.png',
    'https://app.getzukan.com/img/tcgdex/fr/sv/sv09/101/high.webp'
  ]
}

export async function GET(_request, { params }) {
  const imageUrls = cardImages[params.cardNumber]

  if (!imageUrls) {
    return new Response('Image inconnue', { status: 404 })
  }

  for (const imageUrl of imageUrls) {
    try {
      const upstream = await fetch(imageUrl, {
        headers: { 'User-Agent': 'PokeValeur-preview/1.0' },
        next: { revalidate: 86400 }
      })

      if (!upstream.ok || !upstream.body) continue

      const contentType = upstream.headers.get('content-type') || 'image/webp'
      if (!contentType.startsWith('image/')) continue

      return new Response(upstream.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    } catch {
      // Try the next approved source for this specific card.
    }
  }

  return new Response('Image indisponible', { status: 502 })
}
