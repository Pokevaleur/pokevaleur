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
  title: 'PokéValeur',
  manifest: '/manifest.json',
  description: 'Suivez, estimez et organisez votre collection de cartes et produits scellés.'
}


export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <SiteHeader links={navLinks} />
        <InstallPrompt />

        {children}

        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
        </footer>
      </body>
    </html>
  )
}
