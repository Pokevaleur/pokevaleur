import styles from './guide.module.css'
import { createPublicServerClient } from '../../lib/supabase-public-server'
import { supabaseUrl } from '../../lib/supabase-config'
import { defaultGuideGlossary, defaultGuideTopics } from '../../lib/guide-content'
import GuideControls from './guide-controls'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Guide du collectionneur Pokémon',
  description: 'Questions, réponses et lexique pour comprendre les cartes Pokémon, boosters, produits scellés, protections, collections et cartes gradées.',
  alternates: { canonical: '/guide' },
  openGraph: {
    title: 'Le Guide PokéValeur – comprendre sa collection Pokémon',
    description: 'Un guide simple pour débuter, reconnaître les cartes et comprendre les produits Pokémon.',
    url: 'https://www.pokevaleur.fr/guide'
  }
}

async function loadGuide() {
  try {
    const supabase = createPublicServerClient()
    const [{ data: topicRows, error: topicError }, { data: questionRows, error: questionError }, { data: glossaryRows, error: glossaryError }] = await Promise.all([
      supabase.from('guide_topics').select('*').eq('is_published', true).order('sort_order').order('id'),
      supabase.from('guide_questions').select('*').eq('is_published', true).order('sort_order').order('id'),
      supabase.from('guide_glossary').select('*').eq('is_published', true).order('sort_order').order('term')
    ])
    if (topicError || questionError || glossaryError || !topicRows?.length) throw new Error('Guide content is not available yet')
    const questionsByTopic = new Map()
    for (const question of questionRows || []) {
      const list = questionsByTopic.get(question.topic_id) || []
      list.push(question)
      questionsByTopic.set(question.topic_id, list)
    }
    return {
      topics: topicRows.map(topic => ({ ...topic, questions: questionsByTopic.get(topic.id) || [] })),
      glossary: glossaryRows || []
    }
  } catch {
    return { topics: defaultGuideTopics, glossary: defaultGuideGlossary }
  }
}

function GuideImage({ path, alt }) {
  if (!path) return null
  const imageSrc = path.startsWith('site:') ? path.slice(5) : `${supabaseUrl}/storage/v1/object/public/guide-illustrations/${path.split('/').map(encodeURIComponent).join('/')}`
  return <figure className={styles.illustration}><img src={imageSrc} alt={alt || ''} loading="lazy" />{alt && <figcaption>{alt}</figcaption>}</figure>
}

export default async function GuidePage() {
  const { topics, glossary } = await loadGuide()
  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">›</span><span>Guide PokéValeur</span></nav>
    <GuideControls />
    <header className={styles.hero} data-guide-hero>
      <span className={styles.kicker}>Le guide du collectionneur</span>
      <h1>Comprendre ta collection Pokémon, à ton rythme</h1>
      <p>Des repères simples, des réponses aux questions fréquentes et un lexique pour mieux connaître les cartes, les boosters et les produits scellés.</p>
      <a className={styles.primaryLink} href="#bien-debuter">Je débute, par où commencer ? <span aria-hidden="true">↓</span></a>
      <a className={styles.secondaryLink} href="#lexique">Voir le lexique</a>
    </header>

    <section className={styles.topicIndex} data-guide-topic-index aria-labelledby="topic-index-title">
      <div className={styles.sectionHeading}><span className={styles.kicker}>Explorer le guide</span><h2 id="topic-index-title">Choisis un thème</h2><p>Chaque réponse s’ouvre au clic. Les sujets pourront être complétés au fil du temps.</p></div>
      <div className={styles.topicGrid}>{topics.map(topic => <a key={topic.id} href={'#' + topic.id} data-guide-topic-link={topic.id}><span>{topic.number}</span><strong>{topic.title}</strong><b aria-hidden="true">↗</b></a>)}</div>
    </section>

    <div className={styles.topicList} data-guide-topic-list>
      {topics.map(topic => <section key={topic.id} id={topic.id} className={styles.topic} data-guide-topic aria-labelledby={topic.id + '-title'}>
        <div className={styles.topicIntro} data-guide-topic-heading><span className={styles.topicNumber}>{topic.number}</span><div><h2 id={topic.id + '-title'}>{topic.title}</h2><p>{topic.intro}</p></div></div>
        <div className={styles.questions}>{topic.questions.map((item, index) => <details id={item.id} className={styles.question} data-guide-question key={item.id || item.question} open={topic.id === 'bien-debuter' && index === 0}>
          <summary>{item.question}<span aria-hidden="true" /></summary>
          <div className={styles.answer}><p>{item.answer}</p>
            <GuideImage path={item.image_path} alt={item.image_alt} />
            {item.source_url && <p className={styles.source}>Source officielle : <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_label || item.source_url}</a>.</p>}
          </div>
        </details>)}</div>
        <a className={styles.backToTop} href="#topic-index-title">Retour aux thèmes ↑</a>
      </section>)}
    </div>

    <p className={styles.noResults} data-guide-no-results hidden>Aucun thème, question ou terme du lexique ne correspond à cette recherche.</p>

    <section className={styles.glossary} data-guide-glossary id="lexique" aria-labelledby="glossary-title">
      <div className={styles.sectionHeading}><span className={styles.kicker}>Les mots de la collection</span><h2 id="glossary-title">Petit lexique</h2><p>Une définition rapide, avec un lien vers le thème pour approfondir.</p></div>
      <dl>{glossary.map(item => <div id={`lexique-${item.id}`} key={item.id || item.term} data-guide-glossary-entry><dt>{item.term}</dt><dd><p>{item.definition}</p><GuideImage path={item.image_path} alt={item.image_alt} />{item.topic_id && <a href={'#' + item.topic_id}>Voir le thème <span aria-hidden="true">→</span></a>}</dd></div>)}</dl>
    </section>

    <aside className={styles.note} data-guide-note><strong>Un guide qui grandit avec les collectionneurs</strong><p>Les contenus et appellations peuvent varier selon la série, la langue et l’époque. Pour un produit précis, vérifie toujours les informations imprimées sur l’emballage et la fiche officielle correspondante.</p><a href="mailto:contact@pokevaleur.fr?subject=Suggestion%20pour%20le%20Guide%20Pok%C3%A9Valeur">Proposer une question au guide →</a></aside>
  </main>
}
