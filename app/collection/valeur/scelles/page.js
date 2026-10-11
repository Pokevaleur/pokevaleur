'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { fetchAllRows } from '../../../../lib/supabase-pagination'
import { getSealedItemValue, loadActiveCollectionProfile } from '../../../../lib/collection-value-data'
import styles from '../value.module.css'

function euro(value) {
  if (value == null) return 'Prix indisponible'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

export default function SealedValuesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState({ loading: true, error: '', profileName: 'Ma collection', rows: [], total: null, priced: 0, unpriced: 0 })
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const active = await loadActiveCollectionProfile(supabase)
        if (!active) {
          window.location.replace('/login?next=%2Fcollection%2Fvaleur%2Fscelles')
          return
        }
        const { profile } = active
        const [itemsResult, productsResult] = await Promise.all([
          fetchAllRows(() => supabase.from('collection_items')
            .select('id,custom_name,quantity,product_id,current_value_override,sealed_condition')
            .eq('collection_profile_id', profile.id)
            .order('created_at', { ascending: true })),
          fetchAllRows(() => supabase.from('products')
            .select('id,name,series,category,product_type,current_value,zero_defect_value,image_url')
            .eq('is_public', true))
        ])
        if (itemsResult.error) throw itemsResult.error
        if (productsResult.error) throw productsResult.error
        const products = new Map((productsResult.data || []).map(product => [product.id, product]))
        const rows = (itemsResult.data || []).filter(item => (
          String(products.get(item.product_id)?.category || '').trim().toLocaleLowerCase('fr') === 'sealed'
        )).map(item => {
          const product = products.get(item.product_id) || null
          const unitValue = getSealedItemValue(item, product)
          const quantity = Number(item.quantity) || 1
          return { ...item, product, quantity, unitValue, totalValue: unitValue == null ? null : unitValue * quantity }
        })
        const priced = rows.filter(row => row.totalValue != null)
        if (cancelled) return
        setState({
          loading: false,
          error: '',
          profileName: profile.display_name || 'Ma collection',
          rows,
          total: priced.length ? priced.reduce((sum, row) => sum + row.totalValue, 0) : null,
          priced: priced.reduce((sum, row) => sum + row.quantity, 0),
          unpriced: rows.filter(row => row.totalValue == null).reduce((sum, row) => sum + row.quantity, 0)
        })
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: error.message || 'Impossible de charger les produits et leurs valeurs.' }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const filtered = state.rows.filter(row => `${row.custom_name} ${row.product?.name || ''} ${row.product?.series || ''}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d’Ariane"><a href="/collection/valeur">Valeur</a><span>›</span><span>Produits scellés</span></nav>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>MA COLLECTION · PRODUITS SCELLÉS</span>
        <h1>Valeur des produits scellés</h1>
        <p>Les prix de référence de tes produits possédés, avec tes valeurs personnelles si tu en as renseigné.</p>
      </header>
      {state.loading ? <p className={styles.status} role="status">Chargement des produits…</p> : state.error ? <section className={styles.error} role="alert"><strong>Valeurs indisponibles</strong><p>{state.error}</p></section> : <>
        <section className={styles.totalCard}>
          <span className={styles.eyebrow}>VALEUR ESTIMÉE · {state.profileName.toLocaleUpperCase('fr')}</span>
          <strong>{euro(state.total)}</strong>
          <small>{state.priced} prix disponibles · {state.unpriced} sans prix de référence</small>
        </section>
        <label className={styles.searchLabel}>Rechercher un produit
          <input className={styles.searchInput} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nom, série ou type de produit" />
        </label>
        {filtered.length ? <div className={styles.productList}>
          {filtered.map(row => <article className={styles.productRow} key={row.id}>
            {row.product?.image_url ? <img src={row.product.image_url} alt="" loading="lazy" /> : <div className={styles.productPlaceholder} aria-hidden="true">📦</div>}
            <div className={styles.productText}>
              <span className={styles.productSeries}>{row.product?.series || 'Produit scellé'}</span>
              <h2>{row.custom_name || row.product?.name || 'Produit sans nom'}</h2>
              <small>{row.product?.product_type || row.product?.category || 'Produit'} · {row.quantity} exemplaire{row.quantity > 1 ? 's' : ''}{row.sealed_condition === 'zero_defect' ? ' · zéro défaut' : ''}</small>
              {row.unitValue == null && <small className={styles.muted}>Prix indisponible</small>}
            </div>
            <strong className={styles.productPrice}>{euro(row.totalValue)}</strong>
          </article>)}
        </div> : <p className={styles.status}>{search ? 'Aucun produit ne correspond à ta recherche.' : 'Aucun produit scellé dans cette collection.'}</p>}
        <details className={styles.method}><summary>Sources et méthode d’estimation</summary><p>La valeur personnelle d’un produit est prioritaire. Sinon, la page utilise la cote actuelle du catalogue, adaptée à l’état « zéro défaut » lorsqu’elle est disponible. Le prix d’achat n’est pas utilisé comme estimation actuelle.</p></details>
      </>}
      <a className={styles.backButton} href="/collection/valeur">← Retour à la vue d’ensemble</a>
    </main>
  )
}
