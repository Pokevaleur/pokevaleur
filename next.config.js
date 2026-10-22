const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://assets.tcgdex.net https://images-cartes.pokevalue.fr https://www.dexocard.com https://cdn.beebs.app https://cdn.svc.asmodee.net https://de.fantasysphere.net https://images.king-jouet.com https://pokemagic.fr https://pokemon.com https://*.pokemon.com https://www.pokemon-card.com https://pokepedia.fr https://www.pokepedia.fr https://archives.bulbagarden.net https://cdn.assets.prezly.com https://facetofacegames.com https://threestarssportscards.com https://slabstat-production.s3.amazonaws.com https://bogcollectibles.com https://totalcards.net https://i.ebayimg.com https://cdn.gradedcardcenter.com https://www.pokemoncenter.com https://i5.walmartimages.com https://bananagames.ca https://eclipsecards.com https://joshscards.com https://remicardtrader.ca https://cdn11.bigcommerce.com https://common-lands.com https://myshopville.com https://images.stockx.com https://cdn.shopify.com https://kingcard.ca https://randcards.com https://static.wixstatic.com https://superanimestore.com https://tcgspy.com https://thecollectionrealm.com https://www.bazaargames.nl https://www.rollplaygames.co.uk https://www.ultrajeux.com https://adventurecardz.de https://animalkingdoms.co.nz https://aquitaz.se https://assets.kmart.com.au https://boosterboyz.com https://card-binder.com https://cardshoplive.com https://cardtreasure.ch https://cdn2.pokemoncarte.com https://collect.thegamecollection.net https://collectorstore.com https://d2j6dbq0eux0bg.cloudfront.net https://doc.smarty.cz https://gameostorus.com https://gomagcdn.ro https://hobby151.com https://iconsofsport.com.au https://images.novelship.com https://images.pristineauction.com https://konzolteszt.cdn.shoprenter.hu https://krynn.ca https://loosepacks.com https://media.cdn.kaufland.de https://mikitcg.com https://obsidia-tcg.store https://oupi.eu https://pack-fresh.com https://play-e.com https://pokedecks.uk https://pokesumo.com https://product-images.tcgplayer.com https://primary.jwwb.nl https://prixtcg.fr https://quazacollect.com https://shinobicollectibles.com https://shopcollectorsclub.com https://static.gamesmen.com.au https://static01.galaxus.com https://tcg-house.co.uk https://tcgstore.se https://www.asmodee.co.uk https://www.booghe.co.uk https://www.cardtrader.com https://www.danireon.com https://www.destocktcg.fr https://www.figurines-goodies.com https://www.gate-to-the-games.de https://www.justahobby.store https://www.maziply.com https://www.miraicards.com https://www.pokebruvs.com https://www.popcultcha.com.au https://www.sirengames.at https://www.solarpop.co.za https://www.steelcitycollectibles.com https://www.steelduck.de https://www.totalcards.net https://www.toys4you.co.uk https://zulusgames.com",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
      "upgrade-insecure-requests"
    ].join('; ')
  }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/**' },
      { protocol: 'https', hostname: '*.supabase.in', pathname: '/**' },
      { protocol: 'https', hostname: 'assets.tcgdex.net', pathname: '/**' },
      { protocol: 'https', hostname: 'images-cartes.pokevalue.fr', pathname: '/**' },
      { protocol: 'https', hostname: 'www.dexocard.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.beebs.app', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.svc.asmodee.net', pathname: '/**' },
      { protocol: 'https', hostname: 'de.fantasysphere.net', pathname: '/**' },
      { protocol: 'https', hostname: 'images.king-jouet.com', pathname: '/**' },
      { protocol: 'https', hostname: 'pokemagic.fr', pathname: '/**' },
      { protocol: 'https', hostname: 'pokemon.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.pokemon.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.pokemon-card.com', pathname: '/**' },
      { protocol: 'https', hostname: 'pokepedia.fr', pathname: '/**' },
      { protocol: 'https', hostname: 'www.pokepedia.fr', pathname: '/**' },
      { protocol: 'https', hostname: 'archives.bulbagarden.net', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.assets.prezly.com', pathname: '/**' },
      { protocol: 'https', hostname: 'facetofacegames.com', pathname: '/**' },
      { protocol: 'https', hostname: 'threestarssportscards.com', pathname: '/**' },
      { protocol: 'https', hostname: 'slabstat-production.s3.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'bogcollectibles.com', pathname: '/**' },
      { protocol: 'https', hostname: 'totalcards.net', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ebayimg.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.gradedcardcenter.com', pathname: '/**' }
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ]
  }
}

module.exports = nextConfig
