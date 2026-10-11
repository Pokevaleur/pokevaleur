import './styles.css'
import SiteHeader from './site-header'
import InstallPrompt from './install-prompt'

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
      { href: '/collection/statistiques', label: 'Statistiques', memberOnly: true },
      { href: '/collection/classeurs', label: 'Mes classeurs', memberOnly: true },
      {
        href: '/collection/statistiques',
        label: 'Valeur',
        memberOnly: true,
        children: [
          { href: '/collection/statistiques', label: 'Vue d’ensemble', memberOnly: true },
          { href: '/collection', label: 'Produits scellés', memberOnly: true },
          {
            href: '/collection/valeur/cartes',
            label: 'Cartes',
            memberOnly: true,
            children: [
              { href: '/collection/valeur/cartes', label: 'Par série', memberOnly: true },
              { href: '/catalogue/cartes', label: 'Carte individuelle', memberOnly: true },
              { href: '/collection/stats?category=graded', label: 'Cartes gradées', memberOnly: true }
            ]
          }
        ]
      }
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
        <InstallPrompt />

        {children}

        <footer>
          <p>PokéValeur est un service indépendant de suivi de collection. Non affilié à The Pokémon Company, Nintendo, Creatures ou GAME FREAK.</p>
        </footer>
      </body>
    </html>
  )
}
