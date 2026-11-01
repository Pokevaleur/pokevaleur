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
    // Some sealed products store their series as "[block] – [expansion]",
    // while card_sets stores the block and expansion in separate columns.
    // Index that combined label too so expansion products inherit their own
    // release date instead of falling back to alphabetical order.
    const combinedLabel = row.series_name && row.set_name
      ? `${row.series_name} ${row.set_name}`
      : null
    for (const label of [row.series_name, row.set_name, combinedLabel]) {
      const key = normalizeSeriesLabel(label)
      if (!key || (dates.has(key) && dates.get(key) <= row.release_date)) continue
      dates.set(key, row.release_date)
    }
  }
  return dates
}

function seriesReleaseDate(series, seriesReleaseDates) {
  const key = normalizeSeriesLabel(series)
  if (!key || !seriesReleaseDates?.size) return null
  const exact = seriesReleaseDates.get(key)
  if (exact) return exact

  // Some sealed records include a block or language label around the set name.
  // Reuse the longest matching set label so those products still inherit its date.
  let bestLabel = ''
  let bestDate = null
  for (const [label, date] of seriesReleaseDates) {
    if (label.length <= bestLabel.length) continue
    if (key.endsWith(` ${label}`) || label.endsWith(` ${key}`)) {
      bestLabel = label
      bestDate = date
    }
  }
  return bestDate
}

function productReleaseDate(product, seriesReleaseDates) {
  const seriesDate = seriesReleaseDate(product?.series, seriesReleaseDates)
  const isBooster = /booster/i.test(String(product?.product_type || ''))
  // A loose booster has no independent release: its set's date is authoritative.
  if (isBooster && seriesDate) {
    const timestamp = Date.parse(seriesDate)
    if (Number.isFinite(timestamp)) return timestamp
  }

  const date = product?.release_date
  if (date) {
    const timestamp = Date.parse(date)
    if (Number.isFinite(timestamp)) return timestamp
  }

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

function productReleaseYear(product, seriesReleaseDates) {
  const storedYear = Number(product?.release_year)
  if (Number.isInteger(storedYear) && storedYear >= 1996 && storedYear <= 2100) return storedYear

  const date = productReleaseDate(product, seriesReleaseDates)
  if (date !== null) return new Date(date).getUTCFullYear()

  const periodYear = String(product?.release_period || '').match(/\\b(19|20)\\d{2}\\b/)
  return periodYear ? Number(periodYear[0]) : null
}

export function compareProductsByRelease(a, b, seriesReleaseDates) {
  const aYear = productReleaseYear(a, seriesReleaseDates)
  const bYear = productReleaseYear(b, seriesReleaseDates)
  const aDate = productReleaseDate(a, seriesReleaseDates)
  const bDate = productReleaseDate(b, seriesReleaseDates)
  const aEv = evSeriesNumber(a)
  const bEv = evSeriesNumber(b)

  // Catalogue records often have a year but no full date. Keep those products
  // in chronological year order instead of falling back to alphabetical order.
  if (aYear !== null && bYear !== null && aYear !== bYear) return aYear - bYear
  if (aYear !== null && bYear === null) return -1
  if (aYear === null && bYear !== null) return 1

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
