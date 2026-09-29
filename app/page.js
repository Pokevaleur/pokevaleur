export default function Home() {
  return (
    <main className="homePage">
      <section className="homeHero">
        <div className="homeHeroCopy">
          <span className="homePill">PokéValeur • Produits scellés & cartes</span>
          <h1>Lukulu, le gardien de vos trésors de collection.</h1>
          <p>
            Suivez la valeur de vos produits, organisez votre collection et gardez une vision claire
            de ce que vous possédez. Avec Lukulu, repérez vos doublons, complétez vos artsets et
            surveillez les meilleures opportunités.
          </p>

          <div className="homeHeroActions">
            <a className="btn homePrimary" href="/login">Créer mon compte</a>
            <a className="btn ghost" href="/catalogue">Explorer le catalogue</a>
          </div>

          <div className="homeTrustRow">
            <span>✓ Collection privée</span>
            <span>✓ Cotes suivies</span>
            <span>✓ Pensé mobile</span>
          </div>
        </div>

        <div className="homeHeroShowcase">
          <div className="homeMascotVisual">
            <img src="/Lukulu-home.png" alt="Lukulu, le gardien des trésors de collection PokéValeur" />
          </div>
          <div className="homeMiniCard top">
            <span>Watchlist</span>
            <b>3 opportunités</b>
          </div>
          <div className="homeMiniCard bottom">
            <span>Artsets</span>
            <b>7 complets</b>
          </div>
        </div>
      </section>

      <section className="homeQuickStats">
        <article><span>Catalogue</span><strong>600+ produits</strong><small>ETB, displays, cases, boosters, coffrets…</small></article>
        <article><span>Suivi intelligent</span><strong>Valeur & historique</strong><small>Prix d’achat, cote, évolution et ventes observées.</small></article>
        <article><span>Collectionneur</span><strong>Artsets & doublons</strong><small>Repère ce qui manque et ce que tu peux revendre.</small></article>
        <article><span>Communauté</span><strong>Trades entre membres</strong><small>Mise en relation simple, sans intermédiaire financier.</small></article>
      </section>

      <section className="homeSection">
        <div className="homeSectionHead">
          <span className="eyebrow dark">Tout au même endroit</span>
          <h2>Un vrai tableau de bord de collectionneur</h2>
          <p>Pas seulement “combien ça vaut”, mais aussi quoi conserver, quoi vendre, quoi chercher et comment ta collection évolue.</p>
        </div>

        <div className="homeFeatureGrid">
          <article className="homeFeatureCard featured"><div className="homeFeatureIcon">📦</div><h3>Ma collection</h3><p>Photos, prix d’achat, état, variantes, compositions et valeur actuelle.</p><a href="/collection">Ouvrir ma collection →</a></article>
          <article className="homeFeatureCard"><div className="homeFeatureIcon">🎯</div><h3>Watchlist & alertes</h3><p>Fixe un prix objectif et repère les offres intéressantes lorsqu’elles apparaissent.</p><a href="/opportunites">Voir les opportunités →</a></article>
          <article className="homeFeatureCard"><div className="homeFeatureIcon">♻️</div><h3>Doublons</h3><p>Identifie instantanément les exemplaires en surplus et leur valeur potentielle.</p><a href="/opportunites">Voir mes doublons →</a></article>
          <article className="homeFeatureCard"><div className="homeFeatureIcon">🧩</div><h3>Artsets</h3><p>Suis chaque artwork de booster ou solo blister et visualise ce qu’il te manque.</p><span className="homeSoon">En cours d’enrichissement</span></article>
          <article className="homeFeatureCard"><div className="homeFeatureIcon">🔁</div><h3>Trades</h3><p>Propose tes doublons et échange directement avec d’autres collectionneurs.</p><a href="/trades">Découvrir les trades →</a></article>
          <article className="homeFeatureCard"><div className="homeFeatureIcon">💬</div><h3>Communauté</h3><p>Échange avec des membres actifs dans un espace modéré et réservé aux comptes.</p><a href="/communaute">Entrer dans la communauté →</a></article>
        </div>
      </section>

      <section className="homeSplit">
        <div className="homeStoryCard dark">
          <span className="homePill mutedPill">Le principe PokéValeur</span>
          <h2>Tu sais exactement ce que tu possèdes.</h2>
          <p>Chaque produit peut devenir une vraie fiche de collection : photos, origine, prix d’achat, état du scellé, boosters visibles, historique et valeur.</p>
          <div className="homeChecklist"><span>✓ Fiche détaillée</span><span>✓ Historique de valeur</span><span>✓ Photos personnelles</span><span>✓ Recherche rapide</span></div>
        </div>

        <div className="homeStoryCard gold">
          <span className="homePill">Assistant collectionneur</span>
          <h2>PokéValeur t’aide à décider, sans décider à ta place.</h2>
          <p>Doublons, watchlist, objectifs de prix, artsets incomplets et trades potentiels : l’information utile remonte au bon moment.</p>
          <a className="btn" href="/opportunites">Voir mon tableau de bord</a>
        </div>
      </section>

      <section className="homeFinalCta">
        <div><span className="eyebrow">Ta collection mérite mieux qu’un tableau Excel</span><h2>Commence à construire ton PokéValeur.</h2></div>
        <a className="btn" href="/login">Créer mon espace gratuitement</a>
      </section>
    </main>
  )
}
