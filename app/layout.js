import './styles.css'
import SiteHeader from './site-header'

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
  { href: '/', label: 'Accueil' },
  {
    label: 'Catalogue',
    children: [
      { href: '/catalogue', label: 'Produits scellés' },
      { href: '/catalogue?search=ETB', label: 'ETB' },
      { href: '/catalogue/cartes', label: 'Cartes' }
    ]
  },
  {
    label: 'Ma Collection',
    children: [
      { href: '/collection', label: 'Produits scellés' },
      { href: '/collection?search=ETB', label: 'ETB' },
      { href: '/collection/cartes', label: 'Cartes', memberOnly: true },
      { href: '/collection/statistiques', label: 'Statistiques', memberOnly: true }
    ]
  },
  { href: '/opportunites', label: 'Watchlist' },
  { href: '/communaute', label: 'Communauté' },
  { href: '/trades', label: 'Trades' },
  { href: '/progression', label: 'Mon grade' },
  { href: '/coffre', label: 'Coffre de Lukulu' }
]

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <SiteHeader links={navLinks} />

        {children}

        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
        </footer>
      </body>
    </html>
  )
}
