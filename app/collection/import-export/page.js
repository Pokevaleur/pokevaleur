'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import { normalizeSearch } from '../../../lib/product-search.mjs'
import styles from './page.module.css'

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const shortDate = new Intl.DateTimeFormat('fr-FR')

const bundleSeriesLabels = new Map([
  ['EV 8.5', 'Évolutions Prismatiques'],
  ['ME 1', 'Méga-Évolution'],
  ['ME 2.5', 'Héros Transcendants']
])

function normalizeSeriesCodes(value) {
  return String(value || '').replace(/\b(EV|ME|EB|XY|SL|SV)\s*0*(\d+(?:[.,]\d+)?)/giu, (_, prefix, rawNumber) => {
    const number = String(Number(rawNumber.replace(',', '.')))
    return prefix.toUpperCase() + ' ' + number
  })
}

function titleCaseFrench(value) {
  let title = String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr-FR')
  title = title.replace(/(^|[\s–—-])(\p{L})/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase('fr-FR'))
  title = title.replace(/\b(de|du|des|d['’]|et|à|au|aux|en|la|le|les|sur|sous|pour|par|dans|avec)\b/giu,
    (word, offset) => offset === 0 ? word : word.toLocaleLowerCase('fr-FR'))
  title = normalizeSeriesCodes(title)
  return title
    .replace(/\bEtb\b/gu, 'ETB')
    .replace(/\bUpc\b/gu, 'UPC')
    .replace(/\bSpc\b/gu, 'SPC')
    .replace(/\bAp\b/gu, 'AP')
    .replace(/\bPok[eé]box\b/giu, 'Pokébox')
    .replace(/\bBoite\b/giu, 'Boîte')
}

function bundleSeriesCode(row) {
  const source = [row.title, row.catalogName, row.series].filter(Boolean).join(' ')
  const match = source.match(/\b(EV|ME|EB|XY|SL|SV)\s*0*(\d+(?:[.,]\d+)?)/iu)
  if (!match) return ''
  return normalizeSeriesCodes(match[0])
}

function bundleSeriesName(row, code) {
  if (bundleSeriesLabels.has(code)) return bundleSeriesLabels.get(code)
  const source = [row.series, row.catalogName, row.title].filter(Boolean)
  for (const candidate of source) {
    const cleaned = normalizeSeriesCodes(candidate)
      .replace(/^\s*(?:lot\s+de\s+(?:6|six)\s+boosters?|booster\s+bundle|bundle)\s*/iu, '')
      .replace(/\b(?:EV|ME|EB|XY|SL|SV)\s*0*\d+(?:[.,]\d+)?\b/iu, '')
      .replace(/^\s*[-–—:|]+\s*/, '')
      .trim()
    if (cleaned && !/^\d+$/u.test(cleaned)) return titleCaseFrench(cleaned)
  }
  return ''
}

function formatExcelProductTitle(row) {
  const rawTitle = String(row.title || 'Produit sans nom').trim()
  const normalizedTitle = normalizeSearch(rawTitle)
  const productType = normalizeSearch(row.productType)
  const isBundle = productType === 'bundle' || productType === 'booster bundle'
    || /^(?:bundle|booster bundle|lot de (?:6|six) boosters?)\b/u.test(normalizedTitle)
  if (isBundle) {
    const code = bundleSeriesCode(row)
    const seriesName = bundleSeriesName(row, code)
    if (code || seriesName) return ['Bundle', code, seriesName].filter(Boolean).join(' ')
    return 'Bundle ' + titleCaseFrench(rawTitle
      .replace(/^\s*(?:lot\s+de\s+(?:6|six)\s+boosters?|booster\s+bundle|bundle)\s*/iu, ''))
  }
  return titleCaseFrench(rawTitle)
}

function formatDate(value) {
  if (!value) return 'Non renseignée'
  const date = new Date(String(value).slice(0, 10) + 'T12:00:00')
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : shortDate.format(date)
}

function getProductValue(item, product) {
  if (item.current_value_override !== null && item.current_value_override !== undefined && item.current_value_override !== '') {
    const value = Number(item.current_value_override)
    return Number.isFinite(value) ? { value, source: 'Valeur manuelle' } : { value: null, source: '' }
  }
  if (item.sealed_condition === 'zero_defect' && product?.zero_defect_value !== null && product?.zero_defect_value !== undefined) {
    return { value: Number(product.zero_defect_value), source: 'Cote PokéValeur · zéro défaut' }
  }
  if (product?.current_value !== null && product?.current_value !== undefined) {
    return { value: Number(product.current_value), source: 'Cote PokéValeur · standard' }
  }
  return { value: null, source: '' }
}

function sortCollectionRows(rows) {
  return [...rows].sort((a, b) => {
    const left = a.purchase_date ? String(a.purchase_date).slice(0, 10) : '9999-99-99'
    const right = b.purchase_date ? String(b.purchase_date).slice(0, 10) : '9999-99-99'
    return left.localeCompare(right)
      || a.title.localeCompare(b.title, 'fr')
      || String(a.id).localeCompare(String(b.id))
  })
}

export default function ImportExportPage() {
  const supabase = useMemo(() => createClient(), [])
  const [profileName, setProfileName] = useState('')
  const [rows, setRows] = useState([])
  const [unlinkedRows, setUnlinkedRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingUnlinkedExcel, setExportingUnlinkedExcel] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadCollection() {
      setLoading(true)
      setError('')
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          window.location.replace('/login?next=' + encodeURIComponent('/collection/import-export'))
          return
        }

        const { data: profiles, error: profilesError } = await fetchAllRows(() => supabase
          .from('collection_profiles')
          .select('id,display_name,is_default,created_at')
          .order('created_at'))
        if (profilesError) throw profilesError

        const savedProfileId = window.localStorage.getItem('pokevaleur-collection:' + user.id)
        const profile = (profiles || []).find(entry => entry.id === savedProfileId)
          || (profiles || []).find(entry => entry.is_default)
          || (profiles || [])[0]
        if (!profile) throw new Error('Aucun profil de collection n’est disponible.')

        const { data: items, error: itemsError } = await fetchAllRows(() => supabase
          .from('collection_items')
          .select('id,product_id,custom_name,quantity,purchase_price,purchase_date,current_value_override,sealed_condition,product_type_override,booster_configuration,variant_note')
          .eq('collection_profile_id', profile.id)
          .order('purchase_date', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true }))
        if (itemsError) throw itemsError

        const productIds = [...new Set((items || []).map(item => item.product_id).filter(Boolean))]
        const products = []
        for (let offset = 0; offset < productIds.length; offset += 100) {
          const { data, error: productsError } = await supabase.from('products')
            .select('id,name,series,category,product_type,current_value,zero_defect_value')
            .eq('is_public', true)
            .in('id', productIds.slice(offset, offset + 100))
          if (productsError) throw productsError
          products.push(...(data || []))
        }
        const productById = new Map(products.map(product => [product.id, product]))
        const unlinkedRows = (items || []).filter(item => !item.product_id || !productById.has(item.product_id))
          .map(item => ({
            id: item.id,
            title: item.custom_name?.trim() || 'Article sans nom',
            purchase_date: item.purchase_date
          }))
          .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base', numeric: true })
            || String(a.id).localeCompare(String(b.id)))
        const sealedRows = (items || []).filter(item => {
          const product = item.product_id ? productById.get(item.product_id) : null
          return normalizeSearch(product?.category) === 'sealed'
        }).map(item => {
          const product = item.product_id ? productById.get(item.product_id) : null
          const quantity = Math.max(0, Number(item.quantity) || 1)
          const current = getProductValue(item, product)
          const details = [
            product?.series,
            item.product_type_override?.trim() || product?.product_type,
            item.booster_configuration,
            item.variant_note
          ].filter(Boolean)
          return {
            id: item.id,
            purchase_date: item.purchase_date,
            title: item.custom_name?.trim() || product?.name || 'Produit sans nom',
            catalogName: product?.name || '',
            series: product?.series || '',
            productType: item.product_type_override?.trim() || product?.product_type || '',
            details: [...new Set(details)].join(' · '),
            quantity,
            purchaseUnit: item.purchase_price === null || item.purchase_price === undefined || item.purchase_price === ''
              ? null
              : Number(item.purchase_price),
            currentUnit: current.value,
            currentSource: current.source,
            condition: item.sealed_condition || 'standard'
          }
        })

        if (!active) return
        setProfileName(profile.display_name || 'Ma collection')
        setRows(sortCollectionRows(sealedRows))
        setUnlinkedRows(unlinkedRows)
      } catch (loadError) {
        if (active) setError(loadError.message || 'Impossible de charger la collection.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCollection()
    return () => { active = false }
  }, [supabase])

  const summary = useMemo(() => rows.reduce((total, row) => {
    total.entries += 1
    total.copies += row.quantity
    if (Number.isFinite(row.purchaseUnit)) total.invested += row.purchaseUnit * row.quantity
    else total.unknownPurchaseCopies += row.quantity
    if (Number.isFinite(row.currentUnit)) {
      total.currentValue += row.currentUnit * row.quantity
      total.valuedCopies += row.quantity
    }
    return total
  }, { entries: 0, copies: 0, invested: 0, unknownPurchaseCopies: 0, currentValue: 0, valuedCopies: 0 }), [rows])

  async function exportSealedPdf() {
    if (!rows.length || exporting) return
    setExporting(true)
    setError('')
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const columns = [
        { label: 'Date d’achat', width: 25 },
        { label: 'Article', width: 105 },
        { label: 'Qté', width: 13 },
        { label: 'Achat / unité', width: 27 },
        { label: 'Montant acheté', width: 34 },
        { label: 'Valeur actuelle estimée', width: 73 }
      ]
      const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)
      const left = (pageWidth - tableWidth) / 2
      let y = 0

      function drawTableHeader() {
        pdf.setFillColor(23, 48, 82)
        pdf.rect(left, y, tableWidth, 9, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(255, 255, 255)
        let x = left
        for (const column of columns) {
          pdf.text(column.label, x + 2, y + 5.8)
          x += column.width
        }
        y += 9
      }

      function drawPageHeading(firstPage) {
        pdf.setFillColor(240, 246, 255)
        pdf.roundedRect(margin, 9, pageWidth - margin * 2, firstPage ? 31 : 19, 3, 3, 'F')
        pdf.setTextColor(23, 48, 82)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(firstPage ? 15 : 11)
        pdf.text('PokéValeur · Inventaire de mes produits scellés', margin + 5, 16)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(69, 86, 108)
        pdf.text('Collection : ' + profileName + ' · Édité le ' + formatDate(new Date().toISOString()), margin + 5, 22)
        if (firstPage) {
          pdf.setFontSize(7.5)
          pdf.text(
            'Exemplaires : ' + summary.copies
              + '   ·   Achats renseignés : ' + currency.format(summary.invested)
              + '   ·   Valeur actuelle connue : ' + currency.format(summary.currentValue)
              + ' (' + summary.valuedCopies + '/' + summary.copies + ' exemplaires)',
            margin + 5, 29
          )
          pdf.setFontSize(7)
          pdf.setTextColor(94, 107, 124)
          pdf.text('Les valeurs inconnues restent indiquées comme non renseignées et ne sont pas déduites du prix d’achat.', margin + 5, 36)
          y = 44
        } else {
          y = 29
        }
        drawTableHeader()
      }

      drawPageHeading(true)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]
        const articleText = row.details ? row.title + '\n' + row.details : row.title
        const articleLines = pdf.splitTextToSize(articleText, columns[1].width - 5)
        const valueLines = Number.isFinite(row.currentUnit)
          ? [currency.format(row.currentUnit * row.quantity), row.currentSource]
          : ['Non renseignée']
        const rowHeight = Math.max(10, articleLines.length * 3.7 + 4, valueLines.length * 3.5 + 4)

        if (y + rowHeight > pageHeight - 14) {
          pdf.addPage()
          drawPageHeading(false)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7.5)
        }

        if (index % 2 === 0) {
          pdf.setFillColor(247, 249, 252)
          pdf.rect(left, y, tableWidth, rowHeight, 'F')
        }
        pdf.setDrawColor(218, 225, 235)
        pdf.line(left, y + rowHeight, left + tableWidth, y + rowHeight)
        const values = [
          formatDate(row.purchase_date),
          articleLines,
          String(row.quantity),
          Number.isFinite(row.purchaseUnit) ? currency.format(row.purchaseUnit) : '—',
          Number.isFinite(row.purchaseUnit) ? currency.format(row.purchaseUnit * row.quantity) : '—'
        ]
        let x = left
        pdf.setTextColor(38, 53, 72)
        values.forEach((value, columnIndex) => {
          pdf.text(Array.isArray(value) ? value : String(value), x + 2, y + 5, { maxWidth: columns[columnIndex].width - 4 })
          x += columns[columnIndex].width
        })
        pdf.setFontSize(7)
        pdf.setTextColor(67, 87, 111)
        pdf.text(valueLines, x + 2, y + 5, { maxWidth: columns[5].width - 4 })
        pdf.setFontSize(7.5)
        y += rowHeight
      }

      for (let page = 1; page <= pdf.internal.getNumberOfPages(); page += 1) {
        pdf.setPage(page)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(116, 127, 141)
        pdf.text('PokéValeur · pokevaleur.fr', margin, pageHeight - 6)
        pdf.text('Page ' + page + ' / ' + pdf.internal.getNumberOfPages(), pageWidth - margin, pageHeight - 6, { align: 'right' })
      }

      pdf.save('pokevaleur-scelles-' + new Date().toISOString().slice(0, 10) + '.pdf')
    } catch (pdfError) {
      setError('La création du PDF a échoué : ' + (pdfError.message || 'réessaie dans un instant.'))
    } finally {
      setExporting(false)
    }
  }

  async function exportSealedExcel() {
    if (!rows.length || exportingExcel) return
    setExportingExcel(true)
    setError('')
    try {
      const XLSX = await import('xlsx')
      const alphabeticalRows = rows.map(row => ({ ...row, exportTitle: formatExcelProductTitle(row) })).sort((a, b) =>
        a.exportTitle.localeCompare(b.exportTitle, 'fr', { sensitivity: 'base', numeric: true })
          || String(a.id).localeCompare(String(b.id))
      )
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Nom du produit', 'Prix d’achat (€)', 'Valeur actuelle (€)'],
        ...alphabeticalRows.map(row => [
          row.exportTitle + (row.quantity > 1 ? ' ×' + row.quantity : ''),
          Number.isFinite(row.purchaseUnit) ? row.purchaseUnit : '',
          Number.isFinite(row.currentUnit) ? row.currentUnit * row.quantity : ''
        ])
      ])
      worksheet['!cols'] = [{ wch: 44 }, { wch: 18 }, { wch: 19 }]
      worksheet['!autofilter'] = { ref: 'A1:C' + (alphabeticalRows.length + 1) }
      for (let rowIndex = 2; rowIndex <= alphabeticalRows.length + 1; rowIndex += 1) {
        for (const column of ['B', 'C']) {
          const cell = worksheet[column + rowIndex]
          if (cell && typeof cell.v === 'number') cell.z = '#,##0.00 "€"'
        }
      }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Scellés')
      workbook.Props = { Title: 'Inventaire des produits scellés PokéValeur', Author: 'PokéValeur' }
      XLSX.writeFile(workbook, 'pokevaleur-scelles-' + new Date().toISOString().slice(0, 10) + '.xlsx', { compression: true })
    } catch (excelError) {
      setError('La création du fichier Excel a échoué : ' + (excelError.message || 'réessaie dans un instant.'))
    } finally {
      setExportingExcel(false)
    }
  }

  async function exportUnlinkedExcel() {
    if (!unlinkedRows.length || exportingUnlinkedExcel) return
    setExportingUnlinkedExcel(true)
    setError('')
    try {
      const XLSX = await import('xlsx')
      const alphabeticalRows = [...unlinkedRows].sort((a, b) =>
        a.title.localeCompare(b.title, 'fr', { sensitivity: 'base', numeric: true })
          || String(a.id).localeCompare(String(b.id))
      )
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Nom de l’article', 'Date d’achat'],
        ...alphabeticalRows.map(row => [row.title, formatDate(row.purchase_date)])
      ])
      worksheet['!cols'] = [{ wch: 56 }, { wch: 20 }]
      worksheet['!autofilter'] = { ref: 'A1:B' + (alphabeticalRows.length + 1) }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sans lien catalogue')
      workbook.Props = { Title: 'Articles sans lien au catalogue PokéValeur', Author: 'PokéValeur' }
      XLSX.writeFile(workbook, 'pokevaleur-sans-lien-catalogue-' + new Date().toISOString().slice(0, 10) + '.xlsx', { compression: true })
    } catch (excelError) {
      setError('La création du fichier Excel a échoué : ' + (excelError.message || 'réessaie dans un instant.'))
    } finally {
      setExportingUnlinkedExcel(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <a className={styles.backLink} href="/collection">← Ma collection</a>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Ma Collection</span>
          <h1>Import-Export</h1>
          <p>Gère les fichiers de ta collection et crée un inventaire à conserver ou à partager.</p>
        </header>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading ? (
          <section className={styles.panel}><p>Chargement de ta collection…</p></section>
        ) : (
          <>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Exporter mes scellés en PDF</h2>
                  <p>Un inventaire trié par date d’achat, avec les prix et les valeurs connus.</p>
                </div>
                <span className={styles.formatBadge}>PDF</span>
              </div>
              <div className={styles.summary}>
                <div><strong>{summary.copies}</strong><span>exemplaires</span></div>
                <div><strong>{summary.entries}</strong><span>lignes d’achat</span></div>
                <div><strong>{currency.format(summary.currentValue)}</strong><span>valeur connue · {summary.valuedCopies}/{summary.copies}</span></div>
              </div>
              {rows.length ? (
                <>
                  <p className={styles.note}>
                    Les dates non renseignées apparaissent à la fin. Chaque achat reste séparé si sa date ou son prix diffère ; la quantité d’une même entrée est conservée. Les valeurs actuelles viennent d’une valeur manuelle ou du catalogue PokéValeur.
                  </p>
                  <button className={styles.primaryButton} type="button" onClick={exportSealedPdf} disabled={exporting}>
                    {exporting ? 'Création du PDF…' : 'Télécharger le PDF de mes scellés'}
                  </button>
                </>
              ) : (
                <p className={styles.empty}>Aucun produit scellé à exporter dans le profil « {profileName} ».</p>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Exporter mes scellés en Excel</h2>
                  <p>Une liste compacte, classée par ordre alphabétique.</p>
                </div>
                <span className={styles.formatBadge}>Excel</span>
              </div>
              {rows.length ? (
                <>
                  <p className={styles.note}>
                    Une ligne par entrée de collection. Le prix d’achat reprend le montant enregistré; la quantité apparaît dans le nom et la valeur actuelle tient compte des exemplaires.
                  </p>
                  <button className={styles.primaryButton} type="button" onClick={exportSealedExcel} disabled={exportingExcel}>
                    {exportingExcel ? 'Création du fichier Excel…' : 'Télécharger l’Excel de mes scellés'}
                  </button>
                </>
              ) : (
                <p className={styles.empty}>Aucun produit scellé à exporter dans le profil « {profileName} ».</p>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Exporter les scellés sans lien au catalogue</h2>
                  <p>Un fichier Excel avec le nom et la date d’achat, trié par ordre alphabétique.</p>
                </div>
                <span className={styles.formatBadge}>Excel</span>
              </div>
              {unlinkedRows.length ? (
                <>
                  <p className={styles.note}>
                    Une ligne par entrée sans fiche catalogue liée. La quantité n’est pas incluse dans cet export.
                  </p>
                  <button className={styles.primaryButton} type="button" onClick={exportUnlinkedExcel} disabled={exportingUnlinkedExcel}>
                    {exportingUnlinkedExcel ? 'Création du fichier Excel…' : 'Télécharger l’Excel des scellés sans lien'}
                  </button>
                </>
              ) : (
                <p className={styles.empty}>Aucun article sans lien catalogue dans le profil « {profileName} ».</p>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Importer une collection</h2>
                  <p>Accède à l’import de fichier Excel déjà disponible dans PokéValeur.</p>
                </div>
                <span className={styles.formatBadge}>Excel</span>
              </div>
              <a className={styles.secondaryButton} href="/collection/import">Ouvrir l’import Excel →</a>
            </section>

          </>
        )}
      </div>
    </main>
  )
}
