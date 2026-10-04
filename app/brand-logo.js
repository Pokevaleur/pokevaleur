export default function BrandLogo({ className = 'brand' }) {
  return (
    <a className={className} href="/" aria-label="PokéValeur, accueil">
      Poké<span className="brandValue">Valeur<svg className="brandCrown" viewBox="0 0 48 28" aria-hidden="true"><path d="M5 8 15 15 24 3 33 15 43 8 38 25H10Z" fill="currentColor"/><circle cx="5" cy="5" r="3" fill="currentColor"/><circle cx="24" cy="3" r="3" fill="currentColor"/><circle cx="43" cy="5" r="3" fill="currentColor"/></svg></span>
    </a>
  )
}
