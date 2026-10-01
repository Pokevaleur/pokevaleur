import './styles.css'
import Navigation from './navigation'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export const metadata = {
  title: 'PokéValeur',
  description: 'Suivez, estimez et organisez votre collection de cartes et produits scellés.'
}

const navLinks = [
  ['/', 'Accueil'],
  ['/catalogue', 'Catalogue'],
  ['/collection', 'Ma collection'],
  ['/opportunites', 'Watchlist'],
  ['/communaute', 'Communauté'],
  ['/trades', 'Trades'],
  ['/progression', 'Mon grade'],
  ['/coffre', 'Coffre de Lukulu']
]

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <header className="topbar">
          <a className="brand" href="/">PokéValeur</a>

          <Navigation links={navLinks} />
        </header>

        {children}

        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
        </footer>
      </body>
    </html>
  )
}
