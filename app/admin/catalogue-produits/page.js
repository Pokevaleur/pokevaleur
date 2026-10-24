'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './page.module.css'

const groups = [
  { title: 'Identification', fields: [
    ['name', 'Nom officiel', 'text'], ['category', 'Catégorie', 'select'], ['product_type', 'Type précis', 'select'],
    ['series', 'Série / extension', 'select'], ['language', 'Langue', 'text'], ['release_year', 'Année de sortie', 'number'],
    ['release_date', 'Date de sortie', 'date'], ['release_period', 'Période de sortie', 'text']
  ] },
  { title: 'Valeurs et sources', fields: [
    ['current_value', 'Cote PokéValeur (€)', 'number'], ['currency', 'Devise', 'text'], ['price_source', 'Source de la cote', 'text'],
    ['price_source_url', 'Lien de la source de la cote', 'url'], ['price_updated_at', 'Date de mise à jour de la cote', 'datetime-local'],
    ['zero_defect_value', 'Valeur neuf / zéro défaut (€)', 'number'], ['zero_defect_source', 'Source valeur neuf', 'text'], ['zero_defect_updated_at', 'Mise à jour valeur neuf', 'datetime-local']
  ] },
  { title: 'Références', fields: [['case_reference', 'Référence de la case', 'text'], ['official_source_url', 'Source officielle consultée', 'url']] },
  { title: 'Visuel', fields: [['image_url', 'URL du visuel', 'url'], ['image_source_url', 'Source du visuel', 'url'], ['image_credit', 'Crédit visuel', 'text'], ['image_usage_status', 'Statut d’utilisation du visuel', 'text']] },
  { title: 'Contenu de la Case', fields: [['case_unit_product_id', 'Produit contenu', 'product-select'], ['case_unit_count', 'Nombre d’unités contenues', 'number'], ['case_packaging_note', 'Précision sur le conditionnement', 'text']] },
  { title: 'Boosters', fields: [['booster_packaging', 'Conditionnement des boosters', 'text'], ['booster_artwork', 'Illustration des boosters', 'text']] }
]

const valueFields = new Set(['current_value', 'zero_defect_value', 'release_year', 'case_unit_count'])
const requiredFields = new Set(['name', 'category', 'currency', 'image_usage_status'])
const searchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
const upcSearchTerms = new Set(['upc', 'ultra premium collection', 'collection ultra premium'])
const isUpcProduct = product => {
  const searchable = searchText([product.name, product.product_type, product.category].filter(Boolean).join(' '))
  return /\\bupc\\b/.test(searchable) || searchable.includes('ultra premium collection') || searchable.includes('collection ultra premium')
}
const asInput = (key, value) => {
  if (value == null) return ''
  if (key.endsWith('_at') && value) return String(value).slice(0, 16)
  return String(value)
}

export default function AdminProductCatalogPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [products, setProducts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')
  const [visibleResultCount, setVisibleResultCount] = useState(30)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/login?next=%2Fadmin%2Fcatalogue-produits'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!active) return
      if (!profile?.is_admin) { setLoading(false); return }
      setIsAdmin(true)
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin/catalogue-produits', { headers: { Authorization: `Bearer ${session?.access_token || ''}` }, cache: 'no-store' })
      const result = await response.json()
      if (!active) return
      if (!response.ok) setError(result.error || 'Impossible de charger les fiches.')
      else setProducts(result.products || [])
      setLoading(false)
    })().catch(() => { if (active) { setError('Une erreur a empêché le chargement du catalogue.'); setLoading(false) } })
    return () => { active = false }
  }, [supabase])

  const selected = products.find(product => product.id === selectedId)
  const searchResults = useMemo(() => {
    const needle = searchText(query.trim())
    if (needle.length < 2) return []
    return products
      .filter(product => (upcSearchTerms.has(needle) && isUpcProduct(product)) || [product.name, product.series, product.product_type, product.category, product.case_reference, product.id].some(value => searchText(value).includes(needle)))
      .sort((a, b) => {
        const seriesOrder = String(a.series || '').localeCompare(String(b.series || ''), 'fr')
        if (seriesOrder) return seriesOrder
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr')
      })
  }, [products, query])
  const options = key => [...new Set(products.map(product => product[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'))

  function selectProduct(id) {
    if (selected && draft) {
      const hasUnsavedChanges = Object.keys(draft).some(key => {
        if (['id', 'created_at'].includes(key)) return false
        let value = draft[key]
        if (valueFields.has(key)) value = value === '' || value == null ? null : Number(value)
        else if (typeof value === 'string') value = value.trim() || null
        return value !== selected[key]
      })
      if (hasUnsavedChanges && !window.confirm('Cette fiche contient des modifications non enregistrées. Changer de fiche les abandonnera. Continuer ?')) return
    }
    setSelectedId(id)
    const product = products.find(item => item.id === id)
    setDraft(product ? { ...product } : null)
    setQuery('')
    setNotice('')
    setError('')
  }

  function change(key, value) { setDraft(current => ({ ...current, [key]: value })) }

  async function save(event) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true); setNotice(''); setError('')
    const changed = {}
    for (const key of Object.keys(draft)) {
      if (['id', 'created_at'].includes(key)) continue
      let value = draft[key]
      if (valueFields.has(key)) value = value === '' || value == null ? null : Number(value)
      else if (typeof value === 'string') value = value.trim() || null
      if (value !== selected[key]) changed[key] = value
    }
    if (!Object.keys(changed).length) { setNotice('Aucune modification à enregistrer.'); setSaving(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const response = await fetch('/api/admin/catalogue-produits', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ product_id: selected.id, fields: changed })
      })
      const result = await response.json()
      if (!response.ok) setError(result.error || 'La fiche n’a pas été enregistrée.')
      else {
        setProducts(current => current.map(item => item.id === selected.id ? result.product : item))
        setDraft({ ...result.product })
        setNotice('Fiche enregistrée. Les exemplaires de collection restent liés à cette fiche.')
      }
    } catch { setError('La fiche n’a pas été enregistrée. Vérifie ta connexion puis réessaie.') }
    setSaving(false)
  }

  if (loading) return <main className={styles.page}><p>Chargement…</p></main>
  if (!isAdmin) return <main className={styles.page}><section className={styles.panel}><h1>Accès réservé</h1><p>Cette page est réservée à l’administration.</p><a href="/admin">Retour à l’administration</a></section></main>

  function fieldControl(key, label, type) {
    const value = asInput(key, draft?.[key])
    if (type === 'select') {
      const values = options(key)
      return <select required={requiredFields.has(key)} value={value} onChange={event => change(key, event.target.value)}>
        <option value="">— Choisir —</option>{values.map(option => <option key={option} value={option}>{option}</option>)}
        {value && !values.includes(value) && <option value={value}>{value} (valeur actuelle)</option>}
      </select>
    }
    if (type === 'product-select') return <select value={value} onChange={event => change(key, event.target.value)}><option value="">Aucun produit associé</option>{products.filter(item => item.id !== selectedId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.product_type || item.category}</option>)}</select>
    return <input type={type} step={type === 'number' ? (key === 'release_year' || key === 'case_unit_count' ? '1' : '0.01') : undefined} required={requiredFields.has(key)} value={value} onChange={event => change(key, event.target.value)} />
  }

  return <main className={styles.page}>
    <div className={styles.breadcrumb}><a href="/admin">← Administration</a><span>Fiches du catalogue</span></div>
    <header className={styles.header}><p className={styles.kicker}>Admin · Catalogue de référence</p><h1>Modifier une fiche produit</h1><p>Les changements sont enregistrés sur la fiche sélectionnée. Les exemplaires de collection restent rattachés à son identifiant.</p></header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.panel}>
      <label className={styles.search}>Rechercher un produit<input type="search" value={query} onChange={event => { setQuery(event.target.value); setVisibleResultCount(30) }} placeholder="Nom, série, type ou référence…" autoComplete="off" enterKeyHint="search" /></label>
      {query.trim().length < 2 && <p className={styles.searchHelp}>Saisis au moins 2 lettres pour afficher les fiches correspondantes.</p>}
      {query.trim().length >= 2 && <div className={styles.searchResults} role="listbox" aria-label="Résultats de recherche">
        <p className={styles.resultCount}>{searchResults.length} fiche{searchResults.length > 1 ? 's' : ''} trouvée{searchResults.length > 1 ? 's' : ''}{searchResults.length > 0 ? ` · ${Math.min(visibleResultCount, searchResults.length)} affichée${Math.min(visibleResultCount, searchResults.length) > 1 ? 's' : ''} sur ${searchResults.length}` : ''}</p>
        {searchResults.length === 0 ? <p className={styles.noResults}>Aucune fiche trouvée. Essaie un autre nom ou une série.</p> : searchResults.slice(0, visibleResultCount).map(product => <button className={styles.result} type="button" role="option" aria-selected={product.id === selectedId} key={product.id} onClick={() => selectProduct(product.id)}>
          <span className={styles.resultName}>{product.name}</span>
          <span className={styles.resultMeta}>{[product.series, product.product_type || product.category].filter(Boolean).join(' · ')}</span>
        </button>)}
        {searchResults.length > visibleResultCount && <button className={styles.result} type="button" onClick={() => setVisibleResultCount(count => count + 30)}>Afficher les {Math.min(30, searchResults.length - visibleResultCount)} fiches suivantes</button>}
      </div>}
      {selected && <div className={styles.selectedProduct}><span>Fiche sélectionnée</span><strong>{selected.name}</strong><small>{[selected.series, selected.product_type || selected.category].filter(Boolean).join(' · ')}</small></div>}
    </section>
    {selected && draft && <form className={styles.form} onSubmit={save}>
      <section className={styles.panel}><h2>Identifiants protégés</h2><div className={styles.readonly}><span>ID catalogue</span><code>{selected.id}</code><span>Créée le</span><code>{selected.created_at ? new Date(selected.created_at).toLocaleString('fr-FR') : '—'}</code></div><p className={styles.help}>L’identifiant ne change pas : les collections qui utilisent cette fiche restent liées au produit.</p></section>
      {groups.map(group => <section className={styles.panel} key={group.title}><h2>{group.title}</h2>{group.title === 'Valeurs et sources' && <p className={styles.help}>La cote PokéValeur affichée au catalogue se règle ici. Saisis le prix retenu, puis précise sa source et sa date de mise à jour.</p>}<div className={styles.grid}>{group.fields.map(([key, label, type]) => <label className={key.endsWith('_url') || key === 'official_source_url' ? styles.wide : ''} key={key}>{label}{fieldControl(key, label, type)}</label>)}</div></section>)}
      <section className={styles.panel}><h2>Publication</h2><label className={styles.checkbox}><input type="checkbox" checked={Boolean(draft.is_public)} onChange={event => change('is_public', event.target.checked)} /> Visible dans le catalogue public et la recherche</label></section>
      <div className={styles.footer}><button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div>
    </form>}
  </main>
}
