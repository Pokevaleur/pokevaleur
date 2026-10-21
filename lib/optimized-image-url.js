const optimizedImageHosts = [
  '*.supabase.co',
  '*.supabase.in',
  'assets.tcgdex.net',
  'images-cartes.pokevalue.fr',
  'www.dexocard.com',
  'cdn.beebs.app',
  'cdn.svc.asmodee.net',
  'de.fantasysphere.net',
  'images.king-jouet.com',
  'pokemagic.fr',
  'pokemon.com',
  '*.pokemon.com',
  'pokepedia.fr',
  'www.pokepedia.fr',
  'archives.bulbagarden.net',
  'cdn.assets.prezly.com',
  'facetofacegames.com',
  'threestarssportscards.com',
  'slabstat-production.s3.amazonaws.com',
  'bogcollectibles.com',
  'totalcards.net',
  'i.ebayimg.com',
  'cdn.gradedcardcenter.com'
]

function isConfiguredForOptimization(hostname) {
  return optimizedImageHosts.some(pattern => {
    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(2)
      return hostname.endsWith('.' + domain)
    }
    return hostname === pattern
  })
}

export function getOptimizedImageUrl(src, width = 384, quality = 70) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src

  try {
    const { hostname } = new URL(src, 'https://pokevalue.fr')
    if (!isConfiguredForOptimization(hostname)) return src
  } catch {
    return src
  }

  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
}
