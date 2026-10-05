'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import { calculateCollectionStatistics, hasPurchasePrice } from '../../../lib/collection-statistics.mjs'

function euro(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function percent(value) {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(1)} %`
}

export default function CollectionStatisticsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [historyWarning, setHistoryWarning] = useState('')
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [profileName, setProfileName] = useState('Ma collection')
  const [hasProfileHistory, setHasProfileHistory] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setLoadError('')
    setHistoryWarning('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) {
        window.location.href = '/login?next=%2Fcollection%2Fstatistiques'
        return
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from('collection_profiles')
        .select('id,display_name,is_default')
        .order('created_at')
      if (profilesError) throw profilesError
      const savedProfileId = window.localStorage.getItem(`pokevaleur-collection:${user.id}`)
      const selectedProfile = (profileRows || []).find(profile => profile.id === savedProfileId)
        || (profileRows || []).find(profile => profile.is_default)
      if (!selectedProfile) throw new Error('Aucune collection disponible.')
      setProfileName(selectedProfile.display_name)
      setHasProfileHistory(selectedProfile.is_default)

      const snapshotsRequest = selectedProfile.is_default
        ? fetchAllRows(() => supabase.from('collection_value_snapshots').select('*').eq('user_id', user.id).order('snapshot_date', { ascending: true }))
        : Promise.resolve({ data: [] })
      const [itemResult, productResult, snapshotResult] = await Promise.all([
        fetchAllRows(() => supabase.from('collection_items').select('*')
          .eq('collection_profile_id', selectedProfile.id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })),
        fetchAllRows(() => supabase.from('products').select('id,name,series,category,product_type,release_year,current_value,zero_defect_value').eq('is_public', true).order('id')),
        snapshotsRequest
      ])

      if ([itemResult, productResult, snapshotResult].some(result => result.error)) throw new Error('Chargement incomplet.')
      const itemData = itemResult.data, productData = productResult.data, snapshotData = snapshotResult.data

      const rows = itemData || []
      const catalog = productData || []
      const byId = Object.fromEntries(catalog.map(p => [p.id, p]))

      const getValue = item => {
        if (item.current_value_override != null) return Number(item.current_value_override)
        const product = byId[item.product_id]
        if (!product) return Number(item.purchase_price) || 0
        if (item.sealed_condition === 'zero_defect' && product.zero_defect_value != null) return Number(product.zero_defect_value)
        if (product.current_value != null) return Number(product.current_value)
        return Number(item.purchase_price) || 0
      }

      const invested = rows.reduce((sum, item) => sum + (Number(item.purchase_price) || 0) * (item.quantity || 1), 0)
      const currentValue = rows.reduce((sum, item) => sum + getValue(item) * (item.quantity || 1), 0)
      const itemCount = rows.reduce((sum, item) => sum + (item.quantity || 1), 0)

      let refreshedSnapshots = snapshotData || []
      if (selectedProfile.is_default) {
        const { error: saveError } = await supabase.from('collection_value_snapshots').upsert({
          user_id: user.id,
          snapshot_date: new Date().toISOString().slice(0,10),
          invested,
          current_value: currentValue,
          item_count: itemCount
        }, { onConflict: 'user_id,snapshot_date' })

        if (saveError) {
          setHistoryWarning('Les statistiques sont disponibles, mais le point du jour n’a pas pu être enregistré dans l’historique.')
        } else {
          const { data, error: historyError } = await fetchAllRows(() => supabase.from('collection_value_snapshots')
            .select('*').eq('user_id', user.id).order('snapshot_date', { ascending: true }))
          if (historyError) setHistoryWarning('Le point du jour est enregistré, mais l’historique n’a pas pu être actualisé.')
          else refreshedSnapshots = data || []
        }
      }

      setItems(rows)
      setProducts(catalog)
      setSnapshots(refreshedSnapshots)
    } catch {
      setLoadError('Impossible de charger les statistiques. Vérifie ta connexion puis réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const byId = Object.fromEntries(products.map(p => [p.id, p]))

  function itemValue(item) {
    if (item.current_value_override != null) return Number(item.current_value_override)
    const product = byId[item.product_id]
    if (!product) return Number(item.purchase_price) || 0
    if (item.sealed_condition === 'zero_defect' && product.zero_defect_value != null) return Number(product.zero_defect_value)
    if (product.current_value != null) return Number(product.current_value)
    return Number(item.purchase_price) || 0
  }

  const { invested, current, difference, evolution, itemCount, missingPurchaseCount } = calculateCollectionStatistics(items, itemValue)
  const zeroDefectCount = items.reduce((sum, item) => sum + (item.sealed_condition === 'zero_defect' ? (item.quantity || 1) : 0), 0)

  const enriched = items.map(item => {
    const quantity = item.quantity || 1
    const buyUnit = Number(item.purchase_price) || 0
    const valueUnit = itemValue(item)
    const buy = buyUnit * quantity
    const value = valueUnit * quantity
    const gain = value - buy
    const gainPct = buy > 0 ? gain / buy * 100 : null
    const product = byId[item.product_id] || {}
    return { ...item, product, buy, value, gain, gainPct }
  })

  const topGains = enriched.filter(hasPurchasePrice).sort((a,b) => b.gain - a.gain).slice(0,5)
  const topValues = [...enriched].sort((a,b) => b.value - a.value).slice(0,5)

  function aggregate(keyFn, limit = 8) {
    const map = {}
    enriched.forEach(row => {
      const key = keyFn(row) || 'Non renseigné'
      if (!map[key]) map[key] = { value: 0, count: 0 }
      map[key].value += row.value
      map[key].count += Number(row.quantity) || 1
    })
    return Object.entries(map).map(([label, totals]) => [label, totals.value, totals.count])
      .sort((a,b) => b[1]-a[1]).slice(0,limit)
  }

  const seriesRows = aggregate(row => row.product.series)
  const typeRows = aggregate(row => row.product.product_type || row.product.category, Infinity)
  const yearRows = aggregate(row => row.product.release_year ? String(row.product.release_year) : 'Année inconnue')
  const maxSeries = Math.max(1, ...seriesRows.map(([,v]) => v))
  const maxType = Math.max(1, ...typeRows.map(([,v]) => v))
  const maxYear = Math.max(1, ...yearRows.map(([,v]) => v))

  function snapshotPoints() {
    if (snapshots.length < 2) return ''
    const vals = snapshots.map(x => Number(x.current_value))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = Math.max(1, max-min)
    return snapshots.map((s,i) => {
      const x = i/(snapshots.length-1)*100
      const y = 44 - ((Number(s.current_value)-min)/range)*36
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  if (loading) return <main><section className="panel"><p>Chargement des statistiques…</p></section></main>

  if (loadError) return <main><section className="panel">
    <h1>Statistiques indisponibles</h1><p role="alert">{loadError}</p>
    <button type="button" className="btn" onClick={load}>Réessayer</button>
    <a className="btn ghost" href="/collection">Retour à ma collection</a>
  </section></main>

  return (
    <main className="valueDashboard">
      <nav className="collectionTabs valuePageTabs" aria-label="Sections de la collection">
        <a href="/collection">Ma collection</a>
        <a href="/collection#collection-stats">Stats collection</a>
        <a className="active" href="/collection/statistiques" aria-current="page"><span className="collectionEuroIcon" aria-hidden="true">€</span> Valeur</a>
      </nav>

      <section className="catalogHero statsHero valueHero">
        <span className="eyebrow dark">Tableau de bord personnel</span>
        <h1>Valeur de {profileName}</h1>
        <p className="muted">Une vue claire de la valeur estimée, de ton évolution et de la composition de ta collection.</p>
      </section>

      <section className="stats collectionStatsCards valueKpiGrid">
        <div><span>Investi</span><strong>{euro(invested)}</strong></div>
        <div><span>Valeur actuelle</span><strong>{euro(current)}</strong></div>
        <div><span>Plus-value</span><strong className={difference >= 0 ? 'gain' : 'loss'}>{difference != null && difference >= 0 ? '+' : ''}{euro(difference)}<small> {percent(evolution)}</small></strong></div>
        <div><span>Items</span><strong>{itemCount}</strong></div>
      </section>

      {missingPurchaseCount > 0 && <p className="message" role="status">Prix d’achat non renseigné pour {missingPurchaseCount} exemplaire{missingPurchaseCount > 1 ? 's' : ''}. La plus-value et son classement concernent uniquement les achats renseignés.</p>}
      {historyWarning && <p className="message" role="status">{historyWarning}</p>}
      <section className="panel statsTrendPanel">
        <div className="statsSectionHead">
          <div><h2>Évolution de la valeur totale</h2><p className="muted">{hasProfileHistory ? 'Un point est mémorisé chaque jour où tu consultes cette page.' : 'L’historique propre à cette collection sera disponible plus tard.'}</p></div>
          <strong>{euro(current)}</strong>
        </div>
        {snapshots.length >= 2 ? (
          <>
            <div className="collectionTrendChart">
              <svg viewBox="0 0 100 50" preserveAspectRatio="none">
                <polyline points={snapshotPoints()} fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="trendDates">
              <span>{new Date(snapshots[0].snapshot_date+'T00:00:00').toLocaleDateString('fr-FR')}</span>
              <span>{snapshots.length} relevés</span>
              <span>{new Date(snapshots[snapshots.length-1].snapshot_date+'T00:00:00').toLocaleDateString('fr-FR')}</span>
            </div>
          </>
        ) : (
          <div className="emptyPriceChart">
            <strong>{hasProfileHistory ? 'Historique en construction' : 'Pas encore d’historique pour cette collection'}</strong>
            <span>{hasProfileHistory ? 'Le graphique se construira automatiquement au fil des prochains relevés.' : `Les totaux affichés concernent uniquement « ${profileName} »; ils ne modifient pas l’historique personnel du compte.`}</span>
          </div>
        )}
      </section>

      <section className="statsDashboardGrid">
        <div className="panel">
          <h2>Répartition par série</h2>
          <div className="statsBars">
            {seriesRows.map(([label,value]) => (
              <div className="statsBarRow" key={label}>
                <div><span>{label}</span><strong>{euro(value)}</strong></div>
                <i><b style={{width:`${value/maxSeries*100}%`}} /></i>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Répartition par type</h2>
          <div className="statsBars">
            {typeRows.map(([label,value,count]) => (
              <div className="statsBarRow" key={label}>
                <div><span>{label}</span><strong>{euro(value)}</strong></div>
                <small>{count} exemplaire{count > 1 ? 's' : ''}</small>
                <i><b style={{width:`${value/maxType*100}%`}} /></i>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="statsDashboardGrid">
        <div className="panel">
          <h2>Mes plus fortes plus-values</h2>
          <div className="statsRanking">
            {topGains.length === 0 && <p>Renseigne un prix d’achat pour calculer une plus-value.</p>}
            {topGains.map((row,index) => (
              <a href={`/collection/${row.id}`} key={row.id}>
                <span><b>{index+1}</b>{row.custom_name}</span>
                <strong className={row.gain >= 0 ? 'gain' : 'loss'}>{row.gain >= 0 ? '+' : ''}{euro(row.gain)} <small>{percent(row.gainPct)}</small></strong>
              </a>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Mes items les plus valorisés</h2>
          <div className="statsRanking">
            {topValues.map((row,index) => (
              <a href={`/collection/${row.id}`} key={row.id}>
                <span><b>{index+1}</b>{row.custom_name}</span>
                <strong>{euro(row.value)}</strong>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="statsDashboardGrid">
        <div className="panel">
          <h2>Répartition par année de sortie</h2>
          <div className="statsBars">
            {yearRows.map(([label,value]) => (
              <div className="statsBarRow" key={label}>
                <div><span>{label}</span><strong>{euro(value)}</strong></div>
                <i><b style={{width:`${value/maxYear*100}%`}} /></i>
              </div>
            ))}
          </div>
        </div>

        <div className="panel statsQualityPanel">
          <h2>Qualité de la collection</h2>
          <div className="qualityBig"><strong>{zeroDefectCount}</strong><span>item{zeroDefectCount>1?'s':''} zéro défaut</span></div>
          <p className="muted">{itemCount ? (zeroDefectCount/itemCount*100).toFixed(1) : 0} % de ta collection est actuellement classée « zéro défaut ».</p>
          <div className="qualityGauge"><i style={{width:`${itemCount ? zeroDefectCount/itemCount*100 : 0}%`}} /></div>
        </div>
      </section>
    </main>
  )
}
