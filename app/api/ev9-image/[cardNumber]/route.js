const EV9_STAMP_IMAGES = {
  '069': {
    'set-logo': 'https://i.ebayimg.com/images/g/tuAAAeSwQWpo-8yo/s-l1200.jpg'
  },
  '098': {
    'master-ball-league': 'https://www.cardtrader.com/uploads/blueprints/image/331335/n-s-zoroark-ex-master-ball-league-promo-098-league-promos%282%29.jpg'
  },
  '114': {
    'set-logo': 'https://i.ebayimg.com/images/g/SCAAAeSw22RpDlRo/s-l1200.jpg'
  },
  '117': {
    'eb-games': 'https://i.ebayimg.com/images/g/gbgAAOSwPbhn-Fdz/s-l1200.png',
    'set-logo': 'https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/0NEAAOSwQjFn7TKu/$_57.PNG?set_id=880000500F'
  },
  '136': {
    'set-logo': 'https://i.ebayimg.com/images/g/zxEAAOSwzLJn7Ztb/s-l1200.jpg'
  },
  '149': {
    'ultra-ball-league': 'https://i.ebayimg.com/thumbs/images/g/VAQAAeSwTvxof01-/s-l500.jpg'
  }
}

const LEGACY_CARD_IMAGE_OVERRIDES = {
  '100': ['https://app.getzukan.com/img/tcgdex/fr/sv/sv09/100/high.webp'],
  '101': ['https://www.pokepedia.fr/images/7/76/Carte_%C3%89carlate_et_Violet_Aventures_Ensemble_101.png']
}

function normalizeCardNumber(value) {
  const match = String(value || '').match(/\d+/)
  return match ? String(Number(match[0])).padStart(3, '0') : ''
}

function ev9ImageCandidates(cardNumber, variant) {
  const number = normalizeCardNumber(cardNumber)
  if (!/^\d{3}$/.test(number) || Number(number) < 1 || Number(number) > 190) return []
  const stampedImage = EV9_STAMP_IMAGES[number]?.[variant]
  const cardId = String(Number(number))
  const baseImages = [
    `https://assets.tcgdex.net/fr/sv/sv09/${number}/high.webp`,
    `https://assets.tcgdex.net/fr/sv/sv09/${number}/low.webp`,
    `https://assets.tcgdex.net/en/sv/sv09/${number}/high.webp`,
    `https://assets.tcgdex.net/en/sv/sv09/${number}/low.webp`,
    `https://assets.tcgdex.net/fr/sv/sv09/${cardId}/high.webp`,
    `https://assets.tcgdex.net/fr/sv/sv09/${cardId}/low.webp`,
    `https://assets.tcgdex.net/en/sv/sv09/${cardId}/high.webp`,
    `https://assets.tcgdex.net/en/sv/sv09/${cardId}/low.webp`
  ]
  return [...new Set([stampedImage, ...(LEGACY_CARD_IMAGE_OVERRIDES[number] || []), ...baseImages].filter(Boolean))]
}

export async function GET(request, { params }) {
  const imageUrls = ev9ImageCandidates(params.cardNumber, new URL(request.url).searchParams.get('variant'))

  if (!imageUrls.length) {
    return new Response('Image inconnue', { status: 404 })
  }

  for (const imageUrl of imageUrls) {
    try {
      const upstream = await fetch(imageUrl, {
        headers: { 'User-Agent': 'PokeValeur/1.0 (card artwork proxy)' },
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
      // Try the next approved image for this EV9 card.
    }
  }

  return new Response('Aucune image trouvée pour cette carte', { status: 502 })
}
