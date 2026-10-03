'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import styles from './cards.module.css'

function imageUrl(card) {
  const localId = card.image_source_url?.split('/').pop()
  if (!localId) return ''
  return 'https://assets.tcgdex.net/fr/me/me02.5/' + encodeURIComponent(localId) + '/low.webp'
}

export default function CardChecklistPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState(requestedSetId)
  const [cards, setCards] = useState([])
  const [owned, setOwned] = useState({})
  const [companies, setCompanies] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [showStamps, setShowStamps] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyVariant, setBusyVariant] = useState('')
  const [gradingVariant, setGradingVariant] = useState('')
  const [savingGrade, setSavingGrade] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const requestedSetId = new URLSearchParams(window.location.search).get('set') || ''
      setLoading(true)
      const { data: { user: signedInUser }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !signedInUser) {
        window.location.replace('/login?next=%2Fcollection%2Fcartes')
        return
      }
      setUser(signedInUser)

      const { data: identity, error: identityError } = await supabase.from('profiles')
        .select('is_admin').eq('id', signedInUser.id).maybeSingle()
      if (cancelled) return
      const admin = !identityError && identity?.is_admin === true
      setIsAdmin(admin)

      const { data: profileRows, error: profileError } = await supabase.from('collection_profiles')
        .select('id,display_name,is_default,profile_type').order('created_at')
      if (profileError) throw profileError
      if (cancelled) return
      const savedProfileId = window.localStorage.getItem('pokevaleur-collection:' + signedInUser.id)
      const activeProfile = (profileRows || []).find(row => row.id === savedProfileId)
        || (profileRows || []).find(row => row.is_default)
        || (profileRows || [])[0]
      setProfiles(profileRows || [])
      if (activeProfile) {
        setProfileId(activeProfile.id)
        window.localStorage.setItem('pokevaleur-collection:' + signedInUser.id, activeProfile.id)
      }

      const { data: setRows, error: setError } = await supabase.from('card_sets')
        .select('id,set_name,set_code,language,advertised_card_count,checklist_scope_note,is_public,release_date')
        .order('release_date', { ascending: false })
      if (setError) throw setError
      if (cancelled) return
      const availableSets = setRows || []
      setSets(availableSets)
      const selected = availableSets.find(row => row.id === requestedSetId) || availableSets[0]
      if (selected) setSetId(selected.id)

      const { data: companyRows, error: companyError } = await supabase.from('card_grading_companies')
        .select('id,company_name,abbreviation').eq('is_active', true).order('company_name')
      if (companyError) throw companyError
      if (!cancelled) setCompanies(companyRows || [])
    }
    initialize().catch(loadError => { if (!cancelled) setError(loadError.message || 'Impossible de charger la checklist.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (!setId || !profileId) return
    let cancelled = false
    async function loadChecklist() {
      setCardsLoading(true)
      setError('')
      setNotice('')
      setCards([])
      setOwned({})
      const { data: cardRows, error: cardError } = await supabase.from('cards')
        .select('id,collector_number,card_name,card_type,guide_category_label,guide_category_code,mechanic_label,image_source_url,guide_order,card_print_variants(id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target)')
        .eq('card_set_id', setId).order('guide_order', { ascending: true })
      if (cardError) throw cardError
      if (cancelled) return
      const { data: copyRows, error: copyError } = await supabase.from('collection_cards')
        .select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)')
        .eq('collection_profile_id', profileId)
      if (copyError) throw copyError
      if (cancelled) return
      const ownership = {}
      for (const copy of copyRows || []) {
        if (!ownership[copy.card_print_variant_id]) ownership[copy.card_print_variant_id] = []
        ownership[copy.card_print_variant_id].push(copy)
      }
      setCards(cardRows || [])
      setOwned(ownership)
    }
    loadChecklist().catch(loadError => { if (!cancelled) setError(loadError.message || 'Impossible de charger les cartes.') })
      .finally(() => { if (!cancelled) setCardsLoading(false) })
    return () => { cancelled = true }
  }, [supabase, setId, profileId])

  const selectedSet = sets.find(row => row.id === setId)
  const categories = useMemo(() => [...new Set(cards.map(card => card.guide_category_label).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [cards])
  const visibleCards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr')
    return cards.filter(card => {
      const matchesQuery = !normalized || (card.collector_number + ' ' + card.card_name).toLocaleLowerCase('fr').includes(normalized)
      const matchesCategory = !category || card.guide_category_label === category
      return matchesQuery && matchesCategory
    })
  }, [cards, query, category])

  const targetVariants = cards.flatMap(card => (card.card_print_variants || [])
    .filter(variant => variant.is_master_set_target && (showStamps || variant.checklist_group === 'main')))
  const ownedTargetCount = targetVariants.filter(variant => (owned[variant.id] || []).length > 0).length
  const completedCardCount = cards.filter(card => {
    const targets = (card.card_print_variants || []).filter(variant => variant.is_master_set_target && (showStamps || variant.checklist_group === 'main'))
    return targets.length > 0 && targets.every(variant => (owned[variant.id] || []).length > 0)
  }).length
  const completion = targetVariants.length ? Math.round(ownedTargetCount * 100 / targetVariants.length) : 0

  function selectSet(nextSetId) {
    setSetId(nextSetId)
    const url = new URL(window.location.href)
    url.searchParams.set('set', nextSetId)
    window.history.replaceState({}, '', url)
  }

  function selectProfile(nextProfileId) {
    setProfileId(nextProfileId)
    if (user) window.localStorage.setItem('pokevaleur-collection:' + user.id, nextProfileId)
  }

  async function toggleRaw(variant) {
    const copies = owned[variant.id] || []
    const rawCopies = copies.filter(copy => copy.ownership_type === 'raw')
    setBusyVariant(variant.id)
    setNotice('')
    try {
      if (rawCopies.length) {
        const { error: deleteError } = await supabase.from('collection_cards').delete().eq('id', rawCopies[rawCopies.length - 1].id)
        if (deleteError) throw deleteError
        setOwned(current => ({ ...current, [variant.id]: (current[variant.id] || []).filter(copy => copy.id !== rawCopies[rawCopies.length - 1].id) }))
        setNotice(rawCopies.length > 1 ? 'Un exemplaire retiré ; les autres restent dans la collection.' : 'Carte retirée de la collection.')
      } else {
        const { data, error: insertError } = await supabase.from('collection_cards').insert({
          user_id: user.id,
          collection_profile_id: profileId,
          card_print_variant_id: variant.id,
          ownership_type: 'raw'
        }).select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)').single()
        if (insertError) throw insertError
        setOwned(current => ({ ...current, [variant.id]: [...(current[variant.id] || []), data] }))
        setNotice('Exemplaire ajouté à la collection.')
      }
    } catch (saveError) {
      setNotice('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setBusyVariant('')
    }
  }

  async function addGradedCopy(event, variant) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const companyId = formData.get('grading_company_id')
    const gradeValue = Number(formData.get('grade'))
    if (!companyId || gradeValue < 1 || gradeValue > 10) {
      setNotice('Choisis une société et une note entre 1 et 10.')
      return
    }
    setSavingGrade(true)
    setNotice('')
    try {
      const { data, error: insertError } = await supabase.from('collection_cards').insert({
        user_id: user.id,
        collection_profile_id: profileId,
        card_print_variant_id: variant.id,
        ownership_type: 'graded',
        grading_company_id: companyId,
        grade: gradeValue,
        grade_label: String(gradeValue) + '/10',
        certification_number: String(formData.get('certification_number') || '').trim() || null,
        current_value_override: formData.get('current_value_override') ? Number(formData.get('current_value_override')) : null
      }).select('id,card_print_variant_id,ownership_type,grade,grade_label,certification_number,grading_company_id,card_grading_companies(company_name,abbreviation)').single()
      if (insertError) throw insertError
      setOwned(current => ({ ...current, [variant.id]: [...(current[variant.id] || []), data] }))
      setGradingVariant('')
      setNotice('Carte gradée ajoutée à la collection.')
    } catch (saveError) {
      setNotice('Enregistrement impossible : ' + (saveError.message || 'réessaie.'))
    } finally {
      setSavingGrade(false)
    }
  }

  async function removeGradedCopy(variantId, copy) {
    if (!window.confirm('Retirer cet exemplaire gradé de la collection ?')) return
    const { error: deleteError } = await supabase.from('collection_cards').delete().eq('id', copy.id)
    if (deleteError) {
      setNotice('Suppression impossible : ' + deleteError.message)
      return
    }
    setOwned(current => ({ ...current, [variantId]: (current[variantId] || []).filter(entry => entry.id !== copy.id) }))
    setNotice('Exemplaire gradé retiré.')
  }

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement de la collection de cartes…</p></main>

  return (
    <main className={styles.page}>
      <div className={styles.topLine}>
        <a className={styles.backLink} href="/collection">← Ma collection</a>
        <span className={styles.privateBadge}>Espace membre</span>
      </div>
      <header className={styles.header}>
        <p className={styles.kicker}>Checklist de série</p>
        <h1>Cartes &amp; Master Set</h1>
        <p>Retrouve les cartes par numéro, rareté et finition. Les exemplaires bruts et gradés restent séparés.</p>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.controls} aria-label="Sélection de la série et du profil">
        <label>
          Série
          <select value={setId} onChange={event => selectSet(event.target.value)} disabled={!sets.length}>
            {!sets.length && <option value="">Aucune série disponible</option>}
            {sets.map(set => <option key={set.id} value={set.id}>{set.set_name}{set.is_public ? '' : ' · brouillon privé'}</option>)}
          </select>
        </label>
        <label>
          Profil de collection
          <select value={profileId} onChange={event => selectProfile(event.target.value)} disabled={!profiles.length}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || (profile.profile_type === 'adult' ? 'Ma collection' : 'Collection familiale')}</option>)}
          </select>
        </label>
        {isAdmin && selectedSet && !selectedSet.is_public && <p className={styles.adminNote}>Série privée : visible ici pour la vérification administrateur uniquement.</p>}
      </section>

      {!sets.length && !error && <p className={styles.empty}>Aucune série de cartes n’est publiée pour le moment.</p>}
      {selectedSet && (
        <>
          <section className={styles.progressCard} aria-label="Progression du Master Set">
            <div className={styles.progressHeading}>
              <div><strong>{ownedTargetCount} / {targetVariants.length}</strong><span>variantes du checklist possédées</span></div>
              <div><strong>{completedCardCount} / {cards.length}</strong><span>cartes complétées</span></div>
              <strong className={styles.percent}>{completion}%</strong>
            </div>
            <div className={styles.progressTrack} role="progressbar" aria-valuenow={completion} aria-valuemin="0" aria-valuemax="100" aria-label="Progression de la checklist">
              <span style={{ width: completion + '%' }} />
            </div>
            <p className={styles.scope}>{selectedSet.checklist_scope_note}</p>
          </section>

          <section className={styles.filters} aria-label="Filtres de la checklist">
            <label className={styles.searchLabel}>
              Rechercher une carte
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Numéro ou nom…" />
            </label>
            <label>
              Catégorie du guide
              <select value={category} onChange={event => setCategory(event.target.value)}>
                <option value="">Toutes les catégories</option>
                {categories.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className={styles.stampToggle}>
              <input type="checkbox" checked={showStamps} onChange={event => setShowStamps(event.target.checked)} />
              Inclure les versions tamponnées
            </label>
          </section>

          {cardsLoading ? <p className={styles.status}>Chargement des cartes…</p> : (
            <section className={styles.cardGrid} aria-label="Cartes de la série">
              {visibleCards.map(card => {
                const cardVariants = (card.card_print_variants || []).filter(variant => variant.is_master_set_target && (showStamps || variant.checklist_group === 'main'))
                return (
                  <article className={styles.card} key={card.id}>
                    <div className={styles.cardTop}>
                      <div className={styles.artFrame}>
                        <img src={imageUrl(card)} alt={'Illustration de ' + card.card_name} loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} />
                        <span>{card.card_type || 'Carte Pokémon'}</span>
                      </div>
                      <div className={styles.cardHeading}>
                        <span className={styles.number}>{card.collector_number}</span>
                        <h2>{card.card_name}</h2>
                        <p className={styles.rarity}>{card.guide_category_label || card.guide_category_code || 'Catégorie à préciser'}</p>
                        {card.mechanic_label && <small>{card.mechanic_label}</small>}
                      </div>
                    </div>
                    <div className={styles.variantList}>
                      {cardVariants.map(variant => {
                        const copies = owned[variant.id] || []
                        const rawCopies = copies.filter(copy => copy.ownership_type === 'raw')
                        const gradedCopies = copies.filter(copy => copy.ownership_type === 'graded')
                        return (
                          <div className={styles.variant} key={variant.id}>
                            <div className={styles.variantName}>
                              <span>{variant.variant_label}</span>
                              {variant.checklist_group === 'stamp' && <small>Tampon</small>}
                            </div>
                            <label className={styles.checkboxLine}>
                              <input type="checkbox" checked={rawCopies.length > 0} disabled={busyVariant === variant.id || cardsLoading} onChange={() => toggleRaw(variant)} />
                              <span>Brute · {rawCopies.length}</span>
                            </label>
                            {rawCopies.length > 1 && <small className={styles.copyCount}>{rawCopies.length} exemplaires bruts</small>}
                            <div className={styles.gradedSection}>
                              <div className={styles.gradedHeading}><span>Gradées · {gradedCopies.length}</span><button type="button" onClick={() => setGradingVariant(gradingVariant === variant.id ? '' : variant.id)}>+ Ajouter</button></div>
                              {gradedCopies.map(copy => (
                                <div className={styles.gradedCopy} key={copy.id}>
                                  <span>{copy.card_grading_companies?.abbreviation || copy.card_grading_companies?.company_name || 'Société'} {copy.grade_label || copy.grade}</span>
                                  {copy.certification_number && <small>Cert. {copy.certification_number}</small>}
                                  <button type="button" aria-label="Retirer cet exemplaire gradé" onClick={() => removeGradedCopy(variant.id, copy)}>×</button>
                                </div>
                              ))}
                              {gradingVariant === variant.id && (
                                <form className={styles.gradeForm} onSubmit={event => addGradedCopy(event, variant)}>
                                  <label>Société
                                    <select name="grading_company_id" required defaultValue="">
                                      <option value="" disabled>Choisir…</option>
                                      {companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}
                                    </select>
                                  </label>
                                  <label>Note
                                    <select name="grade" defaultValue="10">
                                      {Array.from({ length: 10 }, (_, index) => 10 - index).map(value => <option key={value} value={value}>{value}/10</option>)}
                                    </select>
                                  </label>
                                  <label>Certification (facultatif)<input name="certification_number" maxLength="80" /></label>
                                  <label>Valeur personnelle (€)<input name="current_value_override" type="number" min="0" step="0.01" /></label>
                                  {!companies.length && <small>Les sociétés de gradation seront disponibles après leur ajout au référentiel.</small>}
                                  <button type="submit" disabled={savingGrade || !companies.length}>{savingGrade ? 'Enregistrement…' : 'Enregistrer la gradée'}</button>
                                </form>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
              {!visibleCards.length && <p className={styles.empty}>Aucune carte ne correspond à cette recherche.</p>}
            </section>
          )}
        </>
      )}
    </main>
  )
}
