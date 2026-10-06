'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import { collectionItemKind } from '../../../lib/collection-statistics.mjs'
import { buildCardRarityBreakdown } from '../../../lib/card-rarity-statistics.mjs'

function displayRarityLabel(label) {
  const labels = {
    Common: 'Commune',
    Uncommon: 'Peu commune',
    Rare: 'Rare',
    'Double rare': 'Double rare',
    'Ultra Rare': 'Ultra rare',
    'Illustration rare': 'Illustration rare',
    'Special illustration rare': 'Illustration spéciale rare',
    'Hyper rare': 'Hyper rare'
  }
  return labels[label] || label
}

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
  const [cardSetVariantTotals, setCardSetVariantTotals] = useState({})
  const [cardSetRarityBreakdowns, setCardSetRarityBreakdowns] = useState({})
  const [category, setCategory] = useState('all')
  const [selectedSetId, setSelectedSetId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('category')
    if (['sealed', 'other', 'cards', 'graded'].includes(requested)) setCategory(requested)
    if (requested === 'cards' && params.get('set')) setSelectedSetId(params.get('set'))
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)
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
            .select('id,card_id,variant_key,variant_label,is_master_set_target')
            .in('id', variantIds.slice(offset, offset + 100))
          if (error) throw error
          variants.push(...(data || []))
        }

        const cardIds = [...new Set(variants.map(variant => variant.card_id).filter(Boolean))]
        const cards = []
        for (let offset = 0; offset < cardIds.length; offset += 100) {
          const { data, error } = await supabase.from('cards')
            .select('id,card_set_id,collector_number,card_name,card_type,guide_category_label,rarity_label')
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

        const cardSetCards = []
        for (let offset = 0; offset < setIds.length; offset += 100) {
          const { data, error } = await fetchAllRows(() => supabase.from('cards')
            .select('id,card_set_id,collector_number,card_name,rarity_label')
            .in('card_set_id', setIds.slice(offset, offset + 100)))
          if (error) throw error
          cardSetCards.push(...(data || []))
        }

        const cardSetCardIds = [...new Set(cardSetCards.map(card => card.id))]
        const catalogVariants = []
        for (let offset = 0; offset < cardSetCardIds.length; offset += 100) {
          const { data, error } = await fetchAllRows(() => supabase.from('card_print_variants')
            .select('id,card_id,is_master_set_target')
            .in('card_id', cardSetCardIds.slice(offset, offset + 100)))
          if (error) throw error
          catalogVariants.push(...(data || []))
        }
        const cardSetByCardId = new Map(cardSetCards.map(card => [card.id, card.card_set_id]))
        const variantTotals = {}
        for (const variant of catalogVariants) {
          if (!variant.is_master_set_target) continue
          const setId = cardSetByCardId.get(variant.card_id)
          if (setId) variantTotals[setId] = (variantTotals[setId] || 0) + 1
        }

        const ownedVariantIds = new Set((copies || []).map(copy => copy.card_print_variant_id))
        const variantsBySet = new Map()
        for (const variant of catalogVariants) {
          const setId = cardSetByCardId.get(variant.card_id)
          if (!setId) continue
          if (!variantsBySet.has(setId)) variantsBySet.set(setId, [])
          variantsBySet.get(setId).push(variant)
        }
        const cardsBySet = new Map()
        for (const card of cardSetCards) {
          if (!cardsBySet.has(card.card_set_id)) cardsBySet.set(card.card_set_id, [])
          cardsBySet.get(card.card_set_id).push(card)
        }
        const rarityBreakdowns = Object.fromEntries(setIds.map(setId => [
          setId,
          buildCardRarityBreakdown(cardsBySet.get(setId) || [], variantsBySet.get(setId) || [], ownedVariantIds)
        ]))

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
        setCardSetVariantTotals(variantTotals)
        setCardSetRarityBreakdowns(rarityBreakdowns)
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
    const allHoldings = [
      ...items.map(item => {
        const product = productById.get(item.product_id)
        return {
          kind: collectionItemKind(item, productById),
          item,
          product,
          quantity: Number(item.quantity) || 1
        }
      }),
      ...cardCopies.map(record => ({ kind: 'card', record, quantity: 1 }))
    ]
    const holdings = allHoldings.filter(holding => category === 'all'
      || (category === 'sealed' && holding.kind === 'sealed')
      || (category === 'other' && holding.kind === 'other')
      || (category === 'cards' && holding.kind === 'card')
      || (category === 'graded' && holding.kind === 'card' && holding.record.ownership_type === 'graded'))
      .filter(holding => !selectedSetId || (holding.kind === 'card' && holding.record.set?.id === selectedSetId))
    const sealedCopies = holdings.filter(holding => holding.kind === 'sealed').reduce((sum, holding) => sum + holding.quantity, 0)
    const otherCopies = holdings.filter(holding => holding.kind === 'other').reduce((sum, holding) => sum + holding.quantity, 0)
    const cards = holdings.filter(holding => holding.kind === 'card').length
    const gradedCards = holdings.filter(holding => holding.kind === 'card' && holding.record.ownership_type === 'graded').length
    const copies = holdings.reduce((sum, holding) => sum + holding.quantity, 0)
    const seriesFor = holding => holding.kind === 'card'
      ? holding.record.set?.set_name?.trim()
      : holding.product?.series?.trim()
    const typeFor = holding => holding.kind === 'card'
      ? holding.record.ownership_type === 'graded' ? 'Cartes gradées' : 'Cartes non gradées'
      : holding.kind === 'other'
        ? holding.product?.product_type?.trim() || holding.product?.category?.trim() || 'Autres à classer'
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
      otherCopies,
      cards,
      gradedCards,
      seriesDetails: buildDetails(seriesFor, 'Série non renseignée'),
      typeDetails: buildDetails(typeFor, 'Autres'),
      byRarity: selectedSetId ? (cardSetRarityBreakdowns[selectedSetId] || []) : [],
      bySeries: category === 'cards' || category === 'graded'
        ? (() => {
            const variantsBySet = new Map()
            for (const holding of holdings) {
              if (holding.kind !== 'card' || !holding.record.variant?.is_master_set_target || !holding.record.set?.id) continue
              const set = holding.record.set
              if (!variantsBySet.has(set.id)) variantsBySet.set(set.id, {
                setId: set.id,
                label: set.set_name || 'Série sans nom',
                owned: new Set(),
                total: Number(cardSetVariantTotals[set.id]) || 0
              })
              variantsBySet.get(set.id).owned.add(holding.record.variant.id)
            }
            return [...variantsBySet.values()].map(entry => ({
              setId: entry.setId,
              label: entry.label,
              count: entry.owned.size,
              total: entry.total || null
            })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
          })()
        : buildBreakdown(holdings, seriesFor, 'Série non renseignée'),
      byCategory: buildBreakdown(holdings, typeFor)
    }
  }, [items, products, cardCopies, cardSetVariantTotals, cardSetRarityBreakdowns, category, selectedSetId])

  const selectedSetName = selectedSetId ? cardCopies.find(record => record.set?.id === selectedSetId)?.set?.set_name : ''
  const categoryLabel = selectedSetName || (category === 'sealed' ? 'Produits scellés' : category === 'other' ? 'Autres / à classer' : category === 'cards' ? 'Cartes' : category === 'graded' ? 'Cartes gradées' : '')
  const kpis = selectedSetId
    ? [['Variantes possédées dans la série', stats.byRarity.reduce((sum, entry) => sum + entry.count, 0)], ['Variantes répertoriées dans la série', stats.byRarity.reduce((sum, entry) => sum + entry.total, 0)], ['Raretés', stats.byRarity.length]]
    : category === 'all'
      ? [['Éléments au total', stats.copies], ['Produits scellés', stats.sealedCopies], ['Autres / à classer', stats.otherCopies], ['Cartes (gradées incluses)', stats.cards], ['Cartes gradées', stats.gradedCards]]
    : category === 'sealed'
      ? [['Produits scellés', stats.sealedCopies], ['Types de produits', stats.byCategory.length], ['Séries concernées', stats.bySeries.length]]
      : category === 'other'
        ? [['Autres / à classer', stats.otherCopies], ['Types d’objets', stats.byCategory.length], ['Séries concernées', stats.bySeries.length]]
      : category === 'cards'
        ? [['Cartes', stats.cards], ['Cartes non gradées', stats.cards - stats.gradedCards], ['Cartes gradées', stats.gradedCards], ['Séries concernées', stats.bySeries.length]]
        : [['Cartes gradées', stats.gradedCards], ['Séries concernées', stats.bySeries.length]]

  if (loading) return <main className="collectionStatsPage"><section className="collectionStatsHero"><p role="status">Chargement de tes statistiques…</p></section></main>
  if (loadError) return <main className="collectionStatsPage"><section className="collectionStatsHero"><span className="collectionStatsEyebrow">En un coup d’œil</span><h1>Stats collection</h1><p role="alert">{loadError}</p><button type="button" className="btn" onClick={() => window.location.reload()}>Réessayer</button></section></main>

  const distribution = (entries, detailsByGroup = null, detailLabel = 'groupe', linkForEntry = null) => entries.length
    ? <div className="collectionStatsBars">{entries.map(entry => {
      const hasDenominator = entry.total === undefined || entry.total !== null
      const denominator = hasDenominator ? entry.total ?? stats.copies : 0
      const share = denominator ? entry.count / denominator * 100 : 0
      const width = denominator ? Math.max(1, Math.round(share * 10) / 10) : 1
      const shareLabel = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(share)
      const ratioLabel = denominator
        ? `${entry.count} / ${denominator} · ${shareLabel} %`
        : `${entry.count} variantes · total du checklist indisponible`
      const entryHref = linkForEntry?.(entry)
      const ratio = entryHref
        ? <a href={entryHref} aria-label={`Afficher ${entry.count} variantes ${entry.label} possédées`} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>{ratioLabel}</a>
        : ratioLabel
      const displayLabel = selectedSetId ? displayRarityLabel(entry.label) : entry.label
      const heading = <><div className="collectionStatsBarLabel"><span>{displayLabel}</span><strong>{ratio}</strong></div><div className="collectionStatsTrack"><i style={{ width: `${width}%` }} /></div></>
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
        <span className="collectionStatsEyebrow">{category === 'all' ? 'En un coup d’œil' : 'Statistiques ciblées'}</span>
        <h1>{category === 'all' ? 'Stats collection' : categoryLabel}</h1>
        <p>{selectedSetId
          ? <>Cartes possédées par rareté dans {selectedSetName || 'cette série'}.</>
          : category === 'all'
            ? <>Un aperçu simple de tout ce que tu as réuni dans {profileName}.</>
            : <>Répartition de tes {categoryLabel.toLocaleLowerCase('fr')} dans {profileName}.</>}</p>
        {selectedSetId
          ? <a className="collectionStatsScopeReset" href="/collection/stats?category=cards">← Toutes les séries de cartes</a>
          : category !== 'all' && <a className="collectionStatsScopeReset" href="/collection/stats">Toutes les statistiques</a>}
      </section>

      <section className="stats collectionStatsKpis" aria-label="Chiffres clés">
        {kpis.map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}
      </section>

      {stats.copies === 0 ? (
        <section className="panel collectionStatsEmpty"><h2>{category === 'all' ? 'Ta collection commence ici' : 'Aucun élément dans cette rubrique'}</h2><p>{category === 'all' ? 'Les statistiques apparaîtront au fur et à mesure que ta collection se remplit.' : <>Cette rubrique est vide dans {profileName}. <a href="/collection/stats">Voir toutes les statistiques</a></>}</p></section>
      ) : (
        <div className={category === 'graded' ? 'collectionStatsBreakdowns collectionStatsBreakdownsSingle' : 'collectionStatsBreakdowns'}>
          {selectedSetId ? (
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par rareté</h2><p className="muted collectionStatsDescription">Les totaux comptent les variantes du checklist, pas les cartes distinctes : une même carte peut apparaître en version Normale et Reverse. Appuie sur un nombre pour ouvrir les cartes, puis utilise les filtres visuels pour compter séparément les cartes standard.</p></div><span aria-hidden="true">✧</span></div>{distribution(stats.byRarity, null, 'rareté', entry => `/collection/cartes?set=${encodeURIComponent(selectedSetId)}&rarity=${encodeURIComponent(entry.label)}&owned=1&checklist=all`)}<p className="muted collectionStatsFootnote">Une variante du checklist compte une seule fois, même si tu en possèdes plusieurs exemplaires.</p></section>
          ) : (
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par série</h2><p className="muted collectionStatsDescription">Appuie sur une série pour voir les produits et cartes associés. {category === 'cards' || category === 'graded' ? 'Progression parmi les variantes du checklist répertoriées pour la série.' : `Part de tes ${stats.copies} éléments au total.`}</p></div><span aria-hidden="true">✧</span></div>{distribution(stats.bySeries, stats.seriesDetails, 'série', entry => category === 'cards' && entry.setId ? `/collection/stats?category=cards&set=${encodeURIComponent(entry.setId)}` : null)}<p className="muted collectionStatsFootnote">{category === 'cards' || category === 'graded' ? 'Les cartes sont comptées une seule fois par variante possédée.' : 'Le pourcentage indique la part de tes exemplaires associés à cette série, pas ton taux de complétion de la série complète.'}</p></section>
          )}
          {category !== 'graded' && !selectedSetId && (
          <section className="panel collectionStatsBreakdown"><div className="collectionStatsPanelTitle"><div><span className="collectionStatsEyebrow">Répartition</span><h2>Par type d’objet</h2><p className="muted collectionStatsDescription">Appuie sur un type d’objet pour voir les éléments associés et leur quantité. Part du total de ta collection.</p></div><span aria-hidden="true">◇</span></div>{distribution(stats.byCategory, stats.typeDetails, 'type d’objet')}</section>
          )}
        </div>
      )}
    </main>
  )
}
