import { createProductMatcher, normalizeSearch } from './product-search.mjs'

export function findWatchlistProducts(products, watchlist, query) {
  if (normalizeSearch(query).length < 2) return []
  const matches = createProductMatcher(query)
  const watched = new Set(watchlist.map(entry => entry.product_id))
  return products.filter(product => !watched.has(product.id) && matches(product)).slice(0, 8)
}
