import styles from './guide.module.css'

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

const topics = [
  {
    id: 'bien-debuter', number: '01', title: 'Bien débuter',
    intro: 'Les premiers repères pour avancer à ton rythme, sans avoir besoin de tout connaître dès le départ.',
    questions: [
      ['Par où commencer une collection Pokémon ?', 'Commence par ce qui te plaît : un Pokémon, une série, une langue, des cartes illustrées ou des produits scellés. Fixe-toi un budget et une façon de collectionner qui te ressemble. Il n’existe pas une seule bonne méthode.'],
      ['Faut-il collectionner toutes les cartes ?', 'Non. Tu peux collectionner quelques cartes favorites, une série, un type de produit, des cartes d’un illustrateur ou un ensemble complet. Définis tes propres limites avant d’acheter.'],
      ['Quelle différence entre collectionner et jouer ?', 'Une carte peut être recherchée pour son illustration, sa rareté ou sa place dans une collection, ou être choisie pour construire un deck de jeu. Certains collectionneurs font les deux.']
    ]
  },
  {
    id: 'cartes', number: '02', title: 'Comprendre les cartes',
    intro: 'Les éléments imprimés sur une carte aident à l’identifier, à comprendre son usage et à décrire son état.',
    questions: [
      ['Quelles informations trouve-t-on sur une carte ?', 'Selon son type, une carte peut afficher un nom, une illustration, des points de vie, un type, des attaques, une capacité ou un effet. Le bas de la carte indique généralement des repères d’édition, comme le numéro dans la série, le symbole de série, l’illustrateur et les mentions de droits. Les cartes Énergie et Dresseur ont une présentation différente des cartes Pokémon.'],
      ['Comment reconnaître la rareté d’une carte ?', 'Le symbole ou la mention de rareté se trouve généralement près du numéro de collection, mais son apparence a changé au fil des séries et des époques. Il faut lire la carte dans son contexte : une rareté ne suffit pas à déterminer son prix.'],
      ['Que veut dire « hit » ?', '« Hit » est un mot de collectionneur pour désigner une carte particulièrement recherchée ou enthousiasmante dans une ouverture. Ce n’est pas une catégorie officielle et son sens dépend des habitudes de chacun.'],
      ['Comment décrire l’état d’une carte ?', 'Regarde séparément les coins, les bords, la surface et le centrage. Une rayure, un pli ou un enfoncement peut compter même si la carte paraît propre de loin. Les appellations comme Near Mint ou Played sont des repères de marché : demande des photos nettes et précise les défauts visibles.'],
      ['Comment repérer une fausse carte ?', 'Compare-la à une carte authentique de la même édition : impression, couleurs, police, symboles, découpe et éventuelle texture. Aucun test isolé ne suffit toujours. Évite les tests destructifs et demande l’avis d’une personne expérimentée si tu as un doute.'],
      ['Qu’est-ce qui fait varier la valeur d’une carte ?', 'La demande, la série, la langue, la rareté, l’état, la version et la provenance peuvent jouer. Pour estimer un prix, compare des ventes récentes réellement conclues pour la même carte et un état comparable ; les annonces encore en ligne sont seulement des prix demandés.']
    ]
  },
  {
    id: 'boosters', number: '03', title: 'Boosters et ouvertures',
    intro: 'Un booster est un paquet de cartes scellé. Son contenu exact dépend de l’extension, de la langue et du produit.',
    questions: [
      ['Combien de cartes contient un booster ?', 'À titre de repère, Pokémon indique pour un booster standard 10 cartes de jeu, ainsi qu’une carte Énergie et une carte à code. Certaines extensions spéciales ont un contenu différent : vérifie toujours la fiche officielle du produit concerné.'],
      ['Pourquoi les visuels des boosters sont-ils différents ?', 'Une extension peut proposer plusieurs illustrations de paquet. Elles servent à distinguer les designs associés au produit ; elles ne garantissent pas un contenu de cartes différent.'],
      ['Qu’est-ce qu’un art set ?', 'Dans le langage des collectionneurs, un art set désigne généralement un exemplaire de chaque illustration de booster d’une extension. Le nombre de visuels peut varier ; vérifie la série concernée.'],
      ['Qu’est-ce qu’un booster loose ?', 'C’est un booster vendu séparément, sans son blister ou sans la boîte d’origine. « Loose » décrit sa présentation, mais ne prouve à lui seul ni son authenticité ni son historique.'],
      ['Booster léger ou lourd : peut-on connaître les cartes ?', 'Le poids n’est pas une méthode fiable pour savoir quelles cartes se trouvent dans un paquet. Les matériaux, les séries et les contrôles de fabrication varient. N’achète pas un booster sur la promesse qu’un poids garantit une carte précise.'],
      ['Que signifie NPNT ?', 'NPNT est un sigle de jargon dont le sens peut varier selon les vendeurs et les communautés. Demande sa signification exacte et ce qu’elle garantit dans l’annonce ; ce n’est pas une mention officielle du fabricant.'],
      ['Que vérifier sur le scellage d’un booster ?', 'Observe les soudures, les bords, les déchirures, les traces de colle et la cohérence générale de l’emballage. Une photo ne permet pas toujours de conclure : en cas de doute, privilégie un vendeur identifiable et une protection d’achat.'],
      ['Qu’est-ce qu’un box break ?', 'Un vendeur ouvre une boîte en direct et répartit les boosters ou les cartes selon les règles annoncées aux acheteurs. Avant de participer, vérifie ce que tu achètes, comment les lots sont répartis et ce qui se passe si un produit est endommagé.']
    ]
  },
  {
    id: 'series', number: '04', title: 'Séries, éditions et provenance',
    intro: 'Les repères de série et de langue permettent de retrouver une carte et de comparer les bonnes versions.',
    questions: [
      ['Qu’est-ce qu’une série Pokémon ?', 'Une série, ou extension, rassemble des cartes publiées sous un même nom et à une période donnée. Son nombre de cartes et les cartes supplémentaires varient. La liste officielle ou une checklist fiable aide à suivre les numéros.'],
      ['Pourquoi une carte existe-t-elle en plusieurs versions ?', 'Une même illustration ou un même Pokémon peut être réimprimé dans plusieurs séries, langues, produits ou finitions. Le numéro, le symbole de série et les mentions d’édition aident à distinguer ces versions.'],
      ['Comment retrouver la provenance d’une carte ?', 'Commence par relever son numéro, son symbole de série, sa langue et ses mentions de copyright. Pour une carte promotionnelle, regarde aussi le produit ou l’événement auquel elle était liée. La provenance doit être documentée quand elle influence une estimation.'],
      ['Les éditions étrangères sont-elles différentes ?', 'Les langues et certaines éditions régionales peuvent avoir des cartes, finitions, références ou dates de sortie différentes. Compare toujours la version exacte, pas seulement le nom du Pokémon.']
    ]
  },
  {
    id: 'scelles', number: '05', title: 'Produits scellés',
    intro: 'Les produits scellés regroupent les boosters et les accessoires encore dans leur emballage d’origine. Leur composition dépend du produit précis.',
    questions: [
      ['Qu’appelle-t-on un produit scellé ?', 'C’est un produit qui n’a pas été ouvert et dont l’emballage est présenté comme intact. L’état du scellage et l’origine du produit comptent : le mot « scellé » ne suffit pas à prouver son authenticité.'],
      ['Quelle différence entre booster, demi-display et display ?', 'Le booster est un paquet individuel. Une display est une boîte qui regroupe plusieurs boosters. « Demi-display » désigne souvent une partie d’une display, mais le nombre de boosters n’est pas universel : vérifie le format exact et le nombre indiqué.'],
      ['Que contient une ETB ou un coffret ?', 'Une ETB (Coffret Dresseur d’Élite) ou un coffret peut contenir des boosters, une carte promo, des protège-cartes et différents accessoires. Le contenu varie selon l’extension et l’édition ; consulte la liste officielle du produit.'],
      ['Pourquoi certains coffrets contiennent-ils une carte promo ?', 'Une carte promo est distribuée dans un contexte particulier, par exemple avec un coffret ou un événement. Son prix dépend de sa disponibilité, de son état et de la demande ; le mot « promo » ne signifie pas automatiquement « rare » ou « chère ».'],
      ['Comment évaluer l’état d’un produit scellé ?', 'Regarde les coins, les plis, les déchirures, l’écrasement et le film plastique ou les soudures lorsqu’ils existent. Décris les défauts et demande des photos de chaque face. Un emballage abîmé peut compter pour un collectionneur même si le contenu reste intact.'],
      ['Comment estimer la valeur d’un produit scellé ?', 'Compare le même produit et la même édition, puis distingue les ventes conclues des annonces. L’état, la langue, la disponibilité et la demande influencent le prix. Pour un produit rare, quelques annonces ne représentent pas forcément tout le marché.']
    ]
  },
  {
    id: 'protection', number: '06', title: 'Protéger et ranger',
    intro: 'Les protections réduisent les risques de rayures, de poussière et de pliure, mais elles ne remplacent pas une manipulation soigneuse.',
    questions: [
      ['À quoi sert une sleeve ?', 'Une sleeve, ou protège-carte souple, enveloppe la carte pour limiter les frottements et les traces de doigts. Choisis un format adapté et glisse la carte sans forcer.'],
      ['Quand utiliser un top loader ?', 'Le top loader est un étui rigide qui apporte une protection supplémentaire, souvent autour d’une carte déjà placée dans une sleeve. Il convient au rangement ou à l’envoi, à condition de ne pas coincer la carte.'],
      ['Une protection acrylique est-elle utile ?', 'Une coque acrylique rigide peut protéger un produit ou une carte contre les chocs et la poussière, selon son format. Elle prend plus de place et ne corrige pas les défauts déjà présents.'],
      ['Comment choisir un classeur ?', 'Choisis des pochettes adaptées, un rangement qui maintient les cartes sans les serrer, et un classeur propre et sec. Évite l’humidité, la chaleur directe et les objets posés sur les pages.'],
      ['Comment ranger ses produits scellés ?', 'Garde-les dans un endroit sec, à température stable et à l’abri du soleil. Évite les piles instables et les pressions sur les boîtes. Photographier l’état à l’arrivée peut aider à suivre leur conservation.']
    ]
  },
  {
    id: 'sets', number: '07', title: 'Sets et complétion',
    intro: 'Les mots « set » et « master set » n’ont pas toujours une définition identique chez tous les collectionneurs.',
    questions: [
      ['Qu’est-ce qu’un set ?', 'Le mot peut désigner une série de cartes ou l’ensemble que quelqu’un souhaite réunir. Pour éviter les malentendus, indique toujours quelles cartes et quelles versions tu inclus.'],
      ['Qu’est-ce qu’un master set ?', 'C’est une collection complète selon une règle définie par le collectionneur, souvent toutes les cartes d’une série et parfois certaines variantes, promos ou cartes secrètes. Il n’existe pas une définition universelle : précise le périmètre.'],
      ['Qu’est-ce qu’un ultra master set ?', 'C’est une appellation utilisée par certains collectionneurs pour un ensemble encore plus large qu’un master set. Son contenu n’est pas normalisé ; liste les catégories incluses pour que chacun comprenne ce qui est complet.'],
      ['Comment suivre ce qui manque ?', 'Utilise une checklist avec une ligne par carte ou version, puis distingue les cartes possédées, manquantes et en double. Décide à l’avance si tu comptes les reverses, promos et variantes.']
    ]
  },
  {
    id: 'gradees', number: '08', title: 'Cartes gradées',
    intro: 'La gradation est un service payant d’évaluation et de mise sous protection. La note donnée reste l’avis de la société qui a examiné la carte.',
    questions: [
      ['Pourquoi faire grader une carte ?', 'Certains collectionneurs veulent une évaluation documentée, un boîtier protecteur ou une présentation uniforme. La gradation n’est pas indispensable pour apprécier une carte et son coût doit être comparé à l’intérêt attendu.'],
      ['Que regarde une société de gradation ?', 'Les critères exacts dépendent du service. L’examen peut porter sur l’authenticité, le centrage, les coins, les bords et la surface. Les échelles et les méthodes peuvent différer d’une société à l’autre.'],
      ['La note garantit-elle le prix ou l’authenticité ?', 'Non. Une note décrit l’avis du service selon sa méthode ; elle ne garantit ni un prix de revente, ni l’absence de toute erreur. Compare des ventes de la même carte, dans la même langue et avec la même société et note.'],
      ['Comment choisir une société de gradation ?', 'Regarde sa méthode publiée, sa reconnaissance auprès des acheteurs visés, le coût, les délais, les modalités d’envoi et la facilité de vérification du numéro de certification.']
    ]
  },
  {
    id: 'marche', number: '09', title: 'Acheter, vendre et échanger',
    intro: 'Les annonces, les boutiques et les ventes conclues ne racontent pas la même chose du marché.',
    questions: [
      ['Quelle différence entre vendeur, revendeur et distributeur ?', 'Un vendeur commercialise un produit ; un revendeur achète pour le proposer à nouveau. Un distributeur fournit généralement des boutiques ou des revendeurs. Le rôle exact dépend du circuit et du pays.'],
      ['Une annonce en ligne donne-t-elle la valeur réelle ?', 'Elle donne le prix demandé par le vendeur. Pour estimer un prix de marché, cherche aussi des ventes terminées et compare l’état, la langue, la version et les frais.'],
      ['Comment acheter plus sereinement ?', 'Vérifie l’identité et l’historique du vendeur, demande des photos récentes, lis la description complète et utilise les protections de la plateforme. Méfie-toi des prix anormalement bas, des demandes de paiement hors plateforme et des photos génériques.'],
      ['Qu’est-ce qu’une exclusivité ?', 'C’est un produit ou une offre distribuée par un canal, une enseigne ou un territoire précis. L’exclusivité peut être temporaire ou limitée ; elle ne garantit pas à elle seule une valeur élevée.'],
      ['Collectionner dans une autre langue change-t-il quelque chose ?', 'Oui : la disponibilité, les noms, certains détails d’impression et la demande peuvent varier. Note la langue exacte dans ta collection et compare avec des exemplaires de cette même édition.']
    ]
  }
]

const glossary = [
  ['Art set', 'Un exemplaire de chaque illustration de booster d’une extension, selon la définition utilisée par le collectionneur.', 'series'],
  ['Booster', 'Un paquet scellé de cartes du JCC Pokémon.', 'boosters'],
  ['Box break', 'Une ouverture en direct où les produits ou cartes sont répartis selon des règles annoncées à l’avance.', 'boosters'],
  ['Display', 'Une boîte regroupant plusieurs boosters. Le nombre dépend du produit et de l’édition.', 'scelles'],
  ['Demi-display', 'Une portion de display ; le nombre de boosters doit être vérifié pour le format concerné.', 'scelles'],
  ['État', 'La condition physique d’une carte ou d’un produit : coins, bords, surface, plis et autres défauts.', 'cartes'],
  ['ETB', 'Abréviation courante de « Coffret Dresseur d’Élite ». Son contenu dépend de l’édition.', 'scelles'],
  ['Hit', 'Terme de collectionneur pour une carte marquante ou recherchée dans une ouverture ; ce n’est pas une rareté officielle.', 'cartes'],
  ['Loose', 'Produit vendu séparément de son emballage secondaire, par exemple un booster sans blister.', 'boosters'],
  ['Master set', 'Collection complète selon un périmètre choisi ; les variantes incluses doivent être précisées.', 'sets'],
  ['NPNT', 'Sigle de jargon au sens variable. Demande au vendeur ce qu’il entend par là et quelle garantie il donne.', 'boosters'],
  ['Promo', 'Carte distribuée dans un contexte ou un produit particulier, en dehors ou en complément du contenu classique des boosters.', 'scelles'],
  ['Rareté', 'Classement imprimé ou associé à une carte dans son extension ; les symboles et systèmes changent selon les séries.', 'cartes'],
  ['Scellé', 'Produit présenté comme non ouvert, avec un emballage intact. Cela ne suffit pas à établir son origine.', 'scelles'],
  ['Sleeve', 'Pochette souple de protection pour une carte.', 'protection'],
  ['Top loader', 'Étui rigide destiné à protéger une carte, souvent déjà glissée dans une sleeve.', 'protection'],
  ['Ultra master set', 'Terme de collectionneur pour un ensemble plus étendu qu’un master set ; son contenu varie.', 'sets']
]

export default function GuidePage() {
  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">›</span><span>Guide PokéValeur</span></nav>
    <header className={styles.hero}>
      <span className={styles.kicker}>Le guide du collectionneur</span>
      <h1>Comprendre ta collection Pokémon, à ton rythme</h1>
      <p>Des repères simples, des réponses aux questions fréquentes et un lexique pour mieux connaître les cartes, les boosters et les produits scellés.</p>
      <a className={styles.primaryLink} href="#bien-debuter">Je débute, par où commencer ? <span aria-hidden="true">↓</span></a>
      <a className={styles.secondaryLink} href="#lexique">Voir le lexique</a>
    </header>

    <section className={styles.topicIndex} aria-labelledby="topic-index-title">
      <div className={styles.sectionHeading}><span className={styles.kicker}>Explorer le guide</span><h2 id="topic-index-title">Choisis un thème</h2><p>Chaque réponse s’ouvre au clic. Les sujets pourront être complétés au fil du temps.</p></div>
      <div className={styles.topicGrid}>{topics.map(topic => <a key={topic.id} href={'#' + topic.id}><span>{topic.number}</span><strong>{topic.title}</strong><b aria-hidden="true">↗</b></a>)}</div>
    </section>

    <div className={styles.topicList}>
      {topics.map(topic => <section key={topic.id} id={topic.id} className={styles.topic} aria-labelledby={topic.id + '-title'}>
        <div className={styles.topicIntro}><span className={styles.topicNumber}>{topic.number}</span><div><h2 id={topic.id + '-title'}>{topic.title}</h2><p>{topic.intro}</p></div></div>
        <div className={styles.questions}>{topic.questions.map(([question, answer], index) => <details className={styles.question} key={question} open={topic.id === 'bien-debuter' && index === 0}>
          <summary>{question}<span aria-hidden="true" /></summary>
          <div className={styles.answer}><p>{answer}</p>
            {question === 'Combien de cartes contient un booster ?' && <p className={styles.source}>Source officielle : <a href="https://support.pokemon.com/hc/fr/articles/360000981613-Que-puis-je-trouver-dans-un-booster-du-Jeu-de-Cartes-%C3%A0-Collectionner-Pok%C3%A9mon" target="_blank" rel="noreferrer">Pokémon Assistance — contenu d’un booster</a>.</p>}
          </div>
        </details>)}</div>
        <a className={styles.backToTop} href="#topic-index-title">Retour aux thèmes ↑</a>
      </section>)}
    </div>

    <section className={styles.glossary} id="lexique" aria-labelledby="glossary-title">
      <div className={styles.sectionHeading}><span className={styles.kicker}>Les mots de la collection</span><h2 id="glossary-title">Petit lexique</h2><p>Une définition rapide, avec un lien vers le thème pour approfondir.</p></div>
      <dl>{glossary.map(([term, definition, topicId]) => <div key={term}><dt>{term}</dt><dd><p>{definition}</p><a href={'#' + topicId}>Voir le thème <span aria-hidden="true">→</span></a></dd></div>)}</dl>
    </section>

    <aside className={styles.note}><strong>Un guide qui grandit avec les collectionneurs</strong><p>Les contenus et appellations peuvent varier selon la série, la langue et l’époque. Pour un produit précis, vérifie toujours les informations imprimées sur l’emballage et la fiche officielle correspondante.</p><a href="mailto:contact@pokevaleur.fr?subject=Suggestion%20pour%20le%20Guide%20Pok%C3%A9Valeur">Proposer une question au guide →</a></aside>
  </main>
}
