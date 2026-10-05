'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'

function buildBreakdown(items, products, keyFor) {
  const byId = new Map(products.map(product => [product.id, product]))
  const totals = new Map()
  for (const item of items) {
    const product = byId.get(item.product_id)
    const label = keyFor(item, product) || 'Autres'
    totals.set(label, (totals.get(label) || 0) + (Number(item.quantity) || 1))
  }
  return [...totals.entries()].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
    .slice(0, 6)
}

export default function CollectionStatsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [profileName, setProfileName] = useState('Ma collection')
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          window.location.href = '/login?next=%2Fcollection%2Fstats'
          return
        }

        const { data: profileRows, error: profilesError } = await supabase
          .from('collection_profiles')
          .select('id,display_name,is_default')
          .order('created_at')
        if (profilesError) throw profilesError

        const savedProfileId = window.localStorage.getItem(`pokevaleur-collection:${user.id}`)
        const profile = (profileRows || []).find(row => row.id === savedProfileId)
          || (profileRows || []).find(row => row.is_default)
        if (!profile) throw new Error('Aucune collection disponible.')

        const { data: rows, error: itemsError } = await fetchAllRows(() => supabase
          .from('collection_items')
          .select('product_id,custom_name,quantity')
          .eq('collection_profile_id', profile.id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }))
        if (itemsError) throw itemsError

        const productIds = [...new Set((rows || []).map(item => item.product_id).filter(Boolean))]
        const catalog = []
        for (let offset = 0; offset < productIds.length; offset += 100) {
          const { data, error } = await supabase.from('products')
            .select('id,series,category,product_type')
            .eq('is_public', true)
            .in('id', productIds.slice(offset, offset + 100))
          if (error) throw error
          catalog.push(...(data || []))
        }

        if (!active) return
        setProfileName(profile.display_name || 'Ma collection')
        setItems(rows || [])
        setProducts(catalog)
      } catch {
        if (active) setLoadError('Impossible de charger les statistiques. Réessaie dans un instant.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [supabase])

  const stats = useMemo(() => {
    const productById = new Map(products.map(product => [product.id, product]))
    const copies = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
    const uniqueProducts = new Set(items.map(item => item.product_id
      ? `product:${item.product_id}`
      : `custom:${(item.custom_name || '').trim().toLocaleLowerCase('fr')}`).filter(key => !key.endsWith(':')))
    const series = new Set(items.map(item => productById.get(item.product_id)?.series?.trim()).filter(Boolean))

    return {
      copies,
      products: uniqueProducts.size,
      series: series.size,
      bySeries: buildBreakdown(items, products, (_item, product) => product?.series?.trim()),
      byCategory: buildBreakdown(items, products, (_item, product) => product?.category?.trim() || product?.product_type?.trim())
    }
  }, [items, products])

  if (loading) return <main className="collectionStatsPage"><section className="collectionStatsHero"><p role="status">Chargement de tes statistiques…</p></section></main>
  if (loadError) return <main className="collectionStatsPage"><section className="collectionStatsHero"><span className="collectionStatsEyebrow">En un coup d’œil</span><h1>Stats collection</h1><p role="alert">{loadError}</p><button type="button" className="btn" onClick={() => window.location.reload()}>Réessayer</button></section></main>

  const distribution = (entries) => entries.length
    ? <div className="collectionStatsBars">{entries.map(entry => {
      const width = Math.max(4, Math.round(entry.count / entries[0].count * 100))
      return <div className="collectionStatsBar" key={entry.label}><div className="collectionStatsBarLabel"><span>{entry.label}</span><strong>{entry.count}</strong></div><div className="collectionStatsTrack"><i style={{ width: `${width}%` }} /></div></div>
    })}</div>
    : <p className="muted">Les données ne sont pas encore suffisantes pour afficher cette répartition.</p>

  return (
    <main className="collectionStatsPage">
      <nav className="collectionTabs valuePageTabs" aria-label="Sections de la collection">
        <a href="/collection">Ma collection</a>
        <a className="active" href="/collection/stats" aria-current="page">Stats collection</a>
        <a href="/collection/statistiques" aria-label="Valeur en euros"><span className="collectionEuroIcon" aria-hidden="true">€</span> Valeur</a>
      </nav>

      <section className="collectionStatsHero">
        <span className="collectionStatsEyebrow">En un coup d’œil</span>
        <h1>Stats collection</h1>
        <p>Un aperçu simple de tout ce que tu as réuni dans {profileName}.</p>
      </section>

      <section className="stats collectionStatsKpis" aria-label="Chiffres clés">
        <div><span>Exemplaires</span><strong>{stats.copies}</strong></div>
        <div><span>Produits différents</span><strong>{stats.products}</strong></div>
        <div><span>Séries représentées</span><strong>{stats.series}</strong></div>
      </section>

      {items.length === 0 ? (
        <section className="panel collectionStatsEmpty"><h2>Ta collection commence ici</h2><p>Les statistiques apparaîtront au fur et à mesure que ta collection se remplit.</p></section>
      ) : (
        <div className="collectionStatsBreakdowns">
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par série</h2></div><span aria-hidden="true">✧</span></div>{distribution(stats.bySeries)}</section>
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par catégorie</h2></div><span aria-hidden="true">◇</span></div>{distribution(stats.byCategory)}</section>
        </div>
      )}
    </main>
  )
}
