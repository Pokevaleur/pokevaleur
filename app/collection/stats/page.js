'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'

function buildBreakdown(holdings, groupFor, unlabelled = 'Autres') {
  const totals = new Map()
  for (const holding of holdings) {
    const label = groupFor(holding) || unlabelled
    totals.set(label, (totals.get(label) || 0) + holding.quantity)
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
  const [cardCopies, setCardCopies] = useState([])

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

        const { data: copies, error: copiesError } = await fetchAllRows(() => supabase
          .from('collection_cards')
          .select('id,card_print_variant_id,ownership_type,grade,grade_label')
          .eq('collection_profile_id', profile.id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }))
        if (copiesError) throw copiesError

        const variantIds = [...new Set((copies || []).map(copy => copy.card_print_variant_id).filter(Boolean))]
        const variants = []
        for (let offset = 0; offset < variantIds.length; offset += 100) {
          const { data, error } = await supabase.from('card_print_variants')
            .select('id,card_id,variant_key,variant_label')
            .in('id', variantIds.slice(offset, offset + 100))
          if (error) throw error
          variants.push(...(data || []))
        }

        const cardIds = [...new Set(variants.map(variant => variant.card_id).filter(Boolean))]
        const cards = []
        for (let offset = 0; offset < cardIds.length; offset += 100) {
          const { data, error } = await supabase.from('cards')
            .select('id,card_set_id,collector_number,card_name,card_type,guide_category_label')
            .in('id', cardIds.slice(offset, offset + 100))
          if (error) throw error
          cards.push(...(data || []))
        }

        const setIds = [...new Set(cards.map(card => card.card_set_id).filter(Boolean))]
        const sets = []
        for (let offset = 0; offset < setIds.length; offset += 100) {
          const { data, error } = await supabase.from('card_sets')
            .select('id,series_name,set_name')
            .in('id', setIds.slice(offset, offset + 100))
          if (error) throw error
          sets.push(...(data || []))
        }

        const variantById = new Map(variants.map(variant => [variant.id, variant]))
        const cardById = new Map(cards.map(card => [card.id, card]))
        const setById = new Map(sets.map(set => [set.id, set]))
        const inventoryCards = (copies || []).map(copy => {
          const variant = variantById.get(copy.card_print_variant_id)
          const card = cardById.get(variant?.card_id)
          return { ...copy, variant, card, set: setById.get(card?.card_set_id) }
        })

        if (!active) return
        setProfileName(profile.display_name || 'Ma collection')
        setItems(rows || [])
        setProducts(catalog)
        setCardCopies(inventoryCards)
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
    const sealedCopies = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
    const cards = cardCopies.length
    const gradedCards = cardCopies.filter(copy => copy.ownership_type === 'graded').length
    const holdings = [
      ...items.map(item => ({
        kind: 'sealed',
        item,
        product: productById.get(item.product_id),
        quantity: Number(item.quantity) || 1
      })),
      ...cardCopies.map(record => ({ kind: 'card', record, quantity: 1 }))
    ]
    const copies = sealedCopies + cards
    const seriesFor = holding => holding.kind === 'card'
      ? holding.record.set?.set_name?.trim()
      : holding.product?.series?.trim()
    const typeFor = holding => holding.kind === 'card'
      ? holding.record.ownership_type === 'graded' ? 'Cartes gradées' : 'Cartes non gradées'
      : holding.product?.product_type?.trim() || holding.product?.category?.trim()

    const buildDetails = (groupFor, unlabelled) => {
      const groups = new Map()
      for (const holding of holdings) {
        const groupName = groupFor(holding) || unlabelled
        let detailKey
        let detail
        if (holding.kind === 'card') {
          const record = holding.record
          const cardName = [record.card?.collector_number, record.card?.card_name].filter(Boolean).join(' · ') || 'Carte sans nom'
          const variantLabel = record.variant?.variant_label
          const grade = record.grade_label || (record.grade ? `${record.grade}/10` : '')
          const stateLabel = record.ownership_type === 'graded' ? [`Gradée ${grade}`.trim(), record.card?.guide_category_label].filter(Boolean).join(' · ') : ['Non gradée', record.card?.guide_category_label, variantLabel].filter(Boolean).join(' · ')
          detailKey = `card:${record.card_print_variant_id}:${record.ownership_type}:${grade}`
          detail = { name: variantLabel ? `${cardName} — ${variantLabel}` : cardName, type: stateLabel, count: 1 }
        } else {
          const item = holding.item
          const product = holding.product
          const name = product?.name?.trim() || item.custom_name?.trim() || 'Objet sans nom'
          detailKey = item.product_id ? `product:${item.product_id}` : `custom:${name.toLocaleLowerCase('fr')}`
          detail = {
            name,
            type: product?.product_type?.trim() || product?.category?.trim() || '',
            count: holding.quantity
          }
        }
        if (!groups.has(groupName)) groups.set(groupName, new Map())
        const entries = groups.get(groupName)
        const existing = entries.get(detailKey)
        if (existing) existing.count += holding.quantity
        else entries.set(detailKey, detail)
      }
      return Object.fromEntries([...groups.entries()].map(([groupName, entries]) => [
        groupName,
        [...entries.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
      ]))
    }

    return {
      copies,
      sealedCopies,
      cards,
      gradedCards,
      seriesDetails: buildDetails(seriesFor, 'Série non renseignée'),
      typeDetails: buildDetails(typeFor, 'Autres'),
      bySeries: buildBreakdown(holdings, seriesFor, 'Série non renseignée'),
      byCategory: buildBreakdown(holdings, typeFor)
    }
  }, [items, products, cardCopies])

  if (loading) return <main className="collectionStatsPage"><section className="collectionStatsHero"><p role="status">Chargement de tes statistiques…</p></section></main>
  if (loadError) return <main className="collectionStatsPage"><section className="collectionStatsHero"><span className="collectionStatsEyebrow">En un coup d’œil</span><h1>Stats collection</h1><p role="alert">{loadError}</p><button type="button" className="btn" onClick={() => window.location.reload()}>Réessayer</button></section></main>

  const distribution = (entries, detailsByGroup = null, detailLabel = 'groupe') => entries.length
    ? <div className="collectionStatsBars">{entries.map(entry => {
      const share = stats.copies ? entry.count / stats.copies * 100 : 0
      const width = Math.max(1, Math.round(share * 10) / 10)
      const shareLabel = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(share)
      const heading = <><div className="collectionStatsBarLabel"><span>{entry.label}</span><strong>{entry.count} / {stats.copies} · {shareLabel} %</strong></div><div className="collectionStatsTrack"><i style={{ width: `${width}%` }} /></div></>
      if (!detailsByGroup) return <div className="collectionStatsBar" key={entry.label}>{heading}</div>

      const details = detailsByGroup[entry.label] || []
      const detailPrompt = detailLabel === 'série'
        ? 'Toucher pour voir les produits et cartes de cette série ▾'
        : 'Toucher pour voir les éléments de ce type ▾'
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
                  <strong style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{detail.count} / {entry.count} · {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(entry.count ? detail.count / entry.count * 100 : 0)} %</strong>
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
        <div><span>Éléments au total</span><strong>{stats.copies}</strong></div>
        <div><span>Produits scellés</span><strong>{stats.sealedCopies}</strong></div>
        <div><span>Cartes (gradées incluses)</span><strong>{stats.cards}</strong></div>
        <div><span>Cartes gradées</span><strong>{stats.gradedCards}</strong></div>
      </section>

      {items.length === 0 && cardCopies.length === 0 ? (
        <section className="panel collectionStatsEmpty"><h2>Ta collection commence ici</h2><p>Les statistiques apparaîtront au fur et à mesure que ta collection se remplit.</p></section>
      ) : (
        <div className="collectionStatsBreakdowns">
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par série</h2><p className="muted collectionStatsDescription">Appuie sur une série pour voir les produits et cartes associés. Part de tes {stats.copies} éléments au total.</p></div><span aria-hidden="true">✧</span></div>{distribution(stats.bySeries, stats.seriesDetails, 'série')}<p className="muted collectionStatsFootnote">Le pourcentage indique la part de tes exemplaires associés à cette série, pas ton taux de complétion de la série complète.</p></section>
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par type d’objet</h2><p className="muted collectionStatsDescription">Appuie sur un type d’objet pour voir les éléments associés et leur quantité. Part du total de ta collection.</p></div><span aria-hidden="true">◇</span></div>{distribution(stats.byCategory, stats.typeDetails, 'type d’objet')}</section>
        </div>
      )}
    </main>
  )
}
