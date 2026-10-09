import { normalizeSearch } from './product-search.mjs'

const frenchMonths = {
  janvier: '01',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  aout: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  decembre: '12',
}

function yearOnlyOrder(year) {
  return year ? String(year) + '-12-31' : '9999-12-31'
}

export function getProductReleaseOrder(product) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(product.release_date || '')) {
    return product.release_date
  }

  const period = normalizeSearch(product.release_period || '')
  let match = period.match(/^(\d{1,2}) (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre) (\d{4})$/)
  if (match) {
    const day = match[1].padStart(2, '0')
    return match[3] + '-' + frenchMonths[match[2]] + '-' + day
  }

  match = period.match(/^(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre) (\d{4})$/)
  if (match) return match[2] + '-' + frenchMonths[match[1]] + '-01'

  match = period.match(/^([1-4])(?:er|e)? trimestre (\d{4})$/)
  if (match) {
    const month = String((Number(match[1]) - 1) * 3 + 1).padStart(2, '0')
    return match[2] + '-' + month + '-01'
  }

  // If only the year is known, keep the item at the end of that year.
  const year = Number(product.release_year) || Number(period.match(/\b(?:19|20)\d{2}\b/)?.[0])
  return yearOnlyOrder(year)
}

export function sortEtbsByReleaseDate(products) {
  return [...products].sort((a, b) => {
    const order = getProductReleaseOrder(a).localeCompare(getProductReleaseOrder(b))
    return order || String(a.name || '').localeCompare(String(b.name || ''), 'fr')
  })
}
