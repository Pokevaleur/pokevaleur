import './styles.css'

export const metadata = {
  title: 'PokéValeur',
  description: 'Suivez, estimez et organisez votre collection de cartes et produits scellés.'
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <header className="topbar">
          <a className="brand" href="/">PokéValeur</a>
          <nav>
            <a href="/">Accueil</a>
            <a href="/catalogue">Catalogue</a>
            <a href="/collection">Ma collection</a>
            <a href="/communaute">Communauté</a>
            <a href="/admin">Admin</a>
            <a href="/login" className="btn small">Connexion</a>
          </nav>
        </header>
        {children}
        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
        </footer>
      </body>
    </html>
  )
}
