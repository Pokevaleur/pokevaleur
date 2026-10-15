function normalizeSeriesLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function createSeriesReleaseDateMap(rows = []) {
  const dates = new Map()
  for (const row of rows) {
    if (!row?.release_date) continue
    for (const label of [row.series_name, row.set_name]) {
      const key = normalizeSeriesLabel(label)
      if (!key || (dates.has(key) && dates.get(key) <= row.release_date)) continue
      dates.set(key, row.release_date)
    }
  }
  return dates
}

function productReleaseDate(product, seriesReleaseDates) {
  const date = product?.release_date
  if (date) {
    const timestamp = Date.parse(date)
    if (Number.isFinite(timestamp)) return timestamp
  }

  const seriesDate = seriesReleaseDates?.get(normalizeSeriesLabel(product?.series))
  if (seriesDate) {
    const timestamp = Date.parse(seriesDate)
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

export function compareProductsByRelease(a, b, seriesReleaseDates) {
  const aDate = productReleaseDate(a, seriesReleaseDates)
  const bDate = productReleaseDate(b, seriesReleaseDates)
  const aEv = evSeriesNumber(a)
  const bEv = evSeriesNumber(b)

  // When two products identify their EV series explicitly, keep that series
  // order even if their product names would sort alphabetically (EV10 before EV2).
  if (aEv !== null && bEv !== null && aEv !== bEv) return aEv - bEv

  if (aDate !== null && bDate !== null && aDate !== bDate) return aDate - bDate
  if (aDate !== null && bDate === null) return -1
  if (aDate === null && bDate !== null) return 1

  if (aEv !== null && bEv === null) return -1
  if (aEv === null && bEv !== null) return 1

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { numeric: true, sensitivity: 'base' })
}

export function sortProductsByRelease(products, seriesReleaseDates) {
  return [...products].sort((a, b) => compareProductsByRelease(a, b, seriesReleaseDates))
}
