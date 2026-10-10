'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import styles from './binders.module.css'

function shortCode(set) {
  const code = String(set?.set_code || '').trim().toUpperCase()
  const match = code.match(/^(?:SWSH|EB|SV|EV|ME|SM|SL|XY|BW|DP|PL|HGSS)[\s-]*(\d+(?:\.\d+)?)([A-Z]*)$/)
  if (match) {
    const prefix = /^(?:SWSH|EB)/.test(code) ? 'EB' : /^(?:SV|EV|ME)/.test(code) ? 'EV' : (code.match(/^[A-Z]+/) || [''])[0]
    return prefix + Number(match[1]) + match[2]
  }
  return code || 'SÉRIE'
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
}


const GENERATED_COVER_ALIASES = [["mascarade crepusculaire","mascarade-crepusculaire"],["evolutions prismatiques","evolutions-prismatiques"],["ecarlate et violet 151","ecarlate-violet-151"],["etincelles deferlantes","etincelles-deferlantes"],["alliance infaillible","alliance-infaillible"],["harmonie des esprits","harmonie-des-esprits"],["flammes obsidiennes","flammes-obsidiennes"],["destinees radieuses","destinees-radieuses"],["evolutions a paldea","evolution-a-paldea"],["rivalites destinees","rivalites-destinees"],["gardiens ascendants","gardiens-ascendants"],["evolutions celestes","evolutions-celestes"],["majeste des dragons","majeste-des-dragons"],["heros transcendants","heros-transcendants"],["forces temporelles","forces-temporelles"],["couronne stellaire","couronne-stellaire"],["evolution a paldea","evolution-a-paldea"],["stars etincelantes","stars-etincelantes"],["tenebres embrasees","tenebres-embrasees"],["aventures ensemble","aventures-ensemble"],["clash des rebelles","clash-des-rebelles"],["lumiere interdite","lumiere-interdite"],["vigueur spectrale","vigueur-spectrale"],["origines antiques","origines-antiques"],["tempete argentee","tempete-argentee"],["voltage eclatant","voltage-eclatant"],["offensive vapeur","offensive-vapeur"],["eclipse cosmique","eclipse-cosmique"],["epee et bouclier","epee-et-bouclier"],["styles de combat","styles-de-combat"],["faille paradoxe","faille-paradoxe"],["tempete celeste","tempete-celeste"],["poing de fusion","poing-de-fusion"],["ombres ardentes","ombres-ardentes"],["impulsion turbo","impulsion-turbo"],["invasion carmin","invasion-carmin"],["fable nebuleuse","fable-nebuleuse"],["astres radieux","astres-radieux"],["origine perdue","origine-perdue"],["tonnerre perdu","tonnerre-perdu"],["voie du maitre","voie-du-maitre"],["flamme blanche","flamme-blanche"],["regne de glace","regne-de-glace"],["soleil et lune","soleil-et-lune"],["poings furieux","poings-furieux"],["ciel rugissant","ciel-rugissant"],["mega evolution","mega-evolution"],["zenith supreme","zenith-supreme-variante"],["rupture turbo","rupture-turbo"],["foudre noire","foudre-noire"],["celebrations","celebrations"],["ultra prisme","ultra-prisme"],["duo de choc","duo-de-choc"],["generations","generations"],["pokemon go","pokemon-go"],["primo choc","primo-choc"],["etincelles","etincelles-xy"],["evolutions","evolutions-xy"],["151","ecarlate-violet-151"],["xy","xy"]]

function generatedCoverFor(set) {
  const name = normalize(set?.set_name).replace(/[^a-z0-9]+/g, ' ').trim()
  const code = shortCode(set)
  if (name === 'ecarlate et violet' || code === 'EV1') return '/binder-covers/ecarlate-et-violet.webp'
  if (name === 'xy' || code === 'XY1') return '/binder-covers/xy.webp'
  const match = GENERATED_COVER_ALIASES.find(([alias]) => name.includes(alias))
  return match ? '/binder-covers/' + match[1] + '.webp' : ''
}

function colorFor(value) {
  const colors = [['#6d5bd0', '#b4a6ff'], ['#c45d57', '#efb39b'], ['#258b83', '#a5dfd4'], ['#4275bb', '#a4c8f0'], ['#b17a28', '#ead18d'], ['#ac5c9a', '#e4acd5']]
  const hash = Array.from(String(value || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function imageFor(card) {
  return card?.image_url || card?.image_source_url || ''
}

function BackLink({ href, children = '← Retour' }) {
  return <a className={styles.backLink} href={href}>{children}</a>
}

function BindersContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useSearchParams()
  const requestedSetId = params.get('set') || ''
  const isOpen = params.get('open') === '1'
  const rawPage = Number.parseInt(params.get('page') || '0', 10)
  const [user, setUser] = useState(null)
  const [sets, setSets] = useState([])
  const [showAllBinders, setShowAllBinders] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [ownedCardCounts, setOwnedCardCounts] = useState({})
  const [ownedCopyCount, setOwnedCopyCount] = useState(0)
  const [cards, setCards] = useState([])
  const [variantCopies, setVariantCopies] = useState({})
  const [etbImages, setEtbImages] = useState({})
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadLibrary() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError || !auth?.user) {
          window.location.replace('/login?next=%2Fcollection%2Fclasseurs')
          return
        }
        const signedUser = auth.user
        const { data: profileRows, error: profileError } = await supabase.from('collection_profiles')
          .select('id,display_name,is_default,profile_type').order('created_at')
        if (profileError) throw profileError
        const savedProfile = window.localStorage.getItem('pokevaleur-collection:' + signedUser.id)
        const activeProfile = (profileRows || []).find(row => row.id === savedProfile)
          || (profileRows || []).find(row => row.is_default)
          || (profileRows || [])[0]
        if (!activeProfile) throw new Error('Aucun profil de collection disponible.')
        const { data: setRows, error: setError } = await supabase.from('card_sets')
          .select('id,series_name,set_name,set_code,language,release_date,advertised_card_count,is_public')
          .eq('is_public', true).eq('language', 'FR').order('release_date', { ascending: true }).order('set_name')
        if (setError) throw setError
        if (cancelled) return
        setUser(signedUser)
        setProfiles(profileRows || [])
        setProfileId(activeProfile.id)
        window.localStorage.setItem('pokevaleur-collection:' + signedUser.id, activeProfile.id)
        setSets(setRows || [])

        const { data: copyRows, error: copiesError } = await fetchAllRows(() => supabase.from('collection_cards')
          .select('id,card_print_variant_id').eq('collection_profile_id', activeProfile.id))
        if (copiesError) throw copiesError
        const copies = copyRows || []
        setOwnedCopyCount(copies.length)
        const variantIds = [...new Set(copies.map(copy => copy.card_print_variant_id).filter(Boolean))]
        const variants = []
        for (let offset = 0; offset < variantIds.length; offset += 250) {
          const { data, error: variantError } = await supabase.from('card_print_variants')
            .select('id,card_id').in('id', variantIds.slice(offset, offset + 250))
          if (variantError) throw variantError
          variants.push(...(data || []))
        }
        const cardIds = [...new Set(variants.map(variant => variant.card_id).filter(Boolean))]
        const cardSetById = new Map()
        for (let offset = 0; offset < cardIds.length; offset += 250) {
          const { data, error: cardError } = await supabase.from('cards')
            .select('id,card_set_id').in('id', cardIds.slice(offset, offset + 250))
          if (cardError) throw cardError
          for (const card of data || []) cardSetById.set(card.id, card.card_set_id)
        }
        const setCards = {}
        const variantIdsBySet = {}
        for (const variant of variants) {
          const setId = cardSetById.get(variant.card_id)
          if (!setId) continue
          if (!setCards[setId]) setCards[setId] = new Set()
          setCards[setId].add(variant.card_id)
          if (!variantIdsBySet[setId]) variantIdsBySet[setId] = new Set()
          variantIdsBySet[setId].add(variant.id)
        }
        const counts = {}
        for (const [setId, cardSet] of Object.entries(setCards)) counts[setId] = cardSet.size
        setOwnedCardCounts(counts)

        try {
          const { data: products, error: productsError } = await fetchAllRows(() => supabase.from('products')
            .select('name,series,image_url,image_source_url,product_type').eq('is_public', true)
            .or('product_type.ilike.%etb%,name.ilike.%dresseur%,name.ilike.%trainer box%'))
          if (productsError) throw productsError
          const art = {}
          const ignoredSetWords = new Set(['ecarlate', 'violet', 'pokemon', 'serie', 'et', 'de', 'des', 'du', 'la', 'le', 'les'])
          for (const set of setRows || []) {
            const tokens = normalize(set.set_name).split(/[^a-z0-9]+/).filter(word => word.length > 2 && !ignoredSetWords.has(word))
            const matching = (products || []).find(product => {
              const productName = normalize(product.name)
              const productSeries = normalize(product.series)
              const productType = normalize(product.product_type)
              const isEtb = productType.includes('etb') || productName.includes('coffret dresseur') || productName.includes('elite trainer box')
              const productText = productName + ' ' + productSeries
              return isEtb && tokens.length > 0 && tokens.every(token => productText.includes(token)) && (product.image_url || product.image_source_url)
            })
            const image = matching?.image_url || matching?.image_source_url
            if (image) art[set.id] = image
          }
          if (!cancelled) setEtbImages(art)
        } catch { /* The binder remains usable if no ETB image is indexed. */ }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de charger les classeurs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLibrary()
    return () => { cancelled = true }
  }, [supabase])

  const selectedSet = sets.find(set => set.id === requestedSetId) || null
  const ownedSets = sets.filter(set => (ownedCardCounts[set.id] || 0) > 0)
  const displayedSets = showAllBinders ? sets : ownedSets

  useEffect(() => {
    if (!selectedSet || !profileId) {
      setCards([])
      setVariantCopies({})
      return
    }
    let cancelled = false
    async function loadBinder() {
      setCardsLoading(true)
      setError('')
      try {
        const { data: cardRows, error: cardError } = await supabase.from('cards')
          .select('id,collector_number,card_name,rarity_label,image_url,image_source_url,guide_order,card_print_variants(id,variant_label,variant_key,is_master_set_target)')
          .eq('card_set_id', selectedSet.id).order('guide_order', { ascending: true }).order('collector_number')
        if (cardError) throw cardError
        const variants = (cardRows || []).flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target))
        const ids = variants.map(variant => variant.id)
        let copies = []
        for (let offset = 0; offset < ids.length; offset += 250) {
          const { data, error: copyError } = await supabase.from('collection_cards')
            .select('id,card_print_variant_id,ownership_type,grade_label')
            .eq('collection_profile_id', profileId).in('card_print_variant_id', ids.slice(offset, offset + 250))
          if (copyError) throw copyError
          copies = copies.concat(data || [])
        }
        if (cancelled) return
        const grouped = {}
        for (const copy of copies) grouped[copy.card_print_variant_id] = [...(grouped[copy.card_print_variant_id] || []), copy]
        setCards((cardRows || []).filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target)))
        setVariantCopies(grouped)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de charger ce classeur.')
      } finally {
        if (!cancelled) setCardsLoading(false)
      }
    }
    loadBinder()
    return () => { cancelled = true }
  }, [supabase, selectedSet?.id, profileId])

  const copiesOnSet = useMemo(
    () => cards.reduce((sum, card) => sum + (card.card_print_variants || []).reduce((n, variant) => n + (variantCopies[variant.id] || []).length, 0), 0),
    [cards, variantCopies]
  )
  const ownedOnSet = ownedCardCounts[requestedSetId] || 0
  const setTotal = cards.length || Number(selectedSet?.advertised_card_count || 0)
  const missingOnSet = Math.max(setTotal - ownedOnSet, 0)
  const totalSpreads = Math.max(1, Math.ceil(cards.length / 16))
  const page = Math.max(0, Math.min(Number.isFinite(rawPage) ? rawPage : 0, totalSpreads - 1))
  const pageCards = cards.slice(page * 16, page * 16 + 16)
  const spreadSlots = Array.from({ length: 16 }, (_, index) => pageCards[index] || null)

  function navigate(next) {
    const query = new URLSearchParams()
    const nextSetId = Object.prototype.hasOwnProperty.call(next, 'set') ? next.set : requestedSetId
    if (nextSetId) query.set('set', nextSetId)
    if (next.open) query.set('open', '1')
    if (next.page !== undefined) query.set('page', String(next.page))
    router.push('/collection/classeurs' + (query.size ? '?' + query.toString() : ''))
  }

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement de tes classeurs…</p></main>
  if (!user) return <main className={styles.page}><p className={styles.status}>Redirection vers la connexion…</p></main>

  const libraryMode = !selectedSet
  const [coverStart, coverEnd] = colorFor(selectedSet?.set_code)
  const generatedCoverArt = selectedSet && generatedCoverFor(selectedSet)
  const coverArt = selectedSet && (generatedCoverArt || (shortCode(selectedSet) === 'EV8' ? '/binder-covers/etincelles-deferlantes.svg' : etbImages[selectedSet.id]))
  const profileName = profiles.find(profile => profile.id === profileId)?.display_name
    || (profiles.find(profile => profile.id === profileId)?.profile_type === 'child' ? 'Collection familiale' : 'Ma collection')

  return (
    <main className={styles.page}>
      {libraryMode ? <>
        <div className={styles.topLine}>
          <BackLink href="/collection">← Ma collection</BackLink>
          <span className={styles.eyebrow}>Ta bibliothèque</span>
        </div>
        <header className={styles.header}>
          <p className={styles.kicker}>Ma Collection · Cartes</p>
          <h1>Mes classeurs</h1>
          <p>Un classeur par série. Les tranches en couleur signalent les séries où tu as déjà des cartes.</p>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <section className={styles.librarySummary} aria-label="Résumé de la bibliothèque">
          <strong>{ownedSets.length} classeur{ownedSets.length === 1 ? '' : 's'} avec des cartes</strong><span>{ownedCopyCount} cartes dans {profileName}</span>
        </section>
        {sets.length > ownedSets.length && <div className={styles.libraryControls}>
          <span>{showAllBinders ? 'Toutes les séries du catalogue' : 'Tes séries en cours'}</span>
          <button type="button" className={styles.allBindersButton} onClick={() => setShowAllBinders(value => !value)}>
            {showAllBinders ? 'Masquer les séries sans carte' : 'Voir toutes les séries'}
          </button>
        </div>}
        {displayedSets.length ? <section className={styles.library} aria-label="Bibliothèque des séries">
          {displayedSets.map(set => {
            const [start, end] = colorFor(set.set_code)
            const hasCards = (ownedCardCounts[set.id] || 0) > 0
            return <button key={set.id} type="button" className={hasCards ? styles.spineActive : styles.spine}
              style={{ '--spine-start': start, '--spine-end': end }}
              onClick={() => navigate({ open: false, set: set.id })}
              aria-label={'Ouvrir le classeur ' + set.set_name + ', ' + (ownedCardCounts[set.id] || 0) + ' cartes possédées'}>
              <span className={styles.spineCode}>{shortCode(set)}</span>
              <span className={styles.spineMarker} aria-hidden="true" />
            </button>
          })}
        </section> : <p className={styles.empty}>{sets.length ? 'Tu n’as pas encore de carte dans un classeur.' : 'Aucune série française n’est publiée dans le catalogue.'}</p>}
        {requestedSetId && selectedSet && <p className={styles.notice}>Série sélectionnée : {selectedSet.set_name}</p>}
        <section className={styles.seriesJump} aria-label="Accès à un classeur">
          <label htmlFor="binder-series">Choisir une série</label>
          <select id="binder-series" value={requestedSetId} onChange={event => navigate({ open: false, set: event.target.value })}>
            <option value="">Sélectionner une série</option>
            {sets.map(set => <option key={set.id} value={set.id}>{shortCode(set)} · {set.set_name}</option>)}
          </select>
        </section>
      </> : !isOpen ? <>
        <div className={styles.topLine}>
          <BackLink href="/collection/classeurs" />
          <span className={styles.eyebrow}>{shortCode(selectedSet)}</span>
        </div>
        <section className={styles.coverStage}>
          <div className={styles.coverGlow} style={{ '--cover-start': coverStart, '--cover-end': coverEnd }} />
          {generatedCoverArt ? (
            <img className={styles.generatedProductCover} src={generatedCoverArt} alt={'Classeur ' + selectedSet.set_name} />
          ) : (
          <article className={styles.closedBinder} style={{ '--cover-start': coverStart, '--cover-end': coverEnd }}>
            <div className={styles.binderSpine}><span>{shortCode(selectedSet)}</span></div>
            <div className={styles.coverFace}>
              {coverArt && <img className={styles.coverArtwork} src={coverArt} alt="" />}
              <div className={styles.coverTint} />
              <p className={styles.coverBrand}>POKÉVALEUR · CLASSEUR</p>
              <h1>{selectedSet.set_name}</h1>
              <p className={styles.coverCode}>{shortCode(selectedSet)} · {selectedSet.release_date ? new Date(selectedSet.release_date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Collection'}</p>
            </div>
          </article>
          )}
          <div className={styles.coverDetails}>
            <p className={styles.kicker}>Ton classeur de série</p>
            <h2>{selectedSet.set_name}</h2>
            <div className={styles.stats}>
              <div><strong>{setTotal}</strong><span>cartes au catalogue</span></div>
              <div><strong>{ownedOnSet}</strong><span>cartes possédées</span></div>
              <div><strong>{missingOnSet}</strong><span>emplacements à compléter</span></div>
              <div><strong>{copiesOnSet}</strong><span>exemplaires possédés</span></div>
            </div>
            <button className={styles.openButton} type="button" onClick={() => navigate({ open: true, page: 0 })}>Ouvrir le classeur <span aria-hidden="true">→</span></button>
          </div>
        </section>
      </> : <>
        <div className={styles.topLine}>
          <BackLink href={'/collection/classeurs?set=' + encodeURIComponent(selectedSet.id)} />
          <span className={styles.eyebrow}>{shortCode(selectedSet)}</span>
        </div>
        <header className={styles.openHeader}>
          <div><p className={styles.kicker}>Double page</p><h1>{selectedSet.set_name}</h1></div>
          <p>{ownedOnSet} possédée{ownedOnSet === 1 ? '' : 's'} · {missingOnSet} emplacement{missingOnSet === 1 ? '' : 's'} à compléter</p>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {cardsLoading ? <p className={styles.status}>Chargement des cartes du classeur…</p> : <>
          <section className={styles.spread} aria-label={'Double page ' + (page + 1) + ' sur ' + totalSpreads}>
            {[0, 1].map(side => <section key={side} className={styles.bookPage} aria-label={side === 0 ? 'Page de gauche' : 'Page de droite'}>
              <div className={styles.pageTop}><span>{shortCode(selectedSet)}</span><span>{page * 2 + side + 1}</span></div>
              <div className={styles.cardSlots}>
                {spreadSlots.slice(side * 8, side * 8 + 8).map((card, slotIndex) => {
                  const cardVariants = (card?.card_print_variants || []).filter(variant => variant.is_master_set_target)
                  const copyCount = cardVariants.reduce((count, variant) => count + (variantCopies[variant.id] || []).length, 0)
                  const cardArt = imageFor(card)
                  return <article key={card?.id || 'empty-' + side + '-' + slotIndex} className={card && copyCount ? styles.slotOwned : styles.slot}>
                    {card && copyCount ? <>
                      <div className={styles.thumb}>
                        {cardArt ? <img src={cardArt} alt={'Carte ' + card.card_name} loading="lazy" /> : <span>Illustration absente</span>}
                        {copyCount > 1 && <b className={styles.copyBadge}>×{copyCount}</b>}
                      </div>
                      <strong className={styles.cardName}>{card.card_name}</strong>
                      <span className={styles.cardNumber}>{card.collector_number}</span>
                    </> : <>
                      <span className={styles.emptyNumber}>{card?.collector_number || '—'}</span>
                      <span className={styles.emptyHint}>{card ? 'À compléter' : 'Emplacement libre'}</span>
                    </>}
                  </article>
                })}
              </div>
              <div className={styles.pageFooter}><span>{profileName}</span><span>{page + 1}/{totalSpreads}</span></div>
            </section>)}
          </section>
          <nav className={styles.pageNav} aria-label="Navigation du classeur">
            <button type="button" onClick={() => navigate({ open: true, page: Math.max(page - 1, 0) })} disabled={page === 0} aria-label="Double page précédente">←</button>
            <span>Double page {page + 1} sur {totalSpreads}</span>
            <button type="button" onClick={() => navigate({ open: true, page: Math.min(page + 1, totalSpreads - 1) })} disabled={page >= totalSpreads - 1} aria-label="Double page suivante">→</button>
          </nav>
        </>}
      </>}
    </main>
  )
}


export default function BindersPage() {
  return <Suspense fallback={<main className={styles.page}><p className={styles.status}>Chargement de tes classeurs…</p></main>}><BindersContent /></Suspense>
}
