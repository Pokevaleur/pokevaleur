import { fetchAllRows } from '../lib/supabase-pagination'
import { createPublicServerClient } from '../lib/supabase-public-server'

export const dynamic = 'force-dynamic'

const siteUrl = 'https://www.pokevaleur.fr'
const staticPaths = ['/', '/catalogue', '/catalogue/cartes']

export default async function sitemap() {
  const supabase = createPublicServerClient()
  const { data: products, error } = await fetchAllRows(() => supabase
    .from('products')
    .select('id')
    .eq('is_public', true)
    .order('id'))

  const staticEntries = staticPaths.map(path => ({ url: new URL(path, siteUrl).toString() }))
  if (error) return staticEntries

  const productEntries = (products || [])
    .filter(product => product?.id)
    .map(product => ({
      url: new URL(`/catalogue/${encodeURIComponent(product.id)}`, siteUrl).toString()
    }))

  return [...staticEntries, ...productEntries]
}
