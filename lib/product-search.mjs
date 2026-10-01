export function normalizeSearch(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/k\s*[.]\s*o\s*[.]?/g, 'ko')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

// Recognize the longest phrase first, so “demi display” stays more precise than “display”.
const aliasGroups = [
  ['etb', 'elite trainer box', 'coffret dresseur elite', 'coffret dresseur d elite', 'coffret dresseur', 'dresseur elite', 'dresseur d elite'],
  ['display', 'displays', 'booster box', 'boite de boosters', 'boite boosters'],
  ['demi display', 'demie display', 'demi displays', 'demidisplay', 'half display', 'half booster box', '18 boosters'],
  ['bundle', 'bundles', 'booster bundle', 'lot de 6 boosters'],
  ['tripack', 'tri pack', 'blister 3 boosters', '3 boosters'],
  ['duopack', 'duo pack', 'blister 2 boosters', '2 boosters'],
  ['pokebox', 'poke box', 'tin'],
  ['minitin', 'mini tin', 'mini tins', 'mini boite', 'mini boites', 'mini pokebox'],
  ['upc', 'ultra premium', 'ultra premium collection', 'collection ultra premium'],
  ['valisette', 'valisettes', 'coffre de collection', 'collector chest'],
  ['pin box', 'pins box', 'coffret pins', 'coffret pin', 'collection pins', 'collection pin'],
  ['classeur', 'binder', 'binder collection', 'collection classeur'],
  ['coffret', 'coffrets', 'collection'],
  ['pokemon day', 'journee pokemon'],
  ['30 ans', '30ans', '30e anniversaire', '30eme anniversaire', '30 anniversaire', '30th anniversary', 'journee pokemon 2026', 'collection ko'],
  ['ko', 'collection ko'],
  ['vstar', 'v star'],
  ['phyllali', 'leafeon'],
  ['nymphali', 'sylveon'],
  ['evoli', 'eevee'],
  ['dracaufeu', 'charizard'],
  ['amphinobi', 'greninja'],
]
// Collection K.O. belongs to the anniversary range, but a K.O. query must stay specific.
const aliases = aliasGroups.flatMap(group => group.filter(term => group[0] !== '30 ans' || term !== 'collection ko').map(term => ({
  words: normalizeSearch(term).split(' '),
  alternatives: group.map(normalizeSearch),
}))).sort((a, b) => b.words.length - a.words.length)
const stopWords = new Set(['de', 'd', 'du', 'des', 'la', 'le', 'les', 'l', 'un', 'une', 'et', 'pour'])

export function createProductMatcher(query) {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  const criteria = []
  for (let index = 0; index < words.length;) {
    const alias = aliases.find(entry => entry.words.every((word, offset) => words[index + offset] === word))
    if (alias) {
      criteria.push({ alternatives: alias.alternatives, exact: true })
      index += alias.words.length
    } else {
      if (!stopWords.has(words[index])) criteria.push({ alternatives: [words[index]], exact: false })
      index++
    }
  }
  return product => {
    if (!criteria.length) return false
    const haystack = normalizeSearch([product.name, product.series, product.category, product.product_type].filter(Boolean).join(' '))
    const padded = ` ${haystack} `
    return criteria.every(({ alternatives, exact }) => alternatives.some(term =>
      exact || /^\d+$/.test(term) ? padded.includes(` ${term} `) : haystack.split(' ').some(word => word.startsWith(term))
    ))
  }
}
