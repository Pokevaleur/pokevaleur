'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { fetchAllRows } from '../../../../lib/supabase-pagination'
import { SERIES_STATS_SOURCE } from './series-stats-data'
import styles from './page.module.css'

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function showCount(value) {
  return Number.isFinite(value) && value > 0 ? formatNumber(value) : '—'
}

function setLabel(set) {
  const code = String(set.set_code || '').toUpperCase()
  return (code ? code + ' · ' : '') + (set.set_name || set.series_name || 'Série')
}

export default function SeriesStatsPage() {
  const supabase = useMemo(() => createClient(), [])
  const sourceByCode = useMemo(() => new Map(
    SERIES_STATS_SOURCE
      .filter(item => item.catalogCode)
      .map(item => [normalizeText(item.catalogCode), item])
  ), [])
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [showOnlyWithStats, setShowOnlyWithStats] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadSets() {
      const { data, error: loadError } = await fetchAllRows(() => supabase
        .from('card_sets')
        .select('id,series_name,set_name,set_code,release_date')
        .eq('language', 'FR')
        .eq('is_public', true)
        .order('release_date', { ascending: false })
        .order('set_name'))
      if (loadError) throw loadError
      if (cancelled) return
      setRows((data || []).map(set => ({
        ...set,
        stats: sourceByCode.get(normalizeText(set.set_code)) || null
      })))
    }
    loadSets()
      .catch(() => { if (!cancelled) setError('Les séries ne peuvent pas être chargées pour le moment.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase, sourceByCode])

  const matchedCount = rows.filter(row => row.stats).length
  const visibleRows = rows.filter(row => {
    if (showOnlyWithStats && !row.stats) return false
    const searchText = normalizeText([row.series_name, row.set_name, row.set_code].join(' '))
    return searchText.includes(normalizeText(query))
  })

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Catalogue · Cartes</p>
        <h1>Stats séries</h1>
        <p>Compare les nombres de cartes nécessaires pour compléter les niveaux de collection des séries françaises.</p>
        <nav className={styles.sectionNav} aria-label="Pages du catalogue de cartes">
          <a href="/catalogue/cartes">Catalogue des cartes</a>
          <a href="/catalogue/cartes/stats-series" aria-current="page">Stats séries</a>
        </nav>
      </header>

      <section className={styles.intro} aria-label="Comprendre les niveaux">
        <div><strong>Full Set</strong><span>Une carte de chaque numéro de la série, secrètes comprises.</span></div>
        <div><strong>Master Set</strong><span>Le Full Set avec les versions de cartes trouvables dans les boosters.</span></div>
        <div><strong>Ultra Master Set</strong><span>Le niveau le plus complet indiqué par la source, avec les cartes de Ligue et Staff lorsqu’elles y figurent.</span></div>
        <p>Les niveaux s’ajoutent les uns aux autres. Le total Ultra Master Set reprend le niveau cumulé le plus élevé disponible entre Ultra Master Set, Ligue et Staff, sans additionner ces niveaux entre eux. Pour EV09, le total toutes cartes incluses ajoute les quatre versions promo Staff au total Ligue : 373 + 4 = 377.</p>
        <p>Ces chiffres décrivent le référentiel WikiPokeTCG et peuvent différer des cibles calculées par le classeur de collection PokéValeur.</p>
      </section>

      <p className={styles.attribution}>
        Source des chiffres : WikiPokeTCG, « Référencement de toutes les cartes FR », par grall_69.
        Licence <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noreferrer">Creative Commons BY-NC-ND 4.0</a>.
      </p>

      <label className={styles.search}>
        <span>Rechercher une série</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, code ou bloc…" />
      </label>
      <label className={styles.toggle}>
        <input type="checkbox" checked={showOnlyWithStats} onChange={event => setShowOnlyWithStats(event.target.checked)} />
        <span>Afficher uniquement les séries avec des chiffres source</span>
      </label>

      {loading && <p className={styles.message} role="status">Chargement des séries…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && <p className={styles.resultCount}>
        {formatNumber(matchedCount)} sur {formatNumber(rows.length)} séries du catalogue ont des chiffres source rapprochés.
      </p>}

      {!loading && !error && visibleRows.length > 0 && <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th scope="col">Série</th>
              <th scope="col">Full Set</th>
              <th scope="col">Master Set</th>
              <th scope="col">Ultra Master Set<br /><small>Toutes cartes incluses</small></th>
              <th scope="col">Catalogue</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => <tr key={row.id}>
              <th scope="row">
                <span className={styles.seriesName}>{setLabel(row)}</span>
                <span className={styles.seriesGroup}>{row.series_name}</span>
                {row.stats?.sourceCode === 'EV09' && <details className={styles.differences}>
                  <summary>Voir les cartes rattachées à chaque niveau EV09</summary>
                  <p><strong>Totaux de référence / cibles PokéValeur :</strong> Master 333 / 339 · Ultra Master 344 / 351 · Ligue 373 / 376 · toutes cartes Staff incluses 377 / 380.</p>

                  <p><strong>Master Set — 333 dans la source, 339 dans PokéValeur.</strong> Ces six variantes sont des cibles supplémentaires dans PokéValeur; l’Ultra Master source les reprend :</p>
                  <ul>
                    <li><strong>052/159 · Têtampoule de Mashynn</strong> : Holo cosmos</li>
                    <li><strong>055/159 · Fulgulairo de Mashynn</strong> : Normale dans PokéValeur, promo non holo dans la liste Ultra source</li>
                    <li><strong>128/159 · Bruyverne</strong> : Normale dans PokéValeur, promo non holo dans la liste Ultra source</li>
                    <li><strong>135/159 · Moumouton de Nabil</strong> : Holo cosmos</li>
                    <li><strong>136/159 · Moumouflon de Nabil</strong> : Holo cosmos</li>
                    <li><strong>151/159 · Perle de Lilie</strong> : Holo cosmos</li>
                  </ul>

                  <p><strong>Ultra Master — 344 dans la source, 351 dans PokéValeur.</strong> L’Ultra Master source compte cinq variantes spéciales en plus des six précédentes :</p>
                  <ul>
                    <li><strong>024/159 · Braségali-ex</strong> : holo promo avec tampon Aventures Ensemble</li>
                    <li><strong>030/159 · Reshiram-ex</strong> : holo promo avec tampon Aventures Ensemble</li>
                    <li><strong>032/159 · Artikodin</strong> : holo cosmos avec tampon flocon dans la source ; PokéValeur le classe en holo tamponné flocon</li>
                    <li><strong>117/159 · Ronflex de Nabil</strong> : holo avec tampon GameStop</li>
                    <li><strong>167/159 · Reshiram de N</strong> : holo promo avec tampon Aventures Ensemble</li>
                  </ul>
                  <p>PokéValeur rattache aussi sept promos SVP au niveau Ultra Master :</p>
                  <ul>
                    <li>SVP 181 · Darumacho de N</li>
                    <li>SVP 182 · Fulgulairo de Mashynn</li>
                    <li>SVP 183 · Rubombelle de Lilie</li>
                    <li>SVP 184 · Ronflex de Nabil</li>
                    <li>SVP 187 · Yanmega</li>
                    <li>SVP 188 · Baggaïd</li>
                    <li>SVP 189 · Zorua de N</li>
                  </ul>

                  <p><strong>Ultra Master Ligue — 373 dans la source, 376 dans PokéValeur.</strong> La source ajoute 29 variantes à son Ultra Master. PokéValeur suit 25 variantes tamponnées Play! Pokémon :</p>
                  <details>
                    <summary>Afficher les 25 variantes Play! Pokémon</summary>
                    <ul>
                      <li>027/159 · Darumacho de N</li>
                      <li>047/159 · Voltorbe de Mashynn</li>
                      <li>053/159 · Ampibidou-ex de Mashynn</li>
                      <li>055/159 · Fulgulairo de Mashynn</li>
                      <li>056/159 · Mélofée-ex de Lilie</li>
                      <li>067/159 · Rubombelle de Lilie — Normale et Holo cosmos</li>
                      <li>079/159 · Mammochon-ex</li>
                      <li>095/159 · Tyranocif</li>
                      <li>098/159 · Zoroark-ex de N</li>
                      <li>111/159 · Zacian-ex de Nabil</li>
                      <li>116/159 · Reshiram de N</li>
                      <li>117/159 · Ronflex de Nabil</li>
                      <li>136/159 · Moumouflon de Nabil</li>
                      <li>146/159 · Exploration de Pierre</li>
                      <li>147/159 · Sac de Nabil</li>
                      <li>148/159 · Bandeau Choix de Nabil</li>
                      <li>149/159 · Esprit Combatif d’Iris</li>
                      <li>150/159 · Levalendura — Normale et Holo cosmos</li>
                      <li>151/159 · Perle de Lilie</li>
                      <li>152/159 · Palais de N</li>
                      <li>153/159 · PP Plus de N — Normale et Holo cosmos</li>
                      <li>154/159 · Paddoxton</li>
                    </ul>
                  </details>
                  <p>La liste Ligue fournie détaille 29 variantes Play! Pokémon : 12 promos non holo et 17 promos holo/cosmos/ultra. PokéValeur rattache 25 variantes Play! Pokémon à ce niveau. L’écart est donc de quatre variantes par rapport au document source; les 25 entrées ci-dessus sont celles actuellement présentes dans le catalogue.</p>

                  <p><strong>Staff — total toutes cartes incluses : 377 selon le calcul 373 + 4 ; 380 cibles dans PokéValeur.</strong> Les quatre variantes promo Staff sont :</p>
                  <ul>
                    <li>SVP 181 · Darumacho de N</li>
                    <li>SVP 182 · Fulgulairo de Mashynn</li>
                    <li>SVP 183 · Rubombelle de Lilie</li>
                    <li>SVP 184 · Ronflex de Nabil</li>
                  </ul>
                </details>}
              </th>
              <td data-label="Full Set">{showCount(row.stats?.fullSet)}</td>
              <td data-label="Master Set">{showCount(row.stats?.masterSet)}</td>
              <td data-label="Ultra Master Set">{showCount(row.stats?.ultraMasterSet)}</td>
              <td data-label="Catalogue"><a className={styles.catalogLink} href={'/catalogue/cartes?set=' + encodeURIComponent(row.id)}>Voir les cartes</a></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

      {!loading && !error && !visibleRows.length && <p className={styles.message}>Aucune série ne correspond à cette recherche.</p>}
    </main>
  )
}
