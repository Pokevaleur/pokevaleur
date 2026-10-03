import catalog from '../../../lib/ev9-preview.json'
import styles from './preview.module.css'

export const metadata = {
  title: 'Aperçu EV9 — PokéValeur',
  robots: { index: false, follow: false }
}

const groupLabels = {
  main: 'Principale',
  promo: 'Promo SVP',
  stamp: 'Stamp'
}

const filters = [
  ['main', 'Cartes et variantes principales'],
  ['promos', 'Promos SVP'],
  ['stamps', 'Versions tamponnées'],
  ['all', 'Tout afficher']
]

export default function Ev9PreviewPage({ searchParams = {} }) {
  const requestedGroup = Array.isArray(searchParams.group) ? searchParams.group[0] : searchParams.group
  const requestedQuery = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q
  const hasQuery = Boolean((requestedQuery || '').trim())
  const group = hasQuery && (!requestedGroup || requestedGroup === 'main')
    ? 'all'
    : filters.some(([key]) => key === requestedGroup) ? requestedGroup : 'main'
  const query = (requestedQuery || '').trim().toLocaleLowerCase('fr')
  const targetGroup = group === 'all' ? null : group === 'promos' ? 'promo' : group === 'stamps' ? 'stamp' : 'main'

  const visibleCards = catalog.map(card => ({
    ...card,
    visibleVariants: card.variants.filter(variant => !targetGroup || variant.checklist_group === targetGroup)
  })).filter(card => card.visibleVariants.length > 0)
    .filter(card => !query || (card.collector_number + ' ' + card.card_name).toLocaleLowerCase('fr').includes(query))

  const variantCount = visibleCards.reduce((total, card) => total + card.visibleVariants.length, 0)

  return (
    <main className={styles.page}>
      <div className={styles.topLine}>
        <a href="/">← PokéValeur</a>
        <span className={styles.badge}>Aperçu · lecture seule</span>
      </div>

      <header className={styles.header}>
        <p className={styles.kicker}>Écarlate et Violet · EV09</p>
        <h1>Aventures Ensemble</h1>
        <p>Parcours les cartes, les variantes, les stamps et les promos dans cet aperçu sans connexion. Rien ne sera ajouté à ta collection.</p>
      </header>

      <div className={styles.summary}>
        <span><strong>{visibleCards.length}</strong> cartes affichées</span>
        <span><strong>{variantCount}</strong> variantes dans ce filtre</span>
        <span>Compteur officiel du set : <strong>159</strong></span>
      </div>

      <form className={styles.filters} action="/apercu/ev9" method="get">
        <label>
          Rechercher par nom ou numéro
          <input type="search" name="q" defaultValue={requestedQuery || ''} placeholder="Ex. 190/159 ou Zorua de N" />
        </label>
        <label>
          Que veux-tu afficher ?
          <select name="group" defaultValue={group}>
            {filters.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <button type="submit">Afficher</button>
        <a className={styles.clear} href="/apercu/ev9">Effacer</a>
      </form>

      {hasQuery && <p className={styles.note} role="status">Recherche étendue aux cartes principales, aux promos et aux versions tamponnées.</p>}
      <p className={styles.note}>Aperçu fixe issu de la base de test du 3 octobre 2026. Les variantes tampons peuvent inclure des versions d’autres marchés ; leur périmètre français reste à confirmer.</p>

      <section className={styles.grid} aria-label="Checklist EV9 en lecture seule">
        {visibleCards.map(card => (
          <article className={styles.card} key={card.collector_number}>
            <div className={styles.cardTop}>
              {card.image_url ? <img className={styles.art} src={card.image_url} alt={'Illustration de ' + card.card_name} loading="lazy" /> : <div className={styles.art} aria-label="Image indisponible" />}
              <div>
                <span className={styles.number}>{card.collector_number}</span>
                <h2>{card.card_name}</h2>
                <p className={styles.category}>{card.guide_category_label || 'Catégorie à préciser'}</p>
              </div>
            </div>
            <div className={styles.variants}>
              {card.visibleVariants.map((variant, index) => {
                const variantGroup = variant.checklist_group
                const groupClass = variantGroup === 'promo' ? styles.groupPromo : variantGroup === 'stamp' ? styles.groupStamp : ''
                return (
                  <div className={styles.variant} key={variant.variant_label + index}>
                    <span>{variant.variant_label}</span>
                    <span className={styles.group + ' ' + groupClass}>{groupLabels[variantGroup] || variantGroup}</span>
                  </div>
                )
              })}
            </div>
            {(() => {
              const productSources = card.product_sources?.length
                ? card.product_sources
                : card.visibleVariants.some(variant => variant.checklist_group === 'main')
                  ? [{
                    product_name: 'Boosters Écarlate et Violet – Aventures Ensemble (EV09)',
                    market: 'France',
                    source_label: 'Carte du set EV9',
                    note: 'Le contenu des boosters est aléatoire ; cette indication ne garantit pas la carte.'
                  }]
                  : []
              return productSources.length > 0 && (
                <section className={styles.sources} aria-label={'Produits associés à ' + card.card_name}>
                  <h3>Où la trouver ?</h3>
                  {productSources.map((source, index) => (
                    <div className={styles.source} key={source.product_name + index}>
                      <strong>{source.product_name}</strong>
                      <span>{source.market}</span>
                      {source.note && <p>{source.note}</p>}
                      <small>{source.source_label}</small>
                    </div>
                  ))}
                </section>
              )
            })()}
          </article>
        ))}
        {!visibleCards.length && <p>Aucune carte ne correspond à cette recherche.</p>}
      </section>

      <p className={styles.note}>Cette page ne lit ni ne modifie les comptes ou les collections des membres.</p>
    </main>
  )
}