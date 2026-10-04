import Image from 'next/image'

const demoObjects = [
  { name: 'ETB Héros transcendants', detail: '2 exemplaires · Produit scellé' },
  { name: 'Coffret collection 151', detail: '1 exemplaire · Produit scellé' },
  { name: 'Classeur de cartes', detail: '1 exemplaire · Accessoire' },
]

export default function CollectionMockupPreviewPage() {
  return (
    <main className="collectionWorkspace collectionDemoPage">
      <p className="collectionDemoNotice">Aperçu de la maquette · données fictives · aucun changement enregistré</p>

      <div className="collectionHeader collectionHeaderNew">
        <h1>Ma collection</h1>
        <label className="collectionProfileSelectLabel">
          <span className="srOnly">Profil affiché</span>
          <select aria-label="Profil affiché" disabled><option>Ma famille</option></select>
        </label>
      </div>

      <div className="collectionHeroArtwork">
        <Image src="/collection-hero.webp" alt="Classeur de cartes Pokémon ouvert, cartes protégées et coffret de collection" width={648} height={277} priority />
      </div>

      <nav className="collectionTabs" aria-label="Sections de la collection">
        <a className="active" href="#mes-objets-demo" aria-current="page">Mes objets</a>
        <a href="#collection-stats-demo">Stats collection</a>
        <a href="#valeur-demo" aria-label="Valeur en euros"><span className="collectionEuroIcon" aria-hidden="true">€</span> Valeur</a>
      </nav>

      <section className="collectionTotals" id="collection-stats-demo" aria-label="Résumé fictif de la collection">
        <h2>Dans ta collection</h2>
        <div className="collectionTotalGrid">
          <div><strong>128</strong><span>exemplaires</span></div>
          <div><strong>42</strong><span>produits</span></div>
          <div><strong>18</strong><span>séries</span></div>
        </div>
        <small className="collectionDemoCaption">Chiffres de démonstration</small>
      </section>

      <details className="collectionDemoAdd">
        <summary className="collectionAddCta">Ajouter un trésor</summary>
        <div className="collectionDemoPanel"><b>Aperçu uniquement</b><p>Cette page sert à tester la présentation. Aucun objet ne sera ajouté.</p></div>
      </details>

      <section className="panel collectionToolsPanel collectionFilesVisible" aria-label="Importer ou exporter la collection">
        <h2>Mes fichiers</h2>
        <div className="collectionFileActions">
          <button className="miniBtn" type="button" disabled>Importer Excel / CSV</button>
          <details open className="collectionExportMenu">
            <summary>Exporter avec ou sans prix</summary>
            <div><button className="miniBtn" type="button" disabled>Avec ou sans prix</button></div>
          </details>
        </div>
      </section>

      <section className="panel collectionSearchPanel">
        <h2>Retrouver un objet</h2>
        <input className="searchInput" type="search" placeholder="Rechercher dans tes trésors" aria-label="Recherche de démonstration" />
        <p className="muted">La recherche n’est pas active dans cet aperçu.</p>
      </section>

      <section className="panel collectionObjectsPanel" id="mes-objets-demo">
        <h2>Mes objets</h2>
        <details>
          <summary className="collectionShowObjects">Voir mes objets (128)</summary>
          <div className="collectionDemoObjects">
            {demoObjects.map(item => <article key={item.name}><b>{item.name}</b><span>{item.detail}</span></article>)}
            <small>Quelques exemples affichés · chiffres fictifs</small>
          </div>
        </details>
      </section>

      <section className="collectionTotals collectionDemoValue" id="valeur-demo">
        <h2>Valeur</h2>
        <p>La rubrique Valeur sera séparée des statistiques de collection.</p>
        <small className="collectionDemoCaption">Aucun montant réel dans cet aperçu.</small>
      </section>
    </main>
  )
}
