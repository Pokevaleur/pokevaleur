export const metadata = {
  title: 'Catalogue des cartes Pokémon',
  description: 'Parcours le catalogue des cartes Pokémon par série et retrouve les cartes à ajouter à ta collection.',
  alternates: { canonical: '/catalogue/cartes' },
  robots: { index: true, follow: true }
}

export default function CardCatalogueLayout({ children }) {
  return children
}
