'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { fetchAllRows } from '../../../../lib/supabase-pagination'
import { SERIES_STATS_SOURCE } from './series-stats-data'
import styles from './page.module.css'

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function normalizeSeriesCode(value) {
  return normalizeText(value).replace(/^([a-z]+)0+(?=\d)/, '$1')
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
    const term = normalizeText(query)
    if (!term) return true
    const searchText = normalizeText([row.series_name, row.set_name, row.set_code, row.stats?.sourceCode].join(' '))
    const codeAliases = [row.set_code, row.stats?.sourceCode].map(normalizeSeriesCode)
    const codeTerm = normalizeSeriesCode(term)
    const matchesSeriesCode = codeTerm.length >= 2 && rows.some(candidate =>
      [candidate.set_code, candidate.stats?.sourceCode]
        .map(normalizeSeriesCode)
        .some(code => code.startsWith(codeTerm))
    )
    return matchesSeriesCode
      ? codeAliases.some(code => code.startsWith(codeTerm))
      : searchText.includes(term)
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

      <label className={styles.search}>
        <span>Rechercher une série</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom ou abréviation, ex. EV9…" />
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
              <th scope="col">Ultra Master Set</th>
              <th scope="col">Promos SVP</th>
              <th scope="col">Catalogue</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => <tr key={row.id}>
              <th scope="row">
                <span className={styles.seriesName}>{setLabel(row)}</span>
                <span className={styles.seriesGroup}>{row.series_name}</span>
                {row.stats?.sourceCode === 'EV09' && <details id="ev09-breakdown" className={styles.differences}>
                  <summary>Voir le détail des cartes EV09 par niveau</summary>
                  <p><strong>Paliers EV09 :</strong></p>
                  <ul className={styles.ev09TierLinks}>
                    <li><a href="#ev09-full-set">190 — Full Set</a></li>
                    <li><a href="#ev09-master-set">333 — Master Set</a></li>
                    <li><a href="#ev09-ultra-master">386 — Ultra Master Set maximum</a></li>
                    <li><a href="#ev09-promos">13 impressions portant le symbole SVP</a></li>
                  </ul>
                  <p id="ev09-full-set"><strong>Full Set — 190 cartes.</strong> Les cartes numérotées de la série, secrètes comprises.</p>

                  <p id="ev09-master-set"><strong>Master Set — 333 cartes.</strong> Ce palier contient 333 cartes, conformément au périmètre retenu pour le Master Set. Les variantes supplémentaires sont détaillées dans l’Ultra Master.</p>
                  <p id="ev09-ultra-master"><strong>Ultra Master Set — maximum PokéValeur : 386 cartes.</strong> Il reprend le Master Set de 333 cartes et comprend les variantes supplémentaires, les promos SVP françaises, les versions Play! Pokémon de Ligue et les versions Staff. Les 185 et 186 restent hors périmètre français ; la 193 Jumbo est exclue.</p>
                  <p><strong>Six variantes supplémentaires comptées dans l’Ultra Master :</strong></p>
                  <ul>
                    <li><strong>052/159 · Têtampoule de Mashynn</strong> : Holo cosmos</li>
                    <li><strong>055/159 · Fulgulairo de Mashynn</strong> : variante promo non holo</li>
                    <li><strong>128/159 · Bruyverne</strong> : Normale dans PokéValeur, promo non holo dans la liste Ultra source</li>
                    <li><strong>135/159 · Moumouton de Nabil</strong> : Holo cosmos</li>
                    <li><strong>136/159 · Moumouflon de Nabil</strong> : Holo cosmos</li>
                    <li><strong>151/159 · Perle de Lilie</strong> : Holo cosmos</li>
                  </ul>
                  <p><strong>Cinq variantes spéciales supplémentaires :</strong></p>
                  <ul>
                    <li><strong>024/159 · Braségali-ex</strong> : holo promo avec tampon Aventures Ensemble</li>
                    <li><strong>030/159 · Reshiram-ex</strong> : holo promo avec tampon Aventures Ensemble</li>
                    <li><strong>032/159 · Artikodin</strong> : holo cosmos avec tampon flocon</li>
                    <li><strong>117/159 · Ronflex de Nabil</strong> : holo avec tampon GameStop</li>
                    <li><strong>167/159 · Reshiram de N</strong> : holo promo avec tampon Aventures Ensemble</li>
                  </ul>
                  <p id="ev09-promos"><strong>13 impressions portant le symbole SVP</strong> : neuf cartes promo françaises et les quatre versions Staff des SVP 181 à 184. Les versions Staff sont aussi listées dans leur palier dédié.</p>
                  <ul>
                    <li>SVP 181 · Darumacho de N</li>
                    <li>SVP 182 · Fulgulairo de Mashynn</li>
                    <li>SVP 183 · Rubombelle de Lilie</li>
                    <li>SVP 184 · Ronflex de Nabil</li>
                    <li>SVP 187 · Yanmega</li>
                    <li>SVP 188 · Baggaïd</li>
                    <li>SVP 189 · Zorua de N — coffret Dresseur d’élite</li>
                    <li>SVP 194 · Ampibidou-ex de Mashynn — Collection Premium</li>
                    <li>SVP 195 · Mélofée-ex de Lilie — Collection Tournoi Premium</li>
                  </ul>
                  <p><strong>Versions Staff également marquées SVP :</strong></p>
                  <ul>
                    <li>SVP 181 · Darumacho de N — tampon Staff</li>
                    <li>SVP 182 · Fulgulairo de Mashynn — tampon Staff</li>
                    <li>SVP 183 · Rubombelle de Lilie — tampon Staff</li>
                    <li>SVP 184 · Ronflex de Nabil — tampon Staff</li>
                  </ul>
                  <p>Les quatre versions Staff et les neuf autres promos SVP françaises sont incluses dans l’Ultra Master maximum de 386 cartes. Chaque carte ou variante est comptée une seule fois.</p>

                  <p id="ev09-league"><strong>Variantes Play! Pokémon de Ligue — 29 variantes incluses dans l’Ultra Master maximum :</strong></p>
                  <details>
                    <summary>Afficher les 29 variantes Play! Pokémon</summary>
                    <ul>
                      <li>027/159 · Darumacho de N</li>
                      <li>047/159 · Voltorbe de Mashynn</li>
                      <li>053/159 · Ampibidou-ex de Mashynn</li>
                      <li>055/159 · Fulgulairo de Mashynn</li>
                      <li>056/159 · Mélofée-ex de Lilie</li>
                      <li>067/159 · Rubombelle de Lilie — promo non holo</li>
                      <li>067/159 · Rubombelle de Lilie — promo holo cosmos</li>
                      <li>079/159 · Mammochon-ex</li>
                      <li>095/159 · Tyranocif</li>
                      <li>097/159 · Zorua de N</li>
                      <li>098/159 · Zoroark-ex de N</li>
                      <li>111/159 · Zacian-ex de Nabil</li>
                      <li>116/159 · Reshiram de N — promo non holo</li>
                      <li>116/159 · Reshiram de N — holo promo Play! Pokémon</li>
                      <li>117/159 · Ronflex de Nabil — promo non holo</li>
                      <li>117/159 · Ronflex de Nabil — holo promo Play! Pokémon</li>
                      <li>136/159 · Moumouflon de Nabil — promo non holo</li>
                      <li>136/159 · Moumouflon de Nabil — holo promo Play! Pokémon</li>
                      <li>146/159 · Exploration de Pierre</li>
                      <li>147/159 · Sac de Nabil</li>
                      <li>148/159 · Bandeau Choix de Nabil</li>
                      <li>149/159 · Esprit Combatif d’Iris</li>
                      <li>150/159 · Levalendura — promo non holo</li>
                      <li>150/159 · Levalendura — promo holo cosmos</li>
                      <li>151/159 · Perle de Lilie</li>
                      <li>152/159 · Palais de N</li>
                      <li>153/159 · PP Plus de N — promo non holo</li>
                      <li>153/159 · PP Plus de N — promo holo cosmos</li>
                      <li>154/159 · Paddoxton</li>
                    </ul>
                  </details>
                  <p>La liste Ligue détaille 29 variantes Play! Pokémon : 12 promos non holo et 17 promos holo/cosmos/ultra. Les 185 et 186 restent hors périmètre français, et la 193 Jumbo est exclue. La Collection Tournoi Premium Lilie comprend aussi trois Perle de Lilie : ce sont des impressions holo cosmos JTG de la 151/159, déjà comptées comme une seule variante JTG, pas des cartes SVP.</p>

                  <p id="ev09-staff"><strong>Versions Staff — quatre variantes incluses dans le maximum de 386 cartes :</strong></p>
                  <ul>
                    <li>SVP 181 · Darumacho de N</li>
                    <li>SVP 182 · Fulgulairo de Mashynn</li>
                    <li>SVP 183 · Rubombelle de Lilie</li>
                    <li>SVP 184 · Ronflex de Nabil</li>
                  </ul>
                </details>}
              </th>
              <td data-label="Full Set">{row.stats?.sourceCode === 'EV09' ? <a className={styles.tierCountLink} href="#ev09-full-set" onClick={() => { const details = document.getElementById('ev09-breakdown'); if (details) details.open = true }}>{showCount(row.stats?.fullSet)}</a> : showCount(row.stats?.fullSet)}</td>
              <td data-label="Master Set">{row.stats?.sourceCode === 'EV09' ? <a className={styles.tierCountLink} href="#ev09-master-set" onClick={() => { const details = document.getElementById('ev09-breakdown'); if (details) details.open = true }}>{showCount(row.stats?.masterSet)}</a> : showCount(row.stats?.masterSet)}</td>
              <td data-label="Ultra Master Set">{row.stats?.sourceCode === 'EV09' ? <a className={styles.tierCountLink} href="#ev09-staff" onClick={() => { const details = document.getElementById('ev09-breakdown'); if (details) details.open = true }}>{showCount(row.stats?.ultraMasterSet)}</a> : showCount(row.stats?.ultraMasterSet)}</td>
              <td data-label="Promos SVP">{row.stats?.sourceCode === 'EV09' ? <a className={styles.tierCountLink} href="#ev09-promos" aria-label="Afficher les 13 impressions portant le symbole SVP, dont quatre Staff déjà comptées" onClick={() => { const details = document.getElementById('ev09-breakdown'); if (details) details.open = true }}>13</a> : '—'}</td>
              <td data-label="Catalogue"><a className={styles.catalogLink} href={'/catalogue/cartes?set=' + encodeURIComponent(row.id)}>Voir les cartes</a></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

      {!loading && !error && !visibleRows.length && <p className={styles.message}>Aucune série ne correspond à cette recherche.</p>}
    </main>
  )
}
