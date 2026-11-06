'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { fetchAllRows } from '../../lib/supabase-pagination'
import { createProductMatcher, normalizeSearch } from '../../lib/product-search.mjs'
import { compareProductsByRelease, createSeriesReleaseDateMap } from '../../lib/catalogue-sort.mjs'
import { getProductThumbnailUrl } from '../../lib/optimized-image-url.js'
import styles from './page.module.css'
import VoiceSearchButton from '../voice-search-button'

const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,image_url,source_url,image_source_url,card_sets!cards_card_set_id_fkey(id,series_name,set_name,set_code,language,release_date,advertised_card_count),card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group)'
const GENERIC_ETB_CASE_IMAGE = 'https://www.pokevaleur.fr/etb-case-generic.jpg'

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function escapedPattern(value) {
  return '%' + String(value || '').replace(/[\\%_]/g, '\\$&') + '%'
}

function accentInsensitivePattern(value) {
  const normalized = normalizeText(value)
  if (!normalized || !/[aeiouy]/.test(normalized)) return null
  return '%' + [...normalized].map(character => /[aeiouy]/.test(character) ? '_' : character).join('') + '%'
}

function normalizeVoiceSearch(value) {
  return normalizeSearch(value)
    .replace(/\blove\s+disk\b/g, 'lovdisc')
    .replace(/\blove\s*disc\b/g, 'lovdisc')
    .replace(/\b(rivers?|revers(?:e|es)?|rever|riverse)\b/g, 'reverse')
}

function parseCollectorNumberQuery(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*(?:\/|sur)\s*(\d+)$/i)
  return match ? { number: String(Number(match[1])), total: Number(match[2]) } : null
}

function normalizeNumericCollectorNumber(value) {
  const match = String(value || '').trim().match(/^0*(\d+)(?:\s*\/\s*\d+)?$/)
  return match ? String(Number(match[1])) : ''
}

function collectorNumberTotal(value) {
  const match = String(value || '').trim().match(/^\d+\s*\/\s*(\d+)$/)
  return match ? Number(match[1]) : null
}

function languageLabel(value) {
  const language = String(value || '').toUpperCase()
  return ({ FR: 'Français', JP: 'Japonais', EN: 'Anglais', CN: 'Chinois', KR: 'Coréen' })[language] || language || 'Langue non précisée'
}

function formatPrice(value, currency = 'EUR') {
  const amount = Number(value)
  const code = /^[A-Z]{3}$/.test(String(currency || '').toUpperCase()) ? String(currency).toUpperCase() : 'EUR'
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount)
    : null
}

function productMatcher(query) {
  try { return createProductMatcher(query) }
  catch { return () => false }
}

function isEtbCase(product) {
  const name = normalizeText(product?.name).replace(/[’']/g, ' ')
  return /^case\s+de\s+\d+\s+(?:etb\b|coffret\s+dresseur\s+d\s+elite\b)/.test(name)
}

export default function SearchResults({ initialQuery }) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState(initialQuery)
  const [cards, setCards] = useState([])
  const [products, setProducts] = useState([])
  const [cardPrices, setCardPrices] = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [loading, setLoading] = useState(Boolean(initialQuery.trim()))
  const [error, setError] = useState('')
  const [collectionAccess, setCollectionAccess] = useState('loading')
  const [collectionProfile, setCollectionProfile] = useState(null)
  const [collectionOwnership, setCollectionOwnership] = useState({})
  const [collectionProductOwnership, setCollectionProductOwnership] = useState({})
  const [collectionCardId, setCollectionCardId] = useState('')
  const [collectionProductId, setCollectionProductId] = useState('')
  const [collectionBusyVariant, setCollectionBusyVariant] = useState('')
  const [collectionBusyProduct, setCollectionBusyProduct] = useState(false)
  const [collectionNotice, setCollectionNotice] = useState('')

  useEffect(() => {
    setQuery(initialQuery)
    const term = initialQuery.trim()
    if (term.length < 2) {
      setCards([])
      setProducts([])
      setCardPrices({})
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false
    async function searchCatalogues() {
      setLoading(true)
      setError('')
      setCards([])
      setProducts([])
      setCardPrices({})
      setPricesLoading(false)
      const [setsResult, productsResult] = await Promise.all([
        fetchAllRows(() => supabase.from('card_sets').select('id,series_name,set_name,set_code,language,release_date,advertised_card_count')
          .eq('is_public', true).order('release_date', { ascending: false })),
        fetchAllRows(() => supabase.from('products').select('id,name,series,category,product_type,image_url,release_date,release_year,release_period,case_reference,current_value,price_source')
          .eq('is_public', true).eq('category', 'sealed').order('name').order('id'))
      ])
      if (setsResult.error || productsResult.error) throw setsResult.error || productsResult.error

      const setRows = setsResult.data || []
      const setById = new Map(setRows.map(set => [set.id, set]))
      const tokens = normalizeVoiceSearch(term).split(/\s+/).filter(Boolean)
      const collectorNumberQuery = parseCollectorNumberQuery(term)
      const nameToken = tokens.find(token => !/^\d+$/.test(token)) || tokens[0] || term
      const numberToken = collectorNumberQuery?.number || tokens.find(token => /^\d+[a-z]*$/i.test(token)) || term
      const variantSearchTokens = tokens.filter(token => token === 'reverse')
      const nameSearchTokens = collectorNumberQuery
        ? [nameToken]
        : [...new Set(tokens.filter(token => !/^\d+$/.test(token) && !variantSearchTokens.includes(token)))].slice(0, 5)
      const escapedNumber = escapedPattern(numberToken)
      const matchingSets = collectorNumberQuery
        ? setRows.filter(set => Number(set.advertised_card_count) === collectorNumberQuery.total)
        : setRows.filter(set => {
          const searchable = normalizeText([set.series_name, set.set_name, set.set_code].join(' '))
          return tokens.every(token => searchable.includes(token))
        })
      const setIds = collectorNumberQuery ? matchingSets.map(set => set.id) : setRows.map(set => set.id)
      const searches = []
      if (setIds.length) {
        for (const token of nameSearchTokens) {
          const escapedToken = escapedPattern(token)
          const accentToken = accentInsensitivePattern(token)
          searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
            .ilike('card_name', escapedToken).order('card_name').order('collector_number').limit(80)))
          if (accentToken && accentToken !== escapedToken) {
            searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
              .ilike('card_name', accentToken).order('card_name').order('collector_number').limit(80)))
          }
        }
        searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
          .ilike('collector_number', escapedNumber).order('card_name').order('collector_number').limit(80)))
        if (matchingSets.length > 0 && matchingSets.length <= 5) {
          searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', matchingSets.map(set => set.id))
            .order('guide_order').order('collector_number').limit(80)))
        }
      }
      // A variant-only query such as “revers” has no card name to match.
      // Search variant labels in the newest public sets so the variant itself
      // can lead to its cards.
      if (!nameSearchTokens.length && variantSearchTokens.length && !collectorNumberQuery) {
        const recentSetIds = setRows.slice(0, 20).map(set => set.id)
        const variantCardFields = CARD_FIELDS.replace('card_print_variants(', 'card_print_variants!inner(')
        for (const token of variantSearchTokens) {
          const pattern = escapedPattern(token)
          searches.push(fetchAllRows(() => supabase.from('cards').select(variantCardFields)
            .in('card_set_id', recentSetIds).ilike('card_print_variants.variant_label', pattern)
            .order('card_name').order('collector_number').limit(120)))
        }
      }
      const cardResults = await Promise.all(searches)
      const cardError = cardResults.find(result => result.error)?.error
      if (cardError) throw cardError
      const uniqueCards = [...new Map(cardResults.flatMap(result => result.data || []).map(card => [card.id, card])).values()]
      const matchingCards = uniqueCards.filter(card => {
        const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets || setById.get(card.card_set_id)
        if (collectorNumberQuery) {
          return normalizeNumericCollectorNumber(card.collector_number) === collectorNumberQuery.number
            && (Number(set?.advertised_card_count) === collectorNumberQuery.total
              || collectorNumberTotal(card.collector_number) === collectorNumberQuery.total)
        }
        const variantText = (card.card_print_variants || []).flatMap(variant => [
          variant.variant_label, variant.variant_key, variant.finish_code, variant.guide_marker, variant.checklist_group
        ]).filter(Boolean).join(' ')
        const searchable = normalizeSearch([
          card.card_name, card.collector_number, set?.series_name, set?.set_name, set?.set_code, variantText
        ].join(' '))
        return tokens.every(token => searchable.includes(token))
      })
      matchingCards.sort((left, right) => {
        const leftName = normalizeText(left.card_name)
        const rightName = normalizeText(right.card_name)
        const normalizedQuery = normalizeText(term)
        const exactOrder = Number(rightName === normalizedQuery) - Number(leftName === normalizedQuery)
        if (exactOrder) return exactOrder
        const leftSet = Array.isArray(left.card_sets) ? left.card_sets[0] : left.card_sets || setById.get(left.card_set_id)
        const rightSet = Array.isArray(right.card_sets) ? right.card_sets[0] : right.card_sets || setById.get(right.card_set_id)
        return String(rightSet?.release_date || '').localeCompare(String(leftSet?.release_date || ''))
          || leftName.localeCompare(rightName, 'fr')
      })
      const matcher = productMatcher(term)
      const matchingProducts = (productsResult.data || []).filter(matcher)
      const seriesReleaseDates = createSeriesReleaseDateMap(setRows)
      const normalizedTerm = normalizeSearch(term)
      const etbSearch = normalizedTerm.split(' ').includes('etb')
        || normalizedTerm.includes('coffret dresseur')
        || normalizedTerm.includes('elite trainer box')
      const productGroup = product => {
        const type = normalizeSearch(product?.product_type)
        const name = normalizeText(product?.name)
        if (type === 'etb') return 0
        if (type === 'case' || type.startsWith('case ') || name.startsWith('case de ')) return 2
        return 1
      }
      matchingProducts.sort((left, right) => {
        const groupOrder = productGroup(left) - productGroup(right)
        if (groupOrder) return groupOrder
        return compareProductsByRelease(right, left, seriesReleaseDates)
          || normalizeText(left.name).localeCompare(normalizeText(right.name), 'fr')
          || String(left.id).localeCompare(String(right.id))
      })
      if (!cancelled) {
        setCards(matchingCards.slice(0, 60))
        setProducts(matchingProducts.slice(0, etbSearch ? 100 : 60))
        setLoading(false)
      }
    }

    searchCatalogues().catch(() => {
      if (!cancelled) {
        setCards([])
        setProducts([])
        setError('La recherche est momentanément indisponible. Réessaie dans quelques instants.')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [initialQuery, supabase])

  useEffect(() => {
    if (!cards.length) {
      setCardPrices({})
      setPricesLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    async function loadCardPrices() {
      setPricesLoading(true)
      const requestCards = cards.map(card => {
        const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
        return {
          id: card.id,
          source_url: card.source_url,
          image_source_url: card.image_source_url,
          set_code: set?.set_code,
          edition_market_code: set?.language || 'FR',
          card_name: card.card_name,
          collector_number: card.collector_number,
          variants: (card.card_print_variants || []).map(variant => ({ id: variant.id, finish_code: variant.finish_code }))
        }
      })
      try {
        const response = await fetch('/api/card-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: requestCards }),
          signal: controller.signal
        })
        if (!response.ok) throw new Error('Cotes indisponibles')
        const payload = await response.json()
        if (!cancelled) {
          setCardPrices(Object.fromEntries((payload.prices || []).map(price => [price.cardId, price])))
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) setCardPrices({})
      } finally {
        if (!cancelled) setPricesLoading(false)
      }
    }
    loadCardPrices()
    return () => { cancelled = true; controller.abort() }
  }, [cards])

  useEffect(() => {
    let cancelled = false
    async function loadCollectionProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (cancelled) return
        if (authError || !user) {
          setCollectionAccess('signed_out')
          return
        }
        const { data: profiles, error: profileError } = await supabase.from('collection_profiles')
          .select('id,display_name,is_default,profile_type').order('created_at')
        if (profileError) throw profileError
        if (cancelled) return
        const savedProfileId = window.localStorage.getItem('pokevaleur-collection:' + user.id)
        const activeProfile = (profiles || []).find(profile => profile.id === savedProfileId)
          || (profiles || []).find(profile => profile.is_default)
          || (profiles || [])[0]
        if (!activeProfile) {
          setCollectionAccess('error')
          return
        }
        window.localStorage.setItem('pokevaleur-collection:' + user.id, activeProfile.id)
        setCollectionProfile({ ...activeProfile, userId: user.id })
        setCollectionAccess('ready')
      } catch {
        if (!cancelled) setCollectionAccess('error')
      }
    }
    loadCollectionProfile()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (collectionAccess !== 'ready' || !collectionProfile || !cards.length) {
      setCollectionOwnership({})
      return
    }
    let cancelled = false
    async function loadCollectionOwnership() {
      const variantIds = [...new Set(cards.flatMap(card => (card.card_print_variants || []).map(variant => variant.id)))]
      if (!variantIds.length) {
        setCollectionOwnership({})
        return
      }
      const ownership = {}
      for (let offset = 0; offset < variantIds.length; offset += 100) {
        const batch = variantIds.slice(offset, offset + 100)
        const { data, error: ownershipError } = await supabase.from('collection_cards')
          .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id')
          .eq('collection_profile_id', collectionProfile.id)
          .in('card_print_variant_id', batch)
        if (ownershipError) throw ownershipError
        for (const copy of data || []) {
          if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
          ownership[copy.card_print_variant_id].push(copy)
        }
      }
      if (!cancelled) setCollectionOwnership(ownership)
    }
    loadCollectionOwnership().catch(() => {
      if (!cancelled) { setCollectionAccess('error'); setCollectionNotice('Impossible de charger ta collection pour le moment.') }
    })
    return () => { cancelled = true }
  }, [cards, collectionAccess, collectionProfile, supabase])

  useEffect(() => {
    if (collectionAccess !== 'ready' || !collectionProfile || !products.length) {
      setCollectionProductOwnership({})
      return
    }
    let cancelled = false
    async function loadCollectionProducts() {
      const productIds = [...new Set(products.map(product => product.id))]
      const ownership = {}
      for (let offset = 0; offset < productIds.length; offset += 100) {
        const batch = productIds.slice(offset, offset + 100)
        const { data, error: ownershipError } = await supabase.from('collection_items')
          .select('id,product_id,custom_name,quantity,purchase_price,purchase_date,sealed_condition,product_type_override,variant_note,created_at')
          .eq('collection_profile_id', collectionProfile.id)
          .in('product_id', batch)
          .order('created_at', { ascending: false })
        if (ownershipError) throw ownershipError
        for (const item of data || []) {
          if (!ownership[item.product_id]) ownership[item.product_id] = []
          ownership[item.product_id].push(item)
        }
      }
      if (!cancelled) setCollectionProductOwnership(ownership)
    }
    loadCollectionProducts().catch(() => {
      if (!cancelled) { setCollectionAccess('error'); setCollectionNotice('Impossible de charger ta collection pour le moment.') }
    })
    return () => { cancelled = true }
  }, [products, collectionAccess, collectionProfile, supabase])

  useEffect(() => {
    if (!collectionCardId && !collectionProductId) return
    const closeOnEscape = event => {
      if (event.key === 'Escape') { setCollectionCardId(''); setCollectionProductId('') }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [collectionCardId, collectionProductId])

  async function changeCollectionCopy(variant, action) {
    if (!collectionProfile || collectionBusyVariant) return
    const copies = collectionOwnership[variant.id] || []
    const copyToRemove = copies[copies.length - 1]
    if (action === 'remove') {
      if (!copyToRemove) return
      const description = copyToRemove.ownership_type === 'graded'
        ? 'Retirer cet exemplaire gradé de ta collection ?'
        : 'Retirer un exemplaire de ta collection ?'
      if (!window.confirm(description)) return
    }
    setCollectionBusyVariant(variant.id)
    setCollectionNotice('')
    try {
      if (action === 'add') {
        const { data, error: insertError } = await supabase.from('collection_cards').insert({
          user_id: collectionProfile.userId,
          collection_profile_id: collectionProfile.id,
          card_print_variant_id: variant.id,
          ownership_type: 'raw'
        }).select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id').single()
        if (insertError) throw insertError
        setCollectionOwnership(current => ({
          ...current,
          [variant.id]: [...(current[variant.id] || []), data]
        }))
        setCollectionNotice('Un exemplaire de ' + (variant.variant_label || variant.variant_key || variant.finish_code || 'cette variante') + ' a été ajouté.')
      } else {
        const { error: deleteError } = await supabase.from('collection_cards').delete().eq('id', copyToRemove.id)
        if (deleteError) throw deleteError
        setCollectionOwnership(current => ({
          ...current,
          [variant.id]: (current[variant.id] || []).filter(copy => copy.id !== copyToRemove.id)
        }))
        setCollectionNotice('Un exemplaire a été retiré de ta collection.')
      }
    } catch (saveError) {
      setCollectionNotice('Modification impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setCollectionBusyVariant('')
    }
  }

  function openCollectionCard(card) {
    if (collectionAccess === 'signed_out') {
      window.location.href = '/login?next=%2Frecherche%3Fsearch%3D' + encodeURIComponent(query.trim())
      return
    }
    setCollectionNotice(collectionAccess === 'error' ? 'Connexion à la collection indisponible.' : '')
    setCollectionCardId(card.id)
  }

  function openCollectionProduct(product) {
    if (collectionAccess === 'signed_out') {
      window.location.href = '/login?next=%2Frecherche%3Fsearch%3D' + encodeURIComponent(query.trim())
      return
    }
    setCollectionNotice(collectionAccess === 'error' ? 'Connexion à la collection indisponible.' : '')
    setCollectionProductId(product.id)
  }

  async function changeCollectionProduct(product, action, item = null) {
    if (!collectionProfile || collectionBusyProduct) return
    setCollectionBusyProduct(true)
    setCollectionNotice('')
    try {
      if (action === 'add') {
        const { data, error: insertError } = await supabase.from('collection_items').insert({
          user_id: collectionProfile.userId,
          collection_profile_id: collectionProfile.id,
          product_id: product.id,
          quantity: 1,
          sealed_condition: 'standard'
        }).select('id,product_id,custom_name,quantity,purchase_price,purchase_date,sealed_condition,product_type_override,variant_note,created_at').single()
        if (insertError) throw insertError
        setCollectionProductOwnership(current => ({
          ...current,
          [product.id]: [data, ...(current[product.id] || [])]
        }))
        setCollectionNotice('Un exemplaire a été ajouté à ta collection.')
      } else if (item) {
        if (item.quantity > 1) {
          const { data, error: updateError } = await supabase.from('collection_items').update({ quantity: item.quantity - 1 })
            .eq('id', item.id).eq('user_id', collectionProfile.userId).eq('collection_profile_id', collectionProfile.id)
            .select('id,product_id,custom_name,quantity,purchase_price,purchase_date,sealed_condition,product_type_override,variant_note,created_at').single()
          if (updateError) throw updateError
          setCollectionProductOwnership(current => ({
            ...current,
            [product.id]: (current[product.id] || []).map(entry => entry.id === data.id ? data : entry)
          }))
        } else {
          const { error: deleteError } = await supabase.from('collection_items').delete()
            .eq('id', item.id).eq('user_id', collectionProfile.userId).eq('collection_profile_id', collectionProfile.id)
          if (deleteError) throw deleteError
          setCollectionProductOwnership(current => ({
            ...current,
            [product.id]: (current[product.id] || []).filter(entry => entry.id !== item.id)
          }))
        }
        setCollectionNotice('Un exemplaire a été retiré de ta collection.')
      }
    } catch (saveError) {
      setCollectionNotice('Modification impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setCollectionBusyProduct(false)
    }
  }

  const hasQuery = query.trim().length >= 2
  return <main className={styles.page}>
    <header className={styles.hero}>
      <a className={styles.back} href="/">← Accueil</a>
      <p className={styles.kicker}>Catalogue PokéValeur</p>
      <h1>Recherche une carte ou un produit scellé</h1>
      <form className={styles.form} action="/recherche" method="get" role="search">
        <label className={styles.srOnly} htmlFor="catalog-universal-search">Carte ou produit scellé</label>
        <input id="catalog-universal-search" type="search" name="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex. Pikachu, EV9, ETB…" autoComplete="off" />
        <VoiceSearchButton />
        <button type="submit">Rechercher</button>
      </form>
      {hasQuery && <p className={styles.queryLabel}>Résultats pour <strong>{query.trim()}</strong></p>}
    </header>

    {!hasQuery ? <p className={styles.message}>Saisis au moins deux caractères pour rechercher dans les cartes et les produits scellés.</p>
      : loading ? <p className={styles.message} role="status">Recherche dans les deux catalogues…</p>
        : error ? <p className={styles.message} role="alert">{error}</p>
          : <>
            <section className={styles.resultsSection} aria-labelledby="cards-heading">
              <div className={styles.sectionHeading}><div><h2 id="cards-heading">Cartes</h2><p>Plusieurs langues peuvent apparaître.</p></div><span>{cards.length}</span></div>
              {cards.length ? <div className={styles.grid}>
                {cards.map(card => {
                  const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
                  const quote = formatPrice(cardPrices[card.id]?.amount, cardPrices[card.id]?.currency)
                  const target = '/catalogue/cartes?set=' + encodeURIComponent(card.card_set_id) + '&filter=' + encodeURIComponent(card.collector_number || card.card_name)
                  const quantity = (card.card_print_variants || []).reduce((total, variant) => total + (collectionOwnership[variant.id] || []).length, 0)
                  const collectionLabel = collectionAccess === 'loading' ? 'Collection…'
                    : collectionAccess === 'signed_out' ? 'Se connecter'
                      : collectionAccess === 'error' ? 'Collection indisponible'
                        : quantity ? quantity + ' dans ma collection' : '0 dans ma collection'
                  return <article className={styles.card} key={card.id}>
                    <a className={styles.cardLink} href={target}>
                      <span className={styles.imageFrame}>{card.image_url ? <img src={card.image_url} alt="" loading="lazy"/> : <span className={styles.noImage}>Image à venir</span>}</span>
                      <span className={styles.cardText}><strong>{card.card_name}</strong><span>{card.collector_number || 'Numéro non indiqué'}</span><small>{set?.set_name || set?.series_name || 'Série non précisée'} · {languageLabel(set?.language)}</small>
                        <span className={quote ? styles.pricePill : `${styles.pricePill} ${styles.priceUnavailable}`} title={cardPrices[card.id]?.source || 'Cote actuelle du catalogue'} aria-label={quote ? `Cote actuelle : ${quote}` : pricesLoading ? 'Chargement de la cote actuelle' : 'Cote indisponible'}>{pricesLoading && !cardPrices[card.id] ? '…' : quote || 'Cote indisponible'}</span>
                      </span>
                    </a>
                    <button type="button" className={styles.collectionPill} onClick={() => openCollectionCard(card)} aria-label={'Voir et modifier la collection pour ' + card.card_name} disabled={collectionAccess === 'loading'}>
                      <span aria-hidden="true">{quantity ? '✓' : '+'}</span>{collectionLabel}
                    </button>
                  </article>
                })}
              </div> : <p className={styles.empty}>Aucune carte ne correspond à cette recherche.</p>}
              {cards.length > 0 && <a className={styles.moreLink} href={'/catalogue/cartes?search=' + encodeURIComponent(query.trim())}>Continuer dans le catalogue des cartes →</a>}
            </section>

            <section className={styles.resultsSection} aria-labelledby="products-heading">
              <div className={styles.sectionHeading}><div><h2 id="products-heading">Produits scellés</h2><p>ETB, displays, coffrets et autres produits.</p></div><span>{products.length}</span></div>
              {products.length ? <div className={styles.grid}>
                {products.map(product => {
                  const quote = formatPrice(product.current_value)
                  const productImage = isEtbCase(product) ? GENERIC_ETB_CASE_IMAGE : product.image_url
                  const copies = collectionProductOwnership[product.id] || []
                  const quantity = copies.reduce((total, item) => total + Number(item.quantity || 1), 0)
                  const collectionLabel = collectionAccess === 'loading' ? 'Collection…'
                    : collectionAccess === 'signed_out' ? 'Se connecter'
                      : collectionAccess === 'error' ? 'Collection indisponible'
                        : quantity ? quantity + ' dans ma collection' : '0 dans ma collection'
                  return <article className={styles.product} key={product.id}>
                    <a className={styles.cardLink} href={'/catalogue/' + encodeURIComponent(product.id)}>
                      <span className={styles.imageFrame}>{productImage ? <img src={getProductThumbnailUrl(productImage)} alt="" loading="lazy" decoding="async"/> : <span className={styles.noImage}>Image à venir</span>}</span>
                      <span className={styles.cardText}><strong>{product.name}</strong><span>{product.product_type || 'Produit scellé'}</span><small>{product.series || product.case_reference || 'Série non précisée'}</small>
                        <span className={quote ? styles.pricePill : `${styles.pricePill} ${styles.priceUnavailable}`} title={product.price_source || 'Cote actuelle du catalogue'} aria-label={quote ? `Cote actuelle : ${quote}` : 'Cote indisponible'}>{quote || 'Cote indisponible'}</span>
                      </span>
                    </a>
                    <button type="button" className={styles.collectionPill} onClick={() => openCollectionProduct(product)} aria-label={'Voir et modifier la collection pour ' + product.name} disabled={collectionAccess === 'loading'}>
                      <span aria-hidden="true">{quantity ? '✓' : '+'}</span>{collectionLabel}
                    </button>
                  </article>
                })}
              </div> : <p className={styles.empty}>Aucun produit scellé ne correspond à cette recherche.</p>}
              {products.length > 0 && <a className={styles.moreLink} href={'/catalogue?search=' + encodeURIComponent(query.trim())}>Continuer dans le catalogue des produits →</a>}
            </section>
          </>}
    {collectionCardId && (() => {
      const card = cards.find(entry => entry.id === collectionCardId)
      if (!card) return null
      const set = Array.isArray(card.card_sets) ? card.card_sets[0] : card.card_sets
      const variants = card.card_print_variants || []
      const total = variants.reduce((count, variant) => count + (collectionOwnership[variant.id] || []).length, 0)
      return <div className={styles.collectionOverlay} onMouseDown={event => { if (event.target === event.currentTarget) setCollectionCardId('') }}>
        <section className={styles.collectionDialog} role="dialog" aria-modal="true" aria-labelledby="collection-dialog-title">
          <button type="button" className={styles.collectionClose} onClick={() => setCollectionCardId('')} aria-label="Fermer">×</button>
          <p className={styles.collectionEyebrow}>{set?.set_name || set?.series_name || 'Carte'} · {languageLabel(set?.language)}</p>
          <h2 id="collection-dialog-title">{card.card_name}</h2>
          <p className={styles.collectionSubtitle}>N° {card.collector_number || 'non indiqué'} · {total} exemplaire{total === 1 ? '' : 's'} dans {collectionProfile?.display_name || 'le profil actif'}</p>
          {collectionAccess === 'signed_out'
            ? <a className={styles.collectionLogin} href={'/login?next=%2Frecherche%3Fsearch%3D' + encodeURIComponent(query.trim())}>Se connecter pour gérer ma collection →</a>
            : collectionAccess === 'error'
              ? <p className={styles.collectionFeedback} role="alert">Impossible d’accéder à ta collection. Recharge la page et réessaie.</p>
              : variants.length ? <div className={styles.collectionVariantList}>
                {variants.map(variant => {
                  const copies = collectionOwnership[variant.id] || []
                  const label = variant.variant_label || variant.variant_key || variant.finish_code || 'Version'
                  const graded = copies.filter(copy => copy.ownership_type === 'graded')
                  return <div className={styles.collectionVariant} key={variant.id}>
                    <div className={styles.collectionVariantName}><strong>{label}</strong>
                      {graded.length > 0 && <small>{graded.length} gradée{graded.length > 1 ? 's' : ''}</small>}
                    </div>
                    <strong className={copies.length ? styles.collectionQuantity : styles.collectionMissing}>{copies.length ? copies.length + ' ex.' : 'Non possédée'}</strong>
                    <div className={styles.collectionActions}>
                      <button type="button" onClick={() => changeCollectionCopy(variant, 'remove')} disabled={!copies.length || collectionBusyVariant === variant.id} aria-label={'Retirer un exemplaire ' + label}>−</button>
                      <button type="button" onClick={() => changeCollectionCopy(variant, 'add')} disabled={collectionBusyVariant === variant.id} aria-label={'Ajouter un exemplaire ' + label}>+</button>
                    </div>
                  </div>
                })}
              </div> : <p className={styles.collectionFeedback}>Aucune variante n’est renseignée pour cette carte dans le catalogue.</p>}
          {collectionNotice && <p className={styles.collectionFeedback} role="status">{collectionNotice}</p>}
        </section>
      </div>
    })()}
    {collectionProductId && (() => {
      const product = products.find(entry => entry.id === collectionProductId)
      if (!product) return null
      const items = collectionProductOwnership[product.id] || []
      const quantity = items.reduce((total, item) => total + Number(item.quantity || 1), 0)
      return <div className={styles.collectionOverlay} onMouseDown={event => { if (event.target === event.currentTarget) setCollectionProductId('') }}>
        <section className={styles.collectionDialog} role="dialog" aria-modal="true" aria-labelledby="collection-product-dialog-title">
          <button type="button" className={styles.collectionClose} onClick={() => setCollectionProductId('')} aria-label="Fermer">×</button>
          <p className={styles.collectionEyebrow}>{product.product_type || 'Produit scellé'} · {product.series || 'Série non précisée'}</p>
          <h2 id="collection-product-dialog-title">{product.name}</h2>
          <p className={styles.collectionSubtitle}>{quantity} exemplaire{quantity === 1 ? '' : 's'} dans {collectionProfile?.display_name || 'le profil actif'}</p>
          {collectionAccess === 'signed_out'
            ? <a className={styles.collectionLogin} href={'/login?next=%2Frecherche%3Fsearch%3D' + encodeURIComponent(query.trim())}>Se connecter pour gérer ma collection →</a>
            : collectionAccess === 'error'
              ? <p className={styles.collectionFeedback} role="alert">Impossible d’accéder à ta collection. Recharge la page et réessaie.</p>
              : <div className={styles.collectionVariantList}>
                {items.length ? items.map((item, index) => <div className={styles.collectionVariant} key={item.id}>
                  <div className={styles.collectionVariantName}><strong>{item.custom_name || `Exemplaire ${index + 1}`}</strong>
                    <small>{[item.sealed_condition === 'zero_defect' ? 'Zéro défaut' : 'État standard', item.purchase_date ? new Date(item.purchase_date + 'T00:00:00').toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ')}</small>
                  </div>
                  <strong className={styles.collectionQuantity}>{item.quantity || 1} ex.</strong>
                  <div className={styles.collectionActions}>
                    <button type="button" onClick={() => changeCollectionProduct(product, 'remove', item)} disabled={collectionBusyProduct} aria-label="Retirer un exemplaire">−</button>
                    <button type="button" onClick={() => changeCollectionProduct(product, 'add')} disabled={collectionBusyProduct} aria-label="Ajouter un exemplaire">+</button>
                  </div>
                </div>) : <>
                  <p className={styles.collectionFeedback}>Aucun exemplaire de ce produit dans cette collection.</p>
                  <div className={styles.collectionVariant}>
                    <div className={styles.collectionVariantName}><strong>Ajouter un exemplaire</strong></div>
                    <span />
                    <div className={styles.collectionActions}><button type="button" onClick={() => changeCollectionProduct(product, 'add')} disabled={collectionBusyProduct} aria-label="Ajouter un exemplaire">+</button></div>
                  </div>
                </>}
              </div>}
          {collectionNotice && <p className={styles.collectionFeedback} role="status">{collectionNotice}</p>}
        </section>
      </div>
    })()}
  </main>
}
