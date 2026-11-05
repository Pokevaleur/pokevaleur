'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { fetchAllRows } from '../../lib/supabase-pagination'
import { createProductMatcher, normalizeSearch } from '../../lib/product-search.mjs'
import { compareProductsByRelease, createSeriesReleaseDateMap } from '../../lib/catalogue-sort.mjs'
import { getProductThumbnailUrl } from '../../lib/optimized-image-url.js'
import styles from './page.module.css'
import VoiceSearchButton from '../voice-search-button'

const CARD_FIELDS = 'id,card_set_id,collector_number,card_name,image_url,source_url,image_source_url,card_sets!cards_card_set_id_fkey(id,series_name,set_name,set_code,language,release_date,advertised_card_count),card_print_variants(id,finish_code)'
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

function parseCollectorNumberQuery(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  return match ? { number: String(Number(match[1])), total: Number(match[2]) } : null
}

function normalizeNumericCollectorNumber(value) {
  const match = String(value || '').trim().match(/^0*(\d+)$/)
  return match ? String(Number(match[1])) : ''
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
      const tokens = normalizeSearch(term).split(/\s+/).filter(Boolean)
      const collectorNumberQuery = parseCollectorNumberQuery(term)
      const nameToken = tokens.find(token => !/^\d+$/.test(token)) || tokens[0] || term
      const numberToken = collectorNumberQuery?.number || tokens.find(token => /^\d+[a-z]*$/i.test(token)) || term
      const escapedName = escapedPattern(nameToken)
      const accentName = accentInsensitivePattern(nameToken)
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
        searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
          .ilike('card_name', escapedName).order('card_name').order('collector_number').limit(80)))
        if (accentName && accentName !== escapedName) {
          searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
            .ilike('card_name', accentName).order('card_name').order('collector_number').limit(80)))
        }
        searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', setIds)
          .ilike('collector_number', escapedNumber).order('card_name').order('collector_number').limit(80)))
        if (matchingSets.length > 0 && matchingSets.length <= 5) {
          searches.push(fetchAllRows(() => supabase.from('cards').select(CARD_FIELDS).in('card_set_id', matchingSets.map(set => set.id))
            .order('guide_order').order('collector_number').limit(80)))
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
            && Number(set?.advertised_card_count) === collectorNumberQuery.total
        }
        const searchable = normalizeText([card.card_name, card.collector_number, set?.series_name, set?.set_name, set?.set_code].join(' '))
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
                  return <a className={styles.card} href={target} key={card.id}>
                    <span className={styles.imageFrame}>{card.image_url ? <img src={card.image_url} alt="" loading="lazy"/> : <span className={styles.noImage}>Image à venir</span>}</span>
                    <span className={styles.cardText}><strong>{card.card_name}</strong><span>{card.collector_number || 'Numéro non indiqué'}</span><small>{set?.set_name || set?.series_name || 'Série non précisée'} · {languageLabel(set?.language)}</small>
                      <span className={quote ? styles.pricePill : `${styles.pricePill} ${styles.priceUnavailable}`} title={cardPrices[card.id]?.source || 'Cote actuelle du catalogue'} aria-label={quote ? `Cote actuelle : ${quote}` : pricesLoading ? 'Chargement de la cote actuelle' : 'Cote indisponible'}>{pricesLoading && !cardPrices[card.id] ? '…' : quote || 'Cote indisponible'}</span>
                    </span>
                  </a>
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
                  return <a className={styles.product} href={'/catalogue/' + encodeURIComponent(product.id)} key={product.id}>
                  <span className={styles.imageFrame}>{productImage ? <img src={getProductThumbnailUrl(productImage)} alt="" loading="lazy" decoding="async"/> : <span className={styles.noImage}>Image à venir</span>}</span>
                  <span className={styles.cardText}><strong>{product.name}</strong><span>{product.product_type || 'Produit scellé'}</span><small>{product.series || product.case_reference || 'Série non précisée'}</small>
                    <span className={quote ? styles.pricePill : `${styles.pricePill} ${styles.priceUnavailable}`} title={product.price_source || 'Cote actuelle du catalogue'} aria-label={quote ? `Cote actuelle : ${quote}` : 'Cote indisponible'}>{quote || 'Cote indisponible'}</span>
                  </span>
                </a>})}
              </div> : <p className={styles.empty}>Aucun produit scellé ne correspond à cette recherche.</p>}
              {products.length > 0 && <a className={styles.moreLink} href={'/catalogue?search=' + encodeURIComponent(query.trim())}>Continuer dans le catalogue des produits →</a>}
            </section>
          </>}
  </main>
}
