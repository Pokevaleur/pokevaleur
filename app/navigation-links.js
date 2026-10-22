const navLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/guide', label: 'Guide PokéValeur' },
  {
    label: 'Catalogue',
    children: [
      { href: '/catalogue', label: 'Produits scellés' },
      { href: '/catalogue?search=ETB', label: 'ETB' },
      { href: '/catalogue/cartes', label: 'Cartes' }
    ]
  },
  {
    label: 'Ma Collection',
    children: [
      { href: '/collection', label: 'Produits scellés' },
      { href: '/collection?search=ETB', label: 'ETB' },
      { href: '/collection/cartes', label: 'Mes cartes' },
      {
        href: '/collection/cartes-gradees/consulter',
        label: 'Mes cartes gradées',
        memberOnly: true,
        children: [
          { href: '/collection/cartes-gradees/ajouter', label: 'Ajouter', memberOnly: true },
          { href: '/collection/cartes-gradees/consulter', label: 'Consulter', memberOnly: true }
        ]
      },
      { href: '/collection/classeurs', label: 'Mes classeurs' },
      {
        href: '/collection/valeur',
        label: 'Valeur',
        memberOnly: true,
        children: [
          { href: '/collection/valeur', label: 'Vue d’ensemble', memberOnly: true },
          { href: '/collection/valeur/scelles', label: 'Produits scellés', memberOnly: true },
          {
            href: '/collection/valeur/cartes',
            label: 'Cartes',
            memberOnly: true,
            children: [
              { href: '/collection/valeur/cartes', label: 'Par série', memberOnly: true },
              { href: '/collection/valeur/cartes/individuelle', label: 'Carte individuelle', memberOnly: true },
            ]
          }
        ]
      }
    ]
  },
  { href: '/opportunites', label: 'Watchlist' },
  { href: '/communaute', label: 'Communauté' },
  {
    href: '/trades',
    label: 'Trades',
    children: [
      { href: '/trades', label: 'Produits scellés' },
      { href: '/trades/cartes', label: 'Doubles de cartes' }
    ]
  },
  { href: '/progression', label: 'Mon grade' },
  { href: '/coffre', label: 'Coffre de Lukulu' }
]

export default navLinks
