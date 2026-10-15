import HomeClient from './home-client'

export const metadata = {
  title: 'Collection Pokémon : cartes, scellés et master sets',
  description: 'Organise ta collection Pokémon : cartes, produits scellés et master sets. Suis les quantités et estime la valeur de tes articles.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'PokéValeur – organise ta collection Pokémon',
    description: 'Cartes, produits scellés et master sets : organise et estime ta collection Pokémon.',
    url: 'https://pokevaleur.fr'
  }
}

export default function HomePage() {
  return <HomeClient />
}
