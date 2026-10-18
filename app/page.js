import HomeClient from './home-client'

export const metadata = {
  title: { absolute: 'PokéValeur – organiser et suivre sa collection Pokémon' },
  description: 'Sur PokéValeur, organise et suis ta collection Pokémon : cartes, classeurs, cartes gradées et produits scellés. Garde un œil sur tes quantités et estimations.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'PokéValeur – organise ta collection Pokémon',
    description: 'Cartes, classeurs, cartes gradées et produits scellés : organise et suis ta collection sur PokéValeur.',
    url: 'https://www.pokevaleur.fr'
  }
}

export default function HomePage() {
  return <HomeClient />
}
