const cardImages = {
  '100': 'https://app.getzukan.com/img/tcgdex/fr/sv/sv09/100/high.webp',
  '101': 'https://app.getzukan.com/img/tcgdex/fr/sv/sv09/101/high.webp'
}

export async function GET(_request, { params }) {
  const imageUrl = cardImages[params.cardNumber]

  if (!imageUrl) {
    return new Response('Image inconnue', { status: 404 })
  }

  try {
    const upstream = await fetch(imageUrl, { next: { revalidate: 86400 } })

    if (!upstream.ok || !upstream.body) {
      return new Response('Image indisponible', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'image/webp'
    if (!contentType.startsWith('image/')) {
      return new Response('Réponse image invalide', { status: 502 })
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return new Response('Image indisponible', { status: 502 })
  }
}
