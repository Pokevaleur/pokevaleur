'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './cards.module.css'

const LANGUAGE_NAMES = {
  FR: 'Français',
  JP: 'Japonais',
  'ZH-CN': 'Chinois simplifié',
  'ZH-TW': 'Chinois traditionnel',
  EN: 'Anglais',
  KO: 'Coréen'
}

function optionLabel(option) {
  const setLabel = [option.baseSetCode, option.baseSetName].filter(Boolean).join(' — ')
  if (option.languageCode === 'FR') return `${setLabel} · Français`
  return `${setLabel} · ${LANGUAGE_NAMES[option.languageCode] || option.languageCode} (${option.foreignSetName})`
}

export default function CardTradesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState('loading')
  const [options, setOptions] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [matches, setMatches] = useState([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setStatus('loading')
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!active) return
      if (authError || !user) {
        setStatus('signed-out')
        return
      }

      const { data: accessData, error: accessError } = await supabase.rpc('get_social_access_status')
      const access = Array.isArray(accessData) ? accessData[0] : accessData
      if (!active) return
      if (accessError || !access?.can_access) {
        setStatus(accessError ? 'error' : 'social-locked')
        return
      }

      const [{ data: sets, error: setsError }, { data: foreignSets, error: foreignError }] = await Promise.all([
        supabase.from('card_sets')
          .select('id,series_name,set_name,set_code,release_date')
          .eq('language', 'FR')
          .eq('is_public', true)
          .order('series_name')
          .order('release_date', { ascending: false }),
        supabase.from('foreign_card_sets')
          .select('id,catalog_set_id,language_code,market_code,series_name_fr,set_name,set_code,foreign_card_printings!inner(id)')
          .eq('validation_status', 'verified')
          .eq('foreign_card_printings.validation_status', 'verified')
          .not('catalog_set_id', 'is', null)
          .order('set_name')
      ])
      if (!active) return
      if (setsError || foreignError) {
        setStatus('error')
        return
      }

      const baseSets = sets || []
      const baseById = new Map(baseSets.map(set => [set.id, set]))
      const frOptions = baseSets.map(set => ({
        id: `fr:${set.id}`,
        catalogSetId: set.id,
        languageCode: 'FR',
        marketCode: 'FR',
        foreignSetId: null,
        baseSetCode: set.set_code,
        baseSetName: set.set_name
      }))
      const otherOptions = (foreignSets || [])
        .filter(set => baseById.has(set.catalog_set_id))
        .map(set => {
          const baseSet = baseById.get(set.catalog_set_id)
          return {
            id: `foreign:${set.id}`,
            catalogSetId: set.catalog_set_id,
            languageCode: set.language_code,
            marketCode: set.market_code,
            foreignSetId: set.id,
            foreignSetName: set.set_name,
            baseSetCode: baseSet.set_code,
            baseSetName: set.series_name_fr || baseSet.set_name
          }
        })
      const nextOptions = [...frOptions, ...otherOptions]
      setOptions(nextOptions)
      setSelectedId(nextOptions[0]?.id || '')
      setStatus('ready')
    }
    load().catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [supabase])

  async function search(event) {
    event.preventDefault()
    const selected = options.find(option => option.id === selectedId)
    if (!selected || searching) return
    setSearching(true)
    setMatches([])
    setMessage('')
    const { data, error } = await supabase.rpc('find_card_exchange_matches', {
      p_catalog_set_id: selected.catalogSetId,
      p_language_code: selected.languageCode,
      p_market_code: selected.marketCode,
      p_foreign_set_id: selected.foreignSetId
    })
    if (error) {
      setMessage(error.message || 'La recherche est indisponible pour le moment.')
    } else {
      setMatches(data || [])
      setMessage(data?.length
        ? `${data.length} rapprochement(s) trouvé(s).`
        : 'Aucun membre ne propose actuellement les impressions qui te manquent dans cette série.')
    }
    setSearching(false)
  }

  return (
    <main className="pageContainer" style={{ width: '100%', maxWidth: 900, minWidth: 0, boxSizing: 'border-box', margin: '0 auto', padding: '24px 16px 48px' }}>
      <section style={{ minWidth: 0, padding: 20, borderRadius: 18, background: '#fff', border: '1px solid #dce3ec', boxShadow: '0 8px 24px rgba(20, 35, 55, .06)' }}>
        <p style={{ margin: '0 0 8px', color: '#607086', fontWeight: 700 }}>Trades · Cartes</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(25px, 6vw, 36px)' }}>Trouver mes cartes manquantes</h1>
        <p style={{ color: '#526173', lineHeight: 1.55 }}>
          Choisis une série et une langue. PokéValeur te montre les membres qui proposent automatiquement des doubles de ces impressions et qui en ont au moins un exemplaire.
        </p>
        <p style={{ color: '#526173', lineHeight: 1.55 }}>
          La recherche compare l’impression exacte, y compris la langue et la variante. Elle ne modifie aucune collection et ne déclenche pas l’échange.
        </p>
      </section>

      {status === 'loading' && <p role="status">Chargement…</p>}
      {status === 'signed-out' && (
        <section style={{ marginTop: 16, padding: 18, borderRadius: 16, background: '#f0f4fa' }}>
          <p>Connecte-toi pour chercher les doubles correspondant à tes cartes manquantes.</p>
          <a className="btn" href="/login?next=%2Ftrades%2Fcartes">Se connecter</a>
        </section>
      )}
      {status === 'social-locked' && (
        <section style={{ marginTop: 16, padding: 18, borderRadius: 16, background: '#f0f4fa' }}>
          <p>Les fonctions sociales doivent être activées pour utiliser les rapprochements entre membres.</p>
          <a className="btn" href="/profil">Voir mon profil</a>
        </section>
      )}
      {status === 'error' && <p role="alert" className="message">Impossible de charger le catalogue ou de vérifier ton accès social.</p>}

      {status === 'ready' && (
        <section style={{ minWidth: 0, marginTop: 16, padding: 20, borderRadius: 18, background: '#fff', border: '1px solid #dce3ec' }}>
          {!options.length ? (
            <p>Aucune série avec impressions étrangères vérifiées n’est encore disponible.</p>
          ) : (
            <form onSubmit={search} style={{ display: 'grid', gap: 14, minWidth: 0 }}>
              <label htmlFor="card-trade-series" style={{ display: 'grid', gap: 8, minWidth: 0, fontWeight: 700 }}>
                Série et langue de l’impression recherchée
                <select
                  id="card-trade-series"
                  className={styles.seriesSelect}
                  value={selectedId}
                  onChange={event => setSelectedId(event.target.value)}
                  style={{ display: 'block', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', padding: '12px 38px 12px 12px', border: '1px solid #cbd5e1', borderRadius: 12, backgroundColor: '#fff' }}
                >
                  {options.map(option => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
                </select>
              </label>
              <button className="btn" type="submit" disabled={searching || !selectedId}>
                {searching ? 'Recherche…' : 'Rechercher les doubles'}
              </button>
            </form>
          )}
          {message && <p role="status" aria-live="polite" style={{ color: '#526173', lineHeight: 1.5 }}>{message}</p>}
          {matches.length > 0 && (
            <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
              {matches.map((match, index) => (
                <article key={`${match.card_print_variant_id}-${match.offered_by}-${index}`} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 12, minWidth: 0, padding: 12, border: '1px solid #dce3ec', borderRadius: 14 }}>
                  {match.image_url ? (
                    <img src={match.image_url} alt="" loading="lazy" style={{ display: 'block', width: 72, height: 100, objectFit: 'contain', borderRadius: 8, background: '#f3f5f8' }} />
                  ) : (
                    <div aria-hidden="true" style={{ width: 72, height: 100, borderRadius: 8, background: '#f3f5f8' }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: '0 0 6px', fontSize: 17, overflowWrap: 'anywhere' }}>{match.card_name}</h2>
                    <p style={{ margin: '0 0 6px', color: '#526173', overflowWrap: 'anywhere' }}>
                      {match.set_name} · n° {match.collector_number} · {LANGUAGE_NAMES[match.language_code] || match.language_code}
                    </p>
                    <p style={{ margin: '0 0 6px', color: '#526173', overflowWrap: 'anywhere' }}>{match.variant_label}</p>
                    <p style={{ margin: 0, fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {match.offered_by} · {match.available_copies} double(s) proposé(s)
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
