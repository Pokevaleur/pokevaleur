import './styles.css'
import SiteHeader from './site-header'
import InstallPrompt from './install-prompt'
import navLinks from './navigation-links'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export const metadata = {
  metadataBase: new URL('https://www.pokevaleur.fr'),
  title: {
    default: 'PokéValeur – suivi de collection Pokémon',
    template: '%s | PokéValeur'
  },
  manifest: '/manifest.json',
  applicationName: 'PokéValeur',
  description: 'PokéValeur est un service français pour organiser et suivre sa collection Pokémon : cartes, classeurs, cartes gradées et produits scellés.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'PokéValeur',
    title: 'PokéValeur – suivi de collection Pokémon',
    description: 'PokéValeur est un service français pour organiser et suivre sa collection Pokémon : cartes, classeurs, cartes gradées et produits scellés.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'PokéValeur, organise ta collection Pokémon' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PokéValeur – suivi de collection Pokémon',
    description: 'PokéValeur est un service français pour organiser et suivre sa collection Pokémon : cartes, classeurs, cartes gradées et produits scellés.',
    images: ['/opengraph-image']
  }
}


export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <SiteHeader links={navLinks} />
        <InstallPrompt />

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'PokéValeur',
            alternateName: 'PokéValeur.fr',
            description: 'Service français indépendant pour organiser et suivre une collection Pokémon.',
            url: 'https://www.pokevaleur.fr',
            logo: 'https://www.pokevaleur.fr/icon.svg'
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'PokéValeur',
            alternateName: 'PokéValeur.fr',
            url: 'https://www.pokevaleur.fr',
            inLanguage: 'fr-FR',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://www.pokevaleur.fr/catalogue?search={search_term_string}',
              'query-input': 'required name=search_term_string'
            }
          }
        ]).replace(/</g, '\\u003c') }} />

        {children}

        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
          <p>Une question ou un problème à signaler ? <a href="mailto:contact@pokevaleur.fr" style={{ color: "#1476cb", fontWeight: 700, textDecoration: "underline" }}>Contactez-nous à contact@pokevaleur.fr</a>.</p>
        </footer>
      </body>
    </html>
  )
}
