'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { fetchAllRows } from '../../../../lib/supabase-pagination'
import styles from './page.module.css'

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function displayCount(value) {
  return Number(value) > 0 ? formatNumber(value) : '—'
}

function seriesTitle(set) {
  const code = String(set.set_code || '').toUpperCase()
  return (code ? code + ' · ' : '') + (set.set_name || set.series_name || 'Série')
}

export default function SeriesStatsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      const { data: sets, error: setsError } = await fetchAllRows(() => supabase
        .from('card_sets')
        .select('id,series_name,set_name,set_code,release_date,advertised_card_count,checklist_scope_note')
        .eq('language', 'FR')
        .eq('is_public', true)
        .order('release_date', { ascending: false })
        .order('set_name'))

      if (setsError) throw setsError
      const setIds = (sets || []).map(set => set.id)
      let cards = []
      if (setIds.length) {
        const result = await fetchAllRows(() => supabase
          .from('cards')
          .select('id,card_set_id,card_print_variants(id,checklist_group,is_master_set_target)')
          .in('card_set_id', setIds))
        if (result.error) throw result.error
        cards = result.data || []
      }

      const counts = new Map((sets || []).map(set => [set.id, {
        cardCount: 0,
        mainTargets: 0,
        extraTargets: 0,
        unclassifiedTargets: 0
      }]))
      for (const card of cards) {
        const count = counts.get(card.card_set_id)
        if (!count) continue
        count.cardCount += 1
        for (const variant of card.card_print_variants || []) {
          if (!variant.is_master_set_target) continue
          if (variant.checklist_group === 'main') count.mainTargets += 1
          else if (variant.checklist_group === 'promo' || variant.checklist_group === 'stamp') count.extraTargets += 1
          else count.unclassifiedTargets += 1
        }
      }

      if (cancelled) return
      setRows((sets || []).map(set => ({
        ...set,
        ...counts.get(set.id),
        totalTargets: (counts.get(set.id)?.mainTargets || 0)
          + (counts.get(set.id)?.extraTargets || 0)
          + (counts.get(set.id)?.unclassifiedTargets || 0)
      })))
    }

    loadStats()
      .catch(() => { if (!cancelled) setError('Les statistiques des séries ne peuvent pas être chargées pour le moment.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase])

  const visibleRows = rows.filter(row => {
    const text = normalizeText([row.series_name, row.set_name, row.set_code].join(' '))
    return text.includes(normalizeText(query))
  })

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Catalogue · Cartes</p>
        <h1>Stats séries</h1>
        <p>Retrouve, pour chaque série française, le nombre de cartes répertoriées et les versions actuellement incluses dans sa checklist PokéValeur.</p>
        <nav className={styles.sectionNav} aria-label="Pages du catalogue de cartes">
          <a href="/catalogue/cartes">Catalogue des cartes</a>
          <a href="/catalogue/cartes/stats-series" aria-current="page">Stats séries</a>
        </nav>
      </header>

      <section className={styles.intro} aria-label="Comprendre les chiffres">
        <p><strong>Cartes annoncées</strong> correspond au nombre indiqué pour l’extension. <strong>Cartes cataloguées</strong> compte les fiches présentes dans PokéValeur, y compris les cartes secrètes répertoriées.</p>
        <p><strong>Cibles checklist</strong> compte les versions que PokéValeur demande actuellement de réunir. La checklist principale et ses compléments sont détaillés séparément quand ils sont définis.</p>
        <p>Les chiffres reflètent le périmètre actuellement renseigné dans le catalogue. Ils peuvent évoluer lorsque les cartes, variantes ou promos sont vérifiées.</p>
      </section>

      <label className={styles.search}>
        <span>Rechercher une série</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, code ou bloc…" />
      </label>

      {loading && <p className={styles.message} role="status">Chargement des statistiques…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && <p className={styles.resultCount}>{formatNumber(visibleRows.length)} série{visibleRows.length === 1 ? '' : 's'}</p>}

      {!loading && !error && visibleRows.length > 0 && <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th scope="col">Série</th>
              <th scope="col">Annoncées</th>
              <th scope="col">Cataloguées</th>
              <th scope="col">Checklist principale</th>
              <th scope="col">Promos / tampons inclus</th>
              <th scope="col">Fiche catalogue</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => <tr key={row.id}>
              <th scope="row">
                <span className={styles.seriesName}>{seriesTitle(row)}</span>
                <span className={styles.seriesGroup}>{row.series_name}</span>
                {row.checklist_scope_note && <details className={styles.scope}>
                  <summary>Périmètre de la checklist</summary>
                  <p>{row.checklist_scope_note}</p>
                </details>}
              </th>
              <td data-label="Annoncées">{displayCount(row.advertised_card_count)}</td>
              <td data-label="Cataloguées">{formatNumber(row.cardCount || 0)}</td>
              <td data-label="Checklist principale">{displayCount(row.mainTargets)}</td>
              <td data-label="Promos / tampons inclus">{displayCount(row.extraTargets + row.unclassifiedTargets)}</td>
              <td data-label="Fiche catalogue"><a className={styles.catalogLink} href={'/catalogue/cartes?set=' + encodeURIComponent(row.id)}>Voir les cartes</a></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

      {!loading && !error && !visibleRows.length && <p className={styles.message}>Aucune série ne correspond à cette recherche.</p>}
    </main>
  )
}
