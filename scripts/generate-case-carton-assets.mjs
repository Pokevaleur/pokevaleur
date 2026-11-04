import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dataPath = path.join(scriptDir, 'data', 'case-cartons.json')
const outputDir = path.join(projectDir, 'public', 'case-cartons')
const palette = ['#1e6785', '#5b7b3d', '#9a5b35', '#76529a', '#287a70', '#a34750', '#4c648d', '#92702d']

function escapeXml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character])
}

function shortSeriesName(value) {
  return String(value || 'Série non précisée')
    .replace(/^(Écarlate et Violet|Épée et Bouclier|Soleil et Lune)\s*[–-]\s*/i, '')
    .replace(/^Méga-Évolution\s*[–-]\s*/i, '')
    .trim()
}

function displayType(row) {
  const text = [row.unit_type, row.unit_name, row.name, row.product_type].join(' ').toLocaleLowerCase('fr')
  if (/etb|coffret dresseur d'élite|coffret dresseur d’élite/.test(text)) return 'ETB'
  if (/tripack/.test(text)) return 'TRIPACK'
  if (/solo blister|blister/.test(text)) return 'SOLO BLISTER'
  if (/mini.?tin/.test(text)) return 'DISPLAY MINI-TINS'
  if (/pokébox|pokebox/.test(text)) return 'POKÉBOX'
  if (/pin.?s/.test(text)) return 'COLLECTION PIN’S'
  if (/coffret/.test(text)) return 'COFFRET'
  if (/display/.test(text)) return 'DISPLAY 36 BOOSTERS'
  return 'PRODUIT SCELLÉ'
}

function quantityLines(row, type) {
  const count = Number(row.case_unit_count || row.name?.match(/^Case de\s+(\d+)/i)?.[1])
  const miniTinCount = Number(row.unit_name?.match(/(\d+)\s*mini.?tins?/i)?.[1])
  if (type === 'DISPLAY MINI-TINS') {
    const displays = count ? `${count} DISPLAY${count > 1 ? 'S' : ''}` : 'DISPLAY'
    const total = count && miniTinCount ? `${count * miniTinCount} MINI-TINS` : miniTinCount ? `${miniTinCount} MINI-TINS PAR DISPLAY` : 'MINI-TINS'
    return [displays, total]
  }
  if (type === 'DISPLAY 36 BOOSTERS') {
    return [count ? `${count} DISPLAY${count > 1 ? 'S' : ''}` : 'DISPLAY', '36 BOOSTERS PAR DISPLAY']
  }
  const pluralType = type === 'ETB' ? type : `${type}${count > 1 ? 'S' : ''}`
  return [count ? `${count} ${pluralType}` : type, 'CARTON DE TRANSPORT']
}

function colorFor(row, index) {
  const value = `${row.series || ''}${row.product_type || ''}`
  let hash = index * 31
  for (const character of value) hash = (hash * 33 + character.codePointAt(0)) >>> 0
  return palette[hash % palette.length]
}

function makeSvg(row, index) {
  const type = displayType(row)
  const [quantity, unitNote] = quantityLines(row, type)
  const series = shortSeriesName(row.series)
  const accent = colorFor(row, index)
  const seriesFontSize = series.length > 25 ? 34 : series.length > 17 ? 40 : 46
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1254 1254" role="img" aria-label="Carton de ${escapeXml(quantity)} pour ${escapeXml(series)}">
  <image href="./kraft-carton.webp" x="0" y="0" width="1254" height="1254" preserveAspectRatio="xMidYMid meet"/>
  <g>
    <rect x="177" y="477" width="720" height="375" rx="20" fill="#f7f3e9" stroke="#573f2b" stroke-width="12"/>
    <path d="M197 497h680v74H197z" fill="${accent}"/>
    <text x="537" y="550" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="37" font-weight="800" letter-spacing="2">CASE SCELLÉE</text>
    <text x="537" y="654" text-anchor="middle" fill="#24221f" font-family="Arial, sans-serif" font-size="53" font-weight="800">${escapeXml(quantity)}</text>
    <text x="537" y="710" text-anchor="middle" fill="#554839" font-family="Arial, sans-serif" font-size="29" font-weight="700">${escapeXml(unitNote)}</text>
    <path d="M245 735h584" stroke="#d5c7ae" stroke-width="5"/>
    <text x="537" y="795" text-anchor="middle" fill="${accent}" font-family="Arial, sans-serif" font-size="${seriesFontSize}" font-weight="800">${escapeXml(series)}</text>
    <text x="537" y="829" text-anchor="middle" fill="#776b5b" font-family="Arial, sans-serif" font-size="20" letter-spacing="1">VISUEL INDICATIF · POKÉVALEUR</text>
  </g>
</svg>
`
}

const rows = JSON.parse(await readFile(dataPath, 'utf8'))
await mkdir(outputDir, { recursive: true })
for (const [index, row] of rows.entries()) {
  await writeFile(path.join(outputDir, `${row.id}.svg`), makeSvg(row, index), 'utf8')
}
console.log(`Generated ${rows.length} case carton SVGs.`)
