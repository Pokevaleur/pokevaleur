'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function CataloguePage() {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('id,name,series,category,current_value')
      .eq('is_public', true)
      .order('name')

    setProducts(data || [])
  }

  const filtered = products.filter(product => {
    const haystack = [product.name, product.series, product.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <main>
      <section className="catalogHero">
        <span className="eyebrow dark">Catalogue PokéValeur</span>
        <h1>Retrouve rapidement un produit</h1>
        <p className="muted">
          Le catalogue va servir de base commune pour éviter de ressaisir les mêmes produits
          et, plus tard, pour suivre automatiquement leur valeur.
        </p>
        <input
          className="catalogSearch"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un produit ou une série..."
        />
      </section>

      <section className="catalogGrid">
        {filtered.map(product => (
          <article className="catalogCard" key={product.id}>
            <span className="catalogBadge">{product.category === 'sealed' ? 'Scellé' : product.category}</span>
            <h2>{product.name}</h2>
            <p>{product.series || 'Série non renseignée'}</p>
            <div className="catalogValue">
              <span>Valeur de référence</span>
              <strong>
                {product.current_value !== null && product.current_value !== undefined
                  ? Number(product.current_value).toFixed(2) + ' €'
                  : 'À renseigner'}
              </strong>
            </div>
          </article>
        ))}
      </section>

      {filtered.length === 0 && (
        <section className="panel narrow">
          <p>Aucun produit trouvé pour cette recherche.</p>
        </section>
      )}
    </main>
  )
}
