export const metadata = {
  title: 'Série complète, Master Set et Ultra Master Set | PokéValeur',
  description: 'Les définitions PokéValeur pour suivre la complétion des séries Pokémon.'
}

const pageStyle = {
  width: 'min(100% - 32px, 900px)',
  margin: '0 auto',
  padding: 'clamp(28px, 6vw, 64px) 0',
  color: '#17283b',
  lineHeight: 1.65,
}
const cardStyle = {
  padding: 'clamp(20px, 4vw, 32px)',
  margin: '18px 0',
  border: '1px solid #dce3eb',
  borderRadius: 18,
  background: '#fff',
  boxShadow: '0 12px 30px #17283b0b',
}
const eyebrowStyle = {
  color: '#94752c',
  fontSize: '.78rem',
  fontWeight: 850,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
}

export default function BinderDefinitionsPage() {
  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>PokéValeur · Guide collection</p>
      <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(2rem, 6vw, 3.5rem)', lineHeight: 1.08 }}>Comprendre les niveaux de complétion</h1>
      <p style={{ maxWidth: 720, color: '#617084', fontSize: '1.12rem' }}>
        PokéValeur distingue les numéros d’une série, les différentes versions d’impression et les cartes promotionnelles.
      </p>

      <section id="serie-complete" style={cardStyle}>
        <p style={eyebrowStyle}>1 · Les numéros de la série</p>
        <h2 style={{ marginTop: 0 }}>Série complète</h2>
        <p>
          Chaque numéro officiel de la série compte une fois. Les cartes secrètes et les hits sont inclus,
          mais les variantes de finition (reverse, Poké Ball, Master Ball, etc.) ne créent pas de numéros supplémentaires.
        </p>
        <p><strong>Évolutions Prismatiques : 180 numéros.</strong> La complétion compare les numéros distincts possédés à ces 180 cartes.</p>
      </section>

      <section id="master-set" style={cardStyle}>
        <p style={eyebrowStyle}>2 · Les versions de la série</p>
        <h2 style={{ marginTop: 0 }}>Master Set PokéValeur</h2>
        <p>
          Le Master Set PokéValeur regroupe les cartes de la série et toutes leurs variantes de finition,
          ainsi que les cartes Énergie associées. Chaque version différente a son propre emplacement.
        </p>
        <p>
          <strong>Évolutions Prismatiques : 455 emplacements.</strong> Les cartes promotionnelles et les versions avec tampon
          sont suivies à part : elles ne sont pas incluses dans ce total.
        </p>
      </section>

      <section id="ultra-master-set" style={cardStyle}>
        <p style={eyebrowStyle}>3 · Les cartes liées aux produits et événements</p>
        <h2 style={{ marginTop: 0 }}>Ultra Master Set</h2>
        <p>
          L’Ultra Master Set reprend le Master Set et lui ajoute les cartes promotionnelles et les versions tamponnées :
          cartes de produits spéciaux, éditions d’événement et autres impressions exclusives liées à la série.
        </p>
        <p>Son total dépend donc des promos et des tampons retenus dans le catalogue PokéValeur.</p>
      </section>

      <p><a href="/collection/classeurs" style={{ color: '#173c73', fontWeight: 800 }}>Retour à mes classeurs</a></p>
    </main>
  )
}
