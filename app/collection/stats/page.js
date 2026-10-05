'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'

function buildBreakdown(items, products, keyFor, unlabelled = 'Autres') {
  const byId = new Map(products.map(product => [product.id, product]))
  const totals = new Map()
  for (const item of items) {
    const product = byId.get(item.product_id)
    const label = keyFor(item, product) || unlabelled
    totals.set(label, (totals.get(label) || 0) + (Number(item.quantity) || 1))
  }
  return [...totals.entries()].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
    
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
            .select('id,name,series,category,product_type')
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
    const buildDetails = (groupFor, unlabelled) => {
      const groups = new Map()
      for (const item of items) {
        const product = productById.get(item.product_id)
        const groupName = groupFor(item, product) || unlabelled
        const name = product?.name?.trim() || item.custom_name?.trim() || 'Objet sans nom'
        const detailKey = item.product_id ? `product:${item.product_id}` : `custom:${name.toLocaleLowerCase('fr')}`
        if (!groups.has(groupName)) groups.set(groupName, new Map())
        const productsInGroup = groups.get(groupName)
        const detail = productsInGroup.get(detailKey)
        if (detail) detail.count += Number(item.quantity) || 1
        else productsInGroup.set(detailKey, {
          name,
          type: product?.product_type?.trim() || product?.category?.trim() || '',
          count: Number(item.quantity) || 1
        })
      }
      return Object.fromEntries([...groups.entries()].map(([groupName, productsInGroup]) => [
        groupName,
        [...productsInGroup.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
      ]))
    }
    const seriesDetails = buildDetails((_item, product) => product?.series?.trim(), 'Série non renseignée')
    const typeDetails = buildDetails((_item, product) => product?.product_type?.trim() || product?.category?.trim(), 'Autres')

    return {
      copies,
      products: uniqueProducts.size,
      series: series.size,
      seriesDetails,
      typeDetails,
      bySeries: buildBreakdown(items, products, (_item, product) => product?.series?.trim(), 'Série non renseignée'),
      byCategory: buildBreakdown(items, products, (_item, product) => product?.product_type?.trim() || product?.category?.trim())
    }
  }, [items, products])

  if (loading) return <main className="collectionStatsPage"><section className="collectionStatsHero"><p role="status">Chargement de tes statistiques…</p></section></main>
  if (loadError) return <main className="collectionStatsPage"><section className="collectionStatsHero"><span className="collectionStatsEyebrow">En un coup d’œil</span><h1>Stats collection</h1><p role="alert">{loadError}</p><button type="button" className="btn" onClick={() => window.location.reload()}>Réessayer</button></section></main>

  const distribution = (entries, detailsByGroup = null, detailLabel = 'groupe') => entries.length
    ? <div className="collectionStatsBars">{entries.map(entry => {
      const share = stats.copies ? entry.count / stats.copies * 100 : 0
      const width = Math.max(1, Math.round(share * 10) / 10)
      const shareLabel = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(share)
      const heading = <><div className="collectionStatsBarLabel"><span>{entry.label}</span><strong>{entry.count} · {shareLabel} %</strong></div><div className="collectionStatsTrack"><i style={{ width: `${width}%` }} /></div></>
      if (!detailsByGroup) return <div className="collectionStatsBar" key={entry.label}>{heading}</div>

      const details = detailsByGroup[entry.label] || []
      const detailPrompt = detailLabel === 'série'
        ? 'Toucher pour voir les produits de cette série ▾'
        : 'Toucher pour voir les produits de ce type d’objet ▾'
      return (
        <details className="collectionStatsBar" key={entry.label}>
          <summary style={{ cursor: 'pointer' }}>
            {heading}
            <span style={{ display: 'block', marginTop: 6, fontSize: '.82rem', color: '#65758b' }}>{detailPrompt}</span>
          </summary>
          {details.length ? (
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
              {details.map((detail, index) => (
                <li key={`${detail.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #e1e7ef' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {detail.name}
                    {detail.type && <small style={{ display: 'block', marginTop: 3, color: '#65758b' }}>{detail.type}</small>}
                  </span>
                  <strong style={{ flex: '0 0 auto' }}>× {detail.count}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Aucun produit détaillé dans ce regroupement.</p>}
        </details>
      )
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
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par série</h2><p className="muted collectionStatsDescription">Appuie sur une série pour voir les produits associés et leur quantité. Part du total de tes {stats.copies} exemplaires.</p></div><span aria-hidden="true">✧</span></div>{distribution(stats.bySeries, stats.seriesDetails, 'série')}<p className="muted collectionStatsFootnote">Le pourcentage indique la part de tes exemplaires associés à cette série, pas ton taux de complétion de la série complète.</p></section>
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par type d’objet</h2><p className="muted collectionStatsDescription">Appuie sur un type d’objet pour voir les produits associés et leur quantité. Part du total de ta collection.</p></div><span aria-hidden="true">◇</span></div>{distribution(stats.byCategory, stats.typeDetails, 'type d’objet')}</section>
        </div>
      )}
    </main>
  )
}
