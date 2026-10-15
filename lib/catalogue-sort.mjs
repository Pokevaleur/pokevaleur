function productReleaseDate(product) {
  const date = product?.release_date
  if (date) {
    const timestamp = Date.parse(date)
    if (Number.isFinite(timestamp)) return timestamp
  }

  const period = String(product?.release_period || '').match(/^(\d{4})-(\d{1,2})$/)
  if (period) return Date.UTC(Number(period[1]), Number(period[2]) - 1, 1)

  return null
}

function evSeriesNumber(product) {
  const label = String(product?.series || '') + ' ' + String(product?.name || '')
  const match = label.match(/\bEV\s*(\d+(?:[.,]\d+)?)\b/i)
  return match ? Number(match[1].replace(',', '.')) : null
}

export function compareProductsByRelease(a, b) {
  const aDate = productReleaseDate(a)
  const bDate = productReleaseDate(b)
  const aEv = evSeriesNumber(a)
  const bEv = evSeriesNumber(b)

  if (aEv !== null && bEv !== null && aEv !== bEv) return aEv - bEv

  if (aDate !== null && bDate !== null && aDate !== bDate) return aDate - bDate
  if (aDate !== null && bDate === null) return -1
  if (aDate === null && bDate !== null) return 1

  if (aEv !== null && bEv === null) return -1
  if (aEv === null && bEv !== null) return 1

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { numeric: true, sensitivity: 'base' })
}

export function sortProductsByRelease(products) {
  return [...products].sort(compareProductsByRelease)
}
