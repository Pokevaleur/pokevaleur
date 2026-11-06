import { normalizeSearch } from './product-search.mjs'

const cardNamePronunciationAliases = new Map([
  ['pomdorochi', 'Pomdorochi'],
  ['pont de rochy', 'Pomdorochi'],
  ['pont de rochi', 'Pomdorochi'],
  ['pom de rochy', 'Pomdorochi'],
  ['pom de rochi', 'Pomdorochi'],
  ['pom dorochi', 'Pomdorochi'],
  ['pom do rochi', 'Pomdorochi'],
  ['pom dorochy', 'Pomdorochi'],
  ['pom de roche', 'Pomdorochi'],
  ['pomme de rochy', 'Pomdorochi'],
  ['pomme de rochi', 'Pomdorochi'],
  ['pomme de rocher', 'Pomdorochi'],
  ['pomme de roche', 'Pomdorochi']
])

const speechFillerWords = new Set(['cherche', 'recherche', 'carte', 'pokemon', 'pokémon', 'la', 'le', 'un', 'une'])

function normalizedCardNameAliasKey(value) {
  return normalizeSearch(value).split(' ').filter(word => word && !speechFillerWords.has(word)).join(' ')
}

export function correctKnownVoiceCardName(value) {
  return cardNamePronunciationAliases.get(normalizedCardNameAliasKey(value)) || null
}

export function normalizeVoiceSearchQuery(value) {
  const knownCardName = correctKnownVoiceCardName(value)
  if (knownCardName) return normalizeSearch(knownCardName)
  return normalizeSearch(value)
    .replace(/\blove\s+disk\b/g, 'lovdisc')
    .replace(/\blove\s*disc\b/g, 'lovdisc')
    .replace(/\b(rivers?|revers(?:e|es)?|rever|riverse)\b/g, 'reverse')
}
