export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="heroText">
          <span className="eyebrow">Suivez • Estimez • Collectionnez</span>
          <h1>Combien vaut vraiment ta collection&nbsp;?</h1>
          <p>Centralise tes achats, suis la valeur de tes cartes et produits scellés, et vois immédiatement ton investissement, ta valeur actuelle et ton évolution.</p>
          <div className="actions">
            <a className="btn" href="/login">Créer mon compte gratuitement</a>
            <a className="btn ghost" href="/collection">Voir l’espace collection</a>
          </div>
          <div className="ticks"><span>✓ Gratuit au démarrage</span><span>✓ Données privées par défaut</span><span>✓ Pensé pour les collectionneurs français</span></div>
        </div>
        <div className="dashboardCard">
          <div className="metric"><span>Montant investi</span><strong>3 185 €</strong></div>
          <div className="metric"><span>Valeur actuelle</span><strong>4 620 €</strong></div>
          <div className="metric positive"><span>Évolution</span><strong>+45 %</strong></div>
          <div className="spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <small>Exemple d’affichage</small>
        </div>
      </section>

      <section className="features">
        <article><b>📦 Fiches produits</b><p>ETB, coffrets, Pokébox, valisettes, cartes et accessoires.</p></article>
        <article><b>📈 Suivi de valeur</b><p>Compare prix d’achat, valeur actuelle, plus-value et perte.</p></article>
        <article><b>🔎 Recherche</b><p>Retrouve rapidement un produit ou une série.</p></article>
        <article><b>🔔 Alertes</b><p>Prévu pour une prochaine version : alertes de prix et disponibilité.</p></article>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <h2>Ta collection en un coup d’œil</h2>
          <div className="sampleRows">
            <div><span>Valisette Arceus</span><b>88 € → 112 €</b></div>
            <div><span>ETB Célébrations</span><b>120 € → 168 €</b></div>
            <div><span>Coffret 30 ans</span><b>85 € → 92 €</b></div>
          </div>
        </div>
        <div className="panel accent">
          <h2>Pourquoi PokéValeur ?</h2>
          <p>Parce qu’un collectionneur veut savoir ce qu’il possède, combien il a investi et comment sa collection évolue, sans passer par plusieurs tableaux ou applications.</p>
        </div>
      </section>
    </main>
  )
}
