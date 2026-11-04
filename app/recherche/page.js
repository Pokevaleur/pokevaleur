import SearchResults from './results'

export const metadata = {
  title: 'Recherche cartes et produits scellés | PokéValeur',
  description: 'Recherche une carte Pokémon ou un produit scellé dans le catalogue PokéValeur.'
}

export default function SearchPage({ searchParams = {} }) {
  const requested = Array.isArray(searchParams.search) ? searchParams.search[0] : searchParams.search
  return <SearchResults initialQuery={requested || ''} />
}
