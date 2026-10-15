export default function robots() {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/collection',
        '/admin',
        '/admin-partenaires',
        '/communaute',
        '/opportunites',
        '/trades',
        '/login',
        '/update-password',
        '/api/'
      ]
    }],
    sitemap: 'https://www.pokevaleur.fr/sitemap.xml',
    host: 'https://www.pokevaleur.fr'
  }
}
