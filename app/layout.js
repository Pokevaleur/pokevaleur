import './styles.css'

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
  ['/admin', 'Admin']
]

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <header className="topbar">
          <a className="brand" href="/">PokéValeur</a>

          <nav className="desktopNav">
            {navLinks.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
            <a href="/login" className="btn small">Connexion</a>
          </nav>

          <details className="mobileMenu">
            <summary aria-label="Ouvrir le menu">☰</summary>
            <div className="mobileMenuPanel">
              {navLinks.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
              <a href="/login" className="btn small">Connexion</a>
            </div>
          </details>
        </header>

        {children}

        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
        </footer>
      </body>
    </html>
  )
}
