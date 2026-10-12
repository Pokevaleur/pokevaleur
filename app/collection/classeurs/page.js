'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'
import styles from './binders.module.css'

const MCDONALDS_BINDER_ID = 'mcdonalds'
// Dedicated scan of the actual Pokémon Day stamp variant; regular TCGdex art for #074 omits the stamp.
const POKEMON_DAY_STAMP_IMAGE = 'https://www.dealicash.fr/images/tag-67/evoli-074-131-promo-stamp-scelle-pokemon-ev8-5-evolution-prismatique-fr-670763-1-l.webp'

function shortCode(set) {
  if (set?.id === MCDONALDS_BINDER_ID) return 'MCD'
  const code = String(set?.set_code || '').trim().toUpperCase()
  const match = code.match(/^(?:SWSH|EB|SV|EV|ME|SM|SL|XY|BW|DP|PL|HGSS)[\s-]*(\d+(?:\.\d+)?)([A-Z]*)$/)
  if (match) {
    const prefix = /^(?:SWSH|EB)/.test(code) ? 'EB' : /^(?:SV|EV)/.test(code) ? 'EV' : /^ME/.test(code) ? 'ME' : /^SM/.test(code) ? 'SL' : (code.match(/^[A-Z]+/) || [''])[0]
    const number = Number(match[1])
    return prefix + (prefix === 'EB' && number < 10 ? '0' : '') + number + match[2]
  }
  return code || 'SÉRIE'
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
}

function isMcDonaldsSet(set) {
  const family = normalize(set?.series_name)
  const name = normalize(set?.set_name)
  return family.includes('mcdonald') || name.includes('mcdonald')
}

function setYear(set) {
  const fromDate = set?.release_date ? new Date(set.release_date + 'T00:00:00').getFullYear() : NaN
  return Number.isFinite(fromDate) ? fromDate : Number(String(set?.set_name || '').match(/20\d{2}/)?.[0]) || 0
}


const GENERATED_COVER_ALIASES = [["mascarade crepusculaire","mascarade-crepusculaire"],["evolutions prismatiques","evolutions-prismatiques"],["ecarlate et violet 151","ecarlate-violet-151"],["etincelles deferlantes","etincelles-deferlantes"],["alliance infaillible","alliance-infaillible"],["harmonie des esprits","harmonie-des-esprits"],["flammes obsidiennes","flammes-obsidiennes"],["destinees radieuses","destinees-radieuses"],["evolutions a paldea","evolution-a-paldea"],["rivalites destinees","rivalites-destinees"],["gardiens ascendants","gardiens-ascendants"],["evolutions celestes","evolutions-celestes"],["majeste des dragons","majeste-des-dragons"],["heros transcendants","heros-transcendants"],["forces temporelles","forces-temporelles"],["couronne stellaire","couronne-stellaire"],["evolution a paldea","evolution-a-paldea"],["stars etincelantes","stars-etincelantes"],["tenebres embrasees","tenebres-embrasees"],["aventures ensemble","aventures-ensemble"],["clash des rebelles","clash-des-rebelles"],["lumiere interdite","lumiere-interdite"],["vigueur spectrale","vigueur-spectrale"],["origines antiques","origines-antiques"],["tempete argentee","tempete-argentee"],["voltage eclatant","voltage-eclatant"],["offensive vapeur","offensive-vapeur"],["eclipse cosmique","eclipse-cosmique"],["epee et bouclier","epee-et-bouclier"],["styles de combat","styles-de-combat"],["faille paradoxe","faille-paradoxe"],["tempete celeste","tempete-celeste"],["poing de fusion","poing-de-fusion"],["ombres ardentes","ombres-ardentes"],["impulsion turbo","impulsion-turbo"],["invasion carmin","invasion-carmin"],["fable nebuleuse","fable-nebuleuse"],["astres radieux","astres-radieux"],["origine perdue","origine-perdue"],["tonnerre perdu","tonnerre-perdu"],["voie du maitre","voie-du-maitre"],["flamme blanche","flamme-blanche"],["regne de glace","regne-de-glace"],["soleil et lune","soleil-et-lune"],["poings furieux","poings-furieux"],["ciel rugissant","ciel-rugissant"],["mega evolution","mega-evolution"],["zenith supreme","zenith-supreme-variante"],["rupture turbo","rupture-turbo"],["foudre noire","foudre-noire"],["celebrations","celebrations"],["ultra prisme","ultra-prisme"],["duo de choc","duo-de-choc"],["generations","generations"],["pokemon go","pokemon-go"],["primo choc","primo-choc"],["etincelles","etincelles-xy"],["evolutions","evolutions-xy"],["151","ecarlate-violet-151"],["xy","xy"]]

function generatedCoverFor(set) {
  const name = normalize(set?.set_name).replace(/[^a-z0-9]+/g, ' ').trim()
  const code = shortCode(set)
  if (set?.id === MCDONALDS_BINDER_ID || (code === 'MCD' && name.includes('mcdonald'))) return '/binder-covers/mcdonalds-collection.webp'
  if (code === 'ME2' || name.includes('flammes fantasmagoriques')) return '/binder-covers/flammes-fantasmagoriques.webp'
  if (code === 'EV4.5' || name.includes('destinees de paldea')) return '/binder-covers/destinees-de-paldea.webp'
  if (code === 'MEP') return '/binder-covers/mega-evolution.webp'
  if (name === 'ecarlate et violet' || code === 'EV1') return '/binder-covers/ecarlate-et-violet.webp'
  if (name === 'xy' || code === 'XY1') return '/binder-covers/xy.webp'
  const match = GENERATED_COVER_ALIASES.find(([alias]) => name.includes(alias))
  return match ? '/binder-covers/' + match[1] + '.webp' : ''
}

function colorFor(value) {
  const colors = [['#6d5bd0', '#b4a6ff'], ['#c45d57', '#efb39b'], ['#258b83', '#a5dfd4'], ['#4275bb', '#a4c8f0'], ['#b17a28', '#ead18d'], ['#ac5c9a', '#e4acd5']]
  const hash = Array.from(String(value || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function imageFor(card) {
  return card?.image_url || card?.image_source_url || ''
}

function imageCandidatesFor(source) {
  if (!source) return []
  const candidates = [source]
  if (source.includes('assets.tcgdex.net/')) {
    const high = source.replace(/\\/low\\.(webp|png|jpg)$/i, '/high.$1')
    const english = source.replace('/fr/', '/en/')
    const englishHigh = high.replace('/fr/', '/en/')
    candidates.push(high, english, englishHigh)
  }
  return [...new Set(candidates)]
}

function CardArtwork({ card, alt, className, loading = 'lazy', src }) {
  const primary = src || imageFor(card)
  const fallbacks = src && src !== imageFor(card) ? imageCandidatesFor(imageFor(card)) : []
  const candidates = [...new Set([...imageCandidatesFor(primary), ...fallbacks])]
  const [candidateIndex, setCandidateIndex] = useState(0)
  if (!candidates.length || candidateIndex >= candidates.length) {
    return <span className={className} role=\"img\" aria-label={alt}>Illustration indisponible</span>
  }
  return <img
    className={className}
    src={candidates[candidateIndex]}
    alt={alt}
    loading={loading}
    onError={() => setCandidateIndex(index => index + 1)}
  />
}

function cardSetFor(card) {
  return Array.isArray(card?.card_sets) ? card.card_sets[0] : card?.card_sets
}

function pdfVariantLabel(variant) {
  const key = String(variant?.variant_key || '').toLocaleLowerCase('fr')
  const known = {
    standard: 'Normale', normal: 'Normale', reverse: 'Reverse', holo: 'Holo', holofoil: 'Holo',
    reverse_pokeball: 'Reverse Poké Ball', reverse_masterball: 'Reverse Master Ball',
    holo_cosmos: 'Holo Cosmos', cosmos_holo: 'Holo Cosmos', holo_galaxy: 'Holo Galaxy'
  }
  return known[key] || variant?.variant_label || variant?.variant_key || variant?.finish_code || 'Variante'
}

function isJumboVariant(variant) {
  const label = String(variant?.variant_label || '')
  const key = String(variant?.variant_key || '')
  return variant?.checklist_group === 'jumbo' || /^jumbo(?:_|$)/i.test(key) || /jumbo|grand format/i.test(label)
}

function binderExtraLabel(item) {
  if (item?.category === 'promo') return 'Promo SVP ' + String(item.card?.collector_number || '').replace(/^SVP\s*/i, '')
  if (item?.category === 'stamp') return item.variant?.variant_label || 'Carte tampon'
  return pdfVariantLabel(item?.variant)
}

function bonusCatalogImageFor(item) {
  if (item?.category === 'stamp' || item?.variant?.checklist_group === 'stamp') return POKEMON_DAY_STAMP_IMAGE
  return item?.card?.image_url || ''
}

function BonusCatalogImageDialog({ card, label, imageUrl, onClose }) {
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return <div className={styles.bonusZoomBackdrop} onClick={onClose}>
    <section className={styles.bonusZoomDialog} role="dialog" aria-modal="true" aria-labelledby="bonus-zoom-title" onClick={event => event.stopPropagation()}>
      <button type="button" className={styles.bonusZoomClose} onClick={onClose} aria-label="Fermer l’agrandissement">×</button>
      <p className={styles.kicker}>Catalogue · {label}</p>
      <h2 id="bonus-zoom-title">{card.card_name} · {card.collector_number}</h2>
      <CardArtwork card={card} src={imageUrl} className={styles.bonusZoomImage} alt={card.category === 'stamp' ? 'Carte avec tampon Pokémon Day' : card.card_name + ', ' + label} loading="eager" />
    </section>
  </div>
}

function binderVariantsForItem(item) {
  if (item?.kind === 'extra') return item.variant ? [item.variant] : []
  return (item?.card?.card_print_variants || []).filter(variant => variant.is_master_set_target && !isJumboVariant(variant))
}

function binderCopiesForItem(item, variantCopies) {
  return binderVariantsForItem(item).flatMap(variant => (variantCopies[variant.id] || []).map(copy => ({
    ...copy,
    variantLabel: variant.variant_label || variant.variant_key || '',
  })))
}

function loadPdfImage(url) {
  if (!url) return Promise.resolve(null)
  return new Promise(resolve => {
    const image = new Image()
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(value)
    }
    const timeout = window.setTimeout(() => finish(null), 12000)
    try {
      if (new URL(url, window.location.href).origin !== window.location.origin) image.crossOrigin = 'anonymous'
    } catch { /* Let the browser try relative and data URLs as supplied. */ }
    image.onload = () => {
      try {
        const maxSide = 520
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) return finish(null)
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        finish({ data: canvas.toDataURL('image/jpeg', 0.82), width: canvas.width, height: canvas.height })
      } catch { finish(null) }
    }
    image.onerror = () => finish(null)
    try { image.src = url } catch { finish(null) }
  })
}

async function createBinderPdf({ set, cards, extraVariants = [], binderSections = null, variantCopies, coverArt, profileName, ownerDisplayName, profileCreatedAt, ownedOnSet, copiesOnSet, missingOnSet, onProgress }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const coverImage = await loadPdfImage(coverArt)
  const dateLabel = new Date().toLocaleDateString('fr-FR')
  const seriesCode = shortCode(set)
  const title = 'PokéValeur - ' + seriesCode + ' - ' + set.set_name
  pdf.setProperties({ title, subject: 'Classeur de cartes Pokémon', author: ownerDisplayName || 'PokéValeur', creator: 'PokéValeur' })

  pdf.setFillColor(16, 31, 57)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')
  pdf.setFillColor(245, 184, 46)
  pdf.rect(0, 0, pageWidth, 7, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('POKÉVALEUR · CLASSEUR', pageWidth / 2, 20, { align: 'center' })

  const artBox = { x: 17, y: 32, w: pageWidth - 34, h: 192 }
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(artBox.x, artBox.y, artBox.w, artBox.h, 5, 5, 'F')
  if (coverImage) {
    const aspect = coverImage.width / coverImage.height
    const boxAspect = artBox.w / artBox.h
    const drawW = aspect > boxAspect ? artBox.w : artBox.h * aspect
    const drawH = aspect > boxAspect ? artBox.w / aspect : artBox.h
    pdf.addImage(coverImage.data, 'JPEG', artBox.x + (artBox.w - drawW) / 2, artBox.y + (artBox.h - drawH) / 2, drawW, drawH, 'binder-cover', 'FAST')
  } else {
    pdf.setTextColor(23, 60, 115)
    pdf.setFontSize(30)
    pdf.text(seriesCode, pageWidth / 2, artBox.y + artBox.h / 2, { align: 'center' })
  }
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  const coverTitle = pdf.splitTextToSize(set.set_name, pageWidth - 36)
  pdf.text(coverTitle.slice(0, 2), pageWidth / 2, 244, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(seriesCode + (set.release_date ? ' · ' + new Date(set.release_date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : ''), pageWidth / 2, 260, { align: 'center' })
  pdf.text(ownedOnSet + ' cartes possédées · ' + copiesOnSet + ' exemplaires · ' + missingOnSet + ' emplacements à compléter', pageWidth / 2, 270, { align: 'center' })
  if (extraVariants.length) {
    pdf.setFontSize(9)
    pdf.text('Hors Master Set · ' + extraVariants.length + ' versions', pageWidth / 2, 276, { align: 'center' })
  }
  pdf.setFontSize(9)
  pdf.text('Propriétaire : ' + (ownerDisplayName || 'Pseudo non renseigné'), pageWidth / 2, 280, { align: 'center' })
  pdf.setFontSize(8)
  pdf.text('Collection « ' + (profileName || 'Ma collection') + ' »' + (profileCreatedAt ? ' · créée le ' + new Date(profileCreatedAt).toLocaleDateString('fr-FR') : ''), pageWidth / 2, 284, { align: 'center' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('pokevaleur.fr', pageWidth / 2, 289, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('Exporté le ' + dateLabel, pageWidth / 2, 294, { align: 'center' })

  const cardsPerPage = 12
  const masterPageCount = cards.length ? Math.ceil(cards.length / cardsPerPage) : (extraVariants.length ? 0 : 1)
  const extraPageCount = Math.ceil(extraVariants.length / cardsPerPage)
  const sectionPages = binderSections?.length ? binderSections.flatMap(section => {
    const pages = []
    const masterCount = Math.ceil(section.cards.length / cardsPerPage)
    const outsideCount = Math.ceil(section.extras.length / cardsPerPage)
    for (let index = 0; index < masterCount; index += 1) {
      pages.push({ kind: 'master', section, index, count: masterCount,
        items: section.cards.slice(index * cardsPerPage, (index + 1) * cardsPerPage).map(card => ({ kind: 'master', card })) })
    }
    for (let index = 0; index < outsideCount; index += 1) {
      pages.push({ kind: 'extra', section, index, count: outsideCount,
        items: section.extras.slice(index * cardsPerPage, (index + 1) * cardsPerPage).map(item => ({ kind: 'extra', ...item })) })
    }
    return pages
  }) : null
  const totalPages = Math.max(1, sectionPages?.length || masterPageCount + extraPageCount)
  const marginX = 9
  const gridTop = 28
  const gridBottom = 285
  const gridWidth = pageWidth - marginX * 2
  const cellWidth = gridWidth / 3
  const cellHeight = (gridBottom - gridTop) / 4
  const overflowDetails = []

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const sectionPage = sectionPages?.[pageIndex]
    const isExtraPage = sectionPage ? sectionPage.kind === 'extra' : extraPageCount > 0 && pageIndex >= masterPageCount
    pdf.addPage('a4', 'portrait')
    pdf.setFillColor(249, 250, 252)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')
    pdf.setTextColor(23, 47, 78)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    const sectionLabel = sectionPage?.section.set.set_name
    pdf.text(isExtraPage
      ? 'Hors Master Set · ' + (sectionPage?.section.extras.length ?? extraVariants.length) + ' versions' + (sectionLabel ? ' · ' + sectionLabel : '')
      : sectionLabel || set.set_name, marginX, 14)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(isExtraPage
      ? 'Page ' + (sectionPage ? sectionPage.index + 1 : pageIndex - masterPageCount + 1) + '/' + (sectionPage?.count || extraPageCount)
      : (sectionPage ? shortCode(sectionPage.section.set) + ' · ' : seriesCode + ' · ') + 'Page ' + (sectionPage ? sectionPage.index + 1 : pageIndex + 1) + '/' + (sectionPage?.count || masterPageCount), pageWidth - marginX, 14, { align: 'right' })
    pdf.setDrawColor(210, 219, 229)
    pdf.line(marginX, 19, pageWidth - marginX, 19)
    onProgress('Création du PDF : page ' + (pageIndex + 1) + ' sur ' + totalPages + '…')

    const pageItems = sectionPage ? sectionPage.items : isExtraPage
      ? extraVariants.slice((pageIndex - masterPageCount) * cardsPerPage, (pageIndex - masterPageCount + 1) * cardsPerPage).map(item => ({ kind: 'extra', ...item }))
      : cards.slice(pageIndex * cardsPerPage, (pageIndex + 1) * cardsPerPage).map(card => ({ kind: 'master', card }))
    const images = await Promise.all(pageItems.map(item => loadPdfImage(binderCopiesForItem(item, variantCopies).length ? imageFor(item.card) : '')))
    pageItems.forEach((item, cardIndex) => {
      const card = item.card
      const column = cardIndex % 3
      const row = Math.floor(cardIndex / 3)
      const x = marginX + column * cellWidth + 2
      const y = gridTop + row * cellHeight + 1.5
      const w = cellWidth - 4
      const h = cellHeight - 3
      const ownedCopies = binderCopiesForItem(item, variantCopies)
      const ownedVariants = binderVariantsForItem(item).map(variant => ({ variant, count: (variantCopies[variant.id] || []).length })).filter(variant => variant.count > 0)
      const missingVariants = binderVariantsForItem(item).filter(variant => !(variantCopies[variant.id] || []).length)

      pdf.setFillColor(ownedCopies.length ? 255 : 232, ownedCopies.length ? 253 : 237, ownedCopies.length ? 245 : 243)
      pdf.setDrawColor(ownedCopies.length ? 165 : 150, ownedCopies.length ? 191 : 161, ownedCopies.length ? 174 : 174)
      pdf.roundedRect(x, y, w, h, 2.5, 2.5, 'FD')
      const imageData = images[cardIndex]
      if (imageData && ownedCopies.length) {
        const imageBox = { x: x + (w - 25) / 2, y: y + 2, w: 25, h: 35 }
        const aspect = imageData.width / imageData.height
        const drawW = aspect > imageBox.w / imageBox.h ? imageBox.w : imageBox.h * aspect
        const drawH = aspect > imageBox.w / imageBox.h ? imageBox.w / aspect : imageBox.h
        pdf.addImage(imageData.data, 'JPEG', imageBox.x + (imageBox.w - drawW) / 2, imageBox.y + (imageBox.h - drawH) / 2, drawW, drawH, undefined, 'FAST')
      }

      pdf.setTextColor(31, 48, 67)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.2)
      const nameLines = ownedCopies.length ? pdf.splitTextToSize(card.card_name || 'Carte sans nom', w - 6).slice(0, 2) : []
      if (nameLines.length) pdf.text(nameLines, x + 3, y + 41)
      const numberY = y + 41 + nameLines.length * 3.1 + 1
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.6)
      pdf.text('N° ' + (card.collector_number || '—'), x + 3, numberY)

      if (item.kind === 'extra') {
        pdf.setFont('helvetica', ownedCopies.length ? 'normal' : 'bold')
        pdf.setFontSize(5.8)
        pdf.setTextColor(ownedCopies.length ? 46 : 105, ownedCopies.length ? 95 : 71, ownedCopies.length ? 72 : 41)
        const extraLabel = pdf.splitTextToSize(binderExtraLabel(item) + ' · HORS MASTER SET', w - 6).slice(0, 2)
        pdf.text(extraLabel, x + 3, numberY + 3.2)
      }
      if (ownedCopies.length) {
        const lines = []
        if (item.kind === 'extra') {
          lines.push('Possédée · ×' + ownedCopies.length)
        } else {
          for (const ownedVariant of ownedVariants) {
            const label = pdfVariantLabel(ownedVariant.variant) + ' ×' + ownedVariant.count
            lines.push(...pdf.splitTextToSize(label, w - 6))
          }
        }
        if (lines.length > 4) {
          overflowDetails.push({ number: card.collector_number, name: card.card_name, variants: ownedVariants })
          lines.splice(4, lines.length - 4, 'Détails des variantes en fin de PDF')
        }
        pdf.setTextColor(42, 83, 61)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(5.6)
        pdf.text(lines, x + 3, Math.min(numberY + 3.5, y + h - 10), { lineHeightFactor: 1.05 })
      } else {
        pdf.setTextColor(113, 58, 37)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(6.5)
        pdf.text('À COMPLÉTER', x + 3, numberY + (item.kind === 'extra' ? 8 : 4))
      }
      if (item.kind === 'master' && missingVariants.length && ownedCopies.length) {
        pdf.setTextColor(137, 86, 34)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(5.2)
        const missingLabel = pdf.splitTextToSize('Manquantes : ' + missingVariants.map(pdfVariantLabel).join(', '), w - 6).slice(0, 2)
        pdf.text(missingLabel, x + 3, y + h - 5)
      }
    })
    pdf.setTextColor(91, 105, 122)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.text('PokéValeur · pokevaleur.fr', marginX, 291)
    pdf.text('Classeur ' + (pageIndex + 1) + '/' + totalPages, pageWidth - marginX, 291, { align: 'right' })
  }

  if (overflowDetails.length) {
    onProgress('Ajout du détail des variantes possédées…')
    let detailPage = 0
    let detailY = Infinity
    function startDetailPage() {
      pdf.addPage('a4', 'portrait')
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      pdf.setTextColor(23, 47, 78)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text('Détail des variantes possédées', marginX, 16)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(set.set_name + ' · Suite ' + (detailPage + 1), marginX, 22)
      pdf.setTextColor(91, 105, 122)
      pdf.setFontSize(7.5)
      pdf.text('PokéValeur · pokevaleur.fr', marginX, 291)
      detailPage += 1
      detailY = 32
    }
    for (const row of overflowDetails) {
      const variantText = row.variants.map(item => binderExtraLabel(item) + ' ×' + item.count).join(' · ')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      const wrapped = pdf.splitTextToSize('N° ' + row.number + ' · ' + row.name + ' : ' + variantText, pageWidth - marginX * 2)
      const rowHeight = Math.max(7, wrapped.length * 3.5)
      if (detailY + rowHeight > 284) startDetailPage()
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(45, 61, 80)
      pdf.text(wrapped, marginX, detailY)
      detailY += rowHeight
    }
  }

  return pdf
}


const CARD_CONDITIONS = [
  { value: 'near_mint', label: 'Quasi neuve' },
  { value: 'excellent', label: 'Très bon état' },
  { value: 'good', label: 'Bon état' },
  { value: 'played', label: 'Jouée' },
  { value: 'damaged', label: 'Abîmée' },
  { value: 'unassessed', label: 'À évaluer' },
]

function CardCopyDialog({ supabase, user, profileId, card, copies, onClose }) {
  const [selectedCopyId, setSelectedCopyId] = useState(copies[0]?.id || '')
  const [photos, setPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [condition, setCondition] = useState(copies[0]?.raw_condition || '')
  const [conditionDetails, setConditionDetails] = useState(copies[0]?.condition_details || '')
  const [message, setMessage] = useState('')
  const [localCopies, setLocalCopies] = useState(copies)
  const selectedCopy = localCopies.find(copy => copy.id === selectedCopyId) || localCopies[0]

  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    setCondition(selectedCopy?.raw_condition || '')
    setConditionDetails(selectedCopy?.condition_details || '')
  }, [selectedCopyId])

  useEffect(() => {
    if (!selectedCopy) return
    let cancelled = false
    setPhotosLoading(true)
    async function loadPhotos() {
      try {
        const { data, error } = await supabase.from('collection_card_photos')
          .select('id,photo_path,caption,sort_order').eq('collection_card_id', selectedCopy.id)
          .order('sort_order').order('created_at')
        if (error) throw error
        const rows = [...(data || [])]
        if (selectedCopy.photo_path && !rows.some(photo => photo.photo_path === selectedCopy.photo_path)) {
          rows.unshift({ id: null, photo_path: selectedCopy.photo_path, caption: 'Photo déjà enregistrée', sort_order: -1 })
        }
        const signedRows = await Promise.all(rows.map(async photo => {
          const { data: signed, error: signedError } = await supabase.storage
            .from('collection-images').createSignedUrl(photo.photo_path, 3600)
          if (signedError) throw signedError
          return { ...photo, url: signed?.signedUrl || null }
        }))
        if (!cancelled) setPhotos(signedRows)
      } catch (error) {
        if (!cancelled) setMessage('Impossible de charger les photos : ' + (error.message || 'réessaie plus tard.'))
      } finally {
        if (!cancelled) setPhotosLoading(false)
      }
    }
    loadPhotos()
    return () => { cancelled = true }
  }, [supabase, selectedCopyId, selectedCopy?.photo_path])

  async function saveCondition() {
    if (!selectedCopy || saving) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('collection_cards').update({
      raw_condition: condition || null,
      condition_details: conditionDetails.trim() || null,
    }).eq('id', selectedCopy.id).eq('collection_profile_id', profileId)
    setSaving(false)
    if (!error) setLocalCopies(previous => previous.map(copy => copy.id === selectedCopy.id
      ? { ...copy, raw_condition: condition || null, condition_details: conditionDetails.trim() || null } : copy))
    setMessage(error ? 'État non enregistré : ' + error.message : 'État enregistré.')
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || !selectedCopy) return
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
    const invalid = files.find(file => !allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024)
    if (invalid) {
      setMessage('Choisis des photos JPG, PNG ou WebP de 8 Mo maximum chacune.')
      return
    }

    setUploading(true)
    setMessage('')
    const uploadedPaths = []
    let linked = false
    try {
      for (const file of files) {
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
        const path = user.id + '/' + profileId + '/' + selectedCopy.id + '/' + window.crypto.randomUUID() + '.' + extension
        const { error } = await supabase.storage.from('collection-images').upload(path, file, {
          cacheControl: '3600', contentType: file.type, upsert: false,
        })
        if (error) throw error
        uploadedPaths.push(path)
      }

      const nextOrder = photos.length ? Math.max(...photos.map(photo => photo.sort_order || 0)) + 1 : 0
      const { error: insertError } = await supabase.from('collection_card_photos').insert(
        uploadedPaths.map((photoPath, index) => ({
          user_id: user.id, collection_profile_id: profileId, collection_card_id: selectedCopy.id,
          photo_path: photoPath, sort_order: nextOrder + index,
        }))
      )
      if (insertError) throw insertError
      linked = true

      if (!selectedCopy.photo_path && uploadedPaths[0]) {
        const { error: primaryError } = await supabase.from('collection_cards')
          .update({ photo_path: uploadedPaths[0] }).eq('id', selectedCopy.id)
        if (primaryError) setMessage('Photos ajoutées, mais la photo principale n’a pas pu être mise à jour.')
        else setLocalCopies(previous => previous.map(copy => copy.id === selectedCopy.id ? { ...copy, photo_path: uploadedPaths[0] } : copy))
      }
      const { data: rows, error: galleryError } = await supabase.from('collection_card_photos')
        .select('id,photo_path,caption,sort_order').eq('collection_card_id', selectedCopy.id)
        .order('sort_order').order('created_at')
      if (galleryError) throw galleryError
      const signedRows = await Promise.all((rows || []).map(async photo => {
        const { data: signed } = await supabase.storage.from('collection-images').createSignedUrl(photo.photo_path, 3600)
        return { ...photo, url: signed?.signedUrl || null }
      }))
      setPhotos(signedRows)
      setMessage(files.length + (files.length > 1 ? ' nouvelles photos ajoutées.' : ' photo ajoutée.'))
    } catch (error) {
      if (!linked && uploadedPaths.length) await supabase.storage.from('collection-images').remove(uploadedPaths)
      setMessage('Envoi impossible : ' + (error.message || 'réessaie.'))
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto(photo) {
    if (!selectedCopy || uploading) return
    setUploading(true)
    setMessage('')
    try {
      if (photo.id) {
        const { error } = await supabase.from('collection_card_photos').delete().eq('id', photo.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('collection_cards').update({ photo_path: null }).eq('id', selectedCopy.id)
        if (error) throw error
      }
      const { error: removeError } = await supabase.storage.from('collection-images').remove([photo.photo_path])
      const nextPhotos = photos.filter(entry => entry.photo_path !== photo.photo_path)
      if (selectedCopy.photo_path === photo.photo_path) {
        const nextPrimary = nextPhotos[0]?.photo_path || null
        const { error: primaryError } = await supabase.from('collection_cards')
          .update({ photo_path: nextPrimary }).eq('id', selectedCopy.id)
        if (primaryError) throw primaryError
        setLocalCopies(previous => previous.map(copy => copy.id === selectedCopy.id ? { ...copy, photo_path: nextPrimary } : copy))
      }
      setPhotos(nextPhotos)
      setMessage(removeError ? 'Photo retirée de la fiche, mais le fichier n’a pas pu être supprimé.' : 'Photo supprimée.')
    } catch (error) {
      setMessage('Suppression impossible : ' + (error.message || 'réessaie.'))
    } finally {
      setUploading(false)
    }
  }

  async function removeSelectedCopy() {
    if (!selectedCopy || deleting || saving || uploading) return
    const copyIndex = localCopies.findIndex(copy => copy.id === selectedCopy.id)
    const copyDescription = 'l’exemplaire ' + (copyIndex + 1) + ' de ' + card.card_name +
      ' (N° ' + card.collector_number + (selectedCopy.variantLabel ? ', variante ' + selectedCopy.variantLabel : '') + ')'
    if (!window.confirm('Retirer ' + copyDescription + ' de ta collection ? Les autres exemplaires et la fiche du catalogue resteront en place.')) return

    setDeleting(true)
    setMessage('')
    try {
      const { data: photoRows, error: photosError } = await supabase.from('collection_card_photos')
        .select('photo_path').eq('collection_card_id', selectedCopy.id)
      if (photosError) throw photosError

      const { data: deletedRow, error } = await supabase.from('collection_cards').delete()
        .eq('id', selectedCopy.id).eq('collection_profile_id', profileId).select('id').maybeSingle()
      if (error) throw error
      if (!deletedRow) throw new Error('Cet exemplaire n’a pas été trouvé dans le profil sélectionné.')

      const photoPaths = [...new Set([selectedCopy.photo_path, ...(photoRows || []).map(photo => photo.photo_path)].filter(Boolean))]
      let photoCleanupFailed = false
      if (photoPaths.length) {
        const { error: storageError } = await supabase.storage.from('collection-images').remove(photoPaths)
        photoCleanupFailed = Boolean(storageError)
      }

      const nextCopies = localCopies.filter(copy => copy.id !== selectedCopy.id)
      setLocalCopies(nextCopies)
      onCopyDeleted(selectedCopy)
      if (nextCopies.length) {
        const nextIndex = Math.min(copyIndex, nextCopies.length - 1)
        setSelectedCopyId(nextCopies[nextIndex].id)
      } else {
        onClose()
      }
      setMessage(photoCleanupFailed
        ? 'Exemplaire retiré de la collection, mais ses photos n’ont pas toutes pu être supprimées.'
        : 'Exemplaire retiré de la collection.')
    } catch (error) {
      setMessage('Suppression impossible : ' + (error.message || 'réessaie plus tard.'))
    } finally {
      setDeleting(false)
    }
  }

  const conditionIsCustom = condition && !CARD_CONDITIONS.some(option => option.value === condition)
  return (
    <div className={styles.detailBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className={styles.cardDetailDialog} role="dialog" aria-modal="true" aria-label={'Détail de ' + card.card_name}>
        <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Fermer">×</button>
        <header className={styles.detailHeader}>
          <div>
            <p className={styles.kicker}>Fiche de collection</p>
            <h2>{card.card_name}</h2>
            <p>{card.setName} · N° {card.collector_number}</p>
            <p className={styles.detailVariant}>Variante sélectionnée : <strong>{selectedCopy?.variantLabel || 'Non précisée'}</strong></p>
          </div>
          <span className={styles.detailCopyCount}>{localCopies.length} exemplaire{localCopies.length > 1 ? 's' : ''}</span>
        </header>

        <div className={styles.detailLayout}>
          <figure className={styles.detailCatalogArt}>
            <CardArtwork card={card} alt={'Illustration catalogue de ' + card.card_name} loading="eager" />
            <figcaption>Illustration du catalogue</figcaption>
          </figure>

          <div className={styles.detailContent}>
            {localCopies.length > 1 && <div className={styles.copyTabs} role="tablist" aria-label="Choisir un exemplaire">
              {localCopies.map((copy, index) => <button key={copy.id} type="button" role="tab"
                aria-selected={copy.id === selectedCopy?.id} className={copy.id === selectedCopy?.id ? styles.copyTabActive : styles.copyTab}
                onClick={() => { setMessage(''); setSelectedCopyId(copy.id) }}>
                Exemplaire {index + 1}{copy.variantLabel ? ' · ' + copy.variantLabel : ''}{copy.raw_condition ? ' · ' + (CARD_CONDITIONS.find(option => option.value === copy.raw_condition)?.label || copy.raw_condition) : ''}
              </button>)}
            </div>}

            <section className={styles.conditionPanel} aria-label="État de l’exemplaire">
              <h3>État de cet exemplaire</h3>
              <label className={styles.detailField}>État général
                <select value={condition} onChange={event => setCondition(event.target.value)}>
                  <option value="">À préciser</option>
                  {conditionIsCustom && <option value={condition}>{condition}</option>}
                  {CARD_CONDITIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className={styles.detailField}>Détails
                <textarea value={conditionDetails} onChange={event => setConditionDetails(event.target.value)}
                  rows={2} maxLength={500} placeholder="Ex. petit blanchiment au dos, coin légèrement marqué…" />
              </label>
              <button type="button" className={styles.detailSave} onClick={saveCondition} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer l’état'}
              </button>
              <button type="button" className={styles.detailDelete} onClick={removeSelectedCopy} disabled={saving || uploading || deleting}>
                {deleting ? 'Suppression…' : 'Retirer cet exemplaire de ma collection'}
              </button>
            </section>

            <section className={styles.photoPanel} aria-label="Photos personnelles">
              <div className={styles.photoPanelHeading}>
                <div><h3>Photos de ton exemplaire</h3><p>Recto, verso et détails</p></div>
                <label className={styles.photoAddButton}>
                  {uploading ? 'Envoi…' : '＋ Ajouter'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading}
                    onChange={uploadPhotos} aria-label="Ajouter des photos de cet exemplaire" />
                </label>
              </div>
              {photosLoading ? <p className={styles.photoMessage}>Chargement des photos…</p> : photos.length ? (
                <div className={styles.photoGrid}>
                  {photos.map((photo, index) => <figure key={photo.id || photo.photo_path} className={styles.photoItem}>
                    {photo.url ? <img src={photo.url} alt={photo.caption || 'Photo ' + (index + 1) + ' de ' + card.card_name} /> : <span>Photo indisponible</span>}
                    <figcaption>{photo.caption || 'Photo ' + (index + 1)}</figcaption>
                    <button type="button" onClick={() => removePhoto(photo)} disabled={uploading}
                      aria-label={'Supprimer la photo ' + (index + 1)}>Supprimer</button>
                  </figure>)}
                </div>
              ) : <p className={styles.photoMessage}>Aucune photo personnelle pour cet exemplaire.</p>}
              <p className={styles.photoHint}>JPG, PNG ou WebP · 8 Mo maximum par photo</p>
            </section>
            {message && <p className={styles.detailMessage} role="status">{message}</p>}
          </div>
        </div>
      </section>
    </div>
  )
}


function BackLink({ href, children = '← Retour' }) {
  return <a className={styles.backLink} href={href}>{children}</a>
}

function BindersContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useSearchParams()
  const requestedSetId = params.get('set') || ''
  const isOpen = params.get('open') === '1'
  const isBonusCatalogView = params.get('catalog') === '1'
  const isPromoCatalogView = params.get('promos') === '1'
  const rawPage = Number.parseInt(params.get('page') || '0', 10)
  const [user, setUser] = useState(null)
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [sets, setSets] = useState([])
  const [showAllBinders, setShowAllBinders] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileId] = useState('')
  const [profileCreatedAt, setProfileCreatedAt] = useState('')
  const [ownedCardCounts, setOwnedCardCounts] = useState({})
  const [ownedExtraCounts, setOwnedExtraCounts] = useState({})
  const [ownedCopyCount, setOwnedCopyCount] = useState(0)
  const [cards, setCards] = useState([])
  const [extraVariants, setExtraVariants] = useState([])
  const [variantCopies, setVariantCopies] = useState({})
  const [etbImages, setEtbImages] = useState({})
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfNotice, setPdfNotice] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfCanShare, setPdfCanShare] = useState(false)
  const [copyNotice, setCopyNotice] = useState('')
  const [zoomedCard, setZoomedCard] = useState(null)
  const [zoomedBonusCard, setZoomedBonusCard] = useState(null)
  const [cardsPerSpread, setCardsPerSpread] = useState(24)

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 600px)')
    const updateCardsPerSpread = () => setCardsPerSpread(mobileQuery.matches ? 16 : 24)
    updateCardsPerSpread()
    mobileQuery.addEventListener('change', updateCardsPerSpread)
    return () => mobileQuery.removeEventListener('change', updateCardsPerSpread)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadLibrary() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError || !auth?.user) {
          window.location.replace('/login?next=%2Fcollection%2Fclasseurs')
          return
        }
        const signedUser = auth.user
        const { data: ownerProfile } = await supabase.from('profiles')
          .select('display_name').eq('id', signedUser.id).maybeSingle()
        const ownerName = String(ownerProfile?.display_name || signedUser.user_metadata?.display_name || signedUser.user_metadata?.username || '').trim()
        const { data: profileRows, error: profileError } = await supabase.from('collection_profiles')
          .select('id,display_name,is_default,profile_type,created_at').order('created_at')
        if (profileError) throw profileError
        const savedProfile = window.localStorage.getItem('pokevaleur-collection:' + signedUser.id)
        const activeProfile = (profileRows || []).find(row => row.id === savedProfile)
          || (profileRows || []).find(row => row.is_default)
          || (profileRows || [])[0]
        if (!activeProfile) throw new Error('Aucun profil de collection disponible.')
        const { data: setRows, error: setError } = await supabase.from('card_sets')
          .select('id,series_name,set_name,set_code,language,release_date,advertised_card_count,is_public')
          .eq('is_public', true).eq('language', 'FR').order('release_date', { ascending: true }).order('set_name')
        if (setError) throw setError
        if (cancelled) return
        setUser(signedUser)
        setOwnerDisplayName(ownerName)
        setProfiles(profileRows || [])
        setProfileId(activeProfile.id)
        setProfileCreatedAt(activeProfile.created_at || '')
        window.localStorage.setItem('pokevaleur-collection:' + signedUser.id, activeProfile.id)
        setSets(setRows || [])

        const { data: copyRows, error: copiesError } = await fetchAllRows(() => supabase.from('collection_cards')
          .select('id,card_print_variant_id').eq('collection_profile_id', activeProfile.id))
        if (copiesError) throw copiesError
        const copies = copyRows || []
        setOwnedCopyCount(copies.length)
        const variantIds = [...new Set(copies.map(copy => copy.card_print_variant_id).filter(Boolean))]
        const variants = []
        for (let offset = 0; offset < variantIds.length; offset += 250) {
          const { data, error: variantError } = await supabase.from('card_print_variants')
            .select('id,card_id,is_master_set_target').in('id', variantIds.slice(offset, offset + 250))
          if (variantError) throw variantError
          variants.push(...(data || []))
        }
        const cardIds = [...new Set(variants.map(variant => variant.card_id).filter(Boolean))]
        const cardSetById = new Map()
        for (let offset = 0; offset < cardIds.length; offset += 250) {
          const { data, error: cardError } = await supabase.from('cards')
            .select('id,card_set_id').in('id', cardIds.slice(offset, offset + 250))
          if (cardError) throw cardError
          for (const card of data || []) cardSetById.set(card.id, card.card_set_id)
        }
        const setCards = {}
        const setExtraVariants = {}
        for (const variant of variants) {
          const setId = cardSetById.get(variant.card_id)
          if (!setId) continue
          if (variant.is_master_set_target) {
            if (!setCards[setId]) setCards[setId] = new Set()
            setCards[setId].add(variant.card_id)
          } else {
            if (!setExtraVariants[setId]) setExtraVariants[setId] = new Set()
            setExtraVariants[setId].add(variant.id)
          }
        }
        const counts = {}
        for (const [setId, cardSet] of Object.entries(setCards)) counts[setId] = cardSet.size
        const extraCounts = {}
        for (const [setId, variantsInSet] of Object.entries(setExtraVariants)) extraCounts[setId] = variantsInSet.size
        setOwnedCardCounts(counts)
        setOwnedExtraCounts(extraCounts)

        try {
          const { data: products, error: productsError } = await fetchAllRows(() => supabase.from('products')
            .select('name,series,image_url,image_source_url,product_type').eq('is_public', true)
            .or('product_type.ilike.%etb%,name.ilike.%dresseur%,name.ilike.%trainer box%'))
          if (productsError) throw productsError
          const art = {}
          const ignoredSetWords = new Set(['ecarlate', 'violet', 'pokemon', 'serie', 'et', 'de', 'des', 'du', 'la', 'le', 'les'])
          for (const set of setRows || []) {
            const tokens = normalize(set.set_name).split(/[^a-z0-9]+/).filter(word => word.length > 2 && !ignoredSetWords.has(word))
            const matching = (products || []).find(product => {
              const productName = normalize(product.name)
              const productSeries = normalize(product.series)
              const productType = normalize(product.product_type)
              const isEtb = productType.includes('etb') || productName.includes('coffret dresseur') || productName.includes('elite trainer box')
              const productText = productName + ' ' + productSeries
              return isEtb && tokens.length > 0 && tokens.every(token => productText.includes(token)) && (product.image_url || product.image_source_url)
            })
            const image = matching?.image_url || matching?.image_source_url
            if (image) art[set.id] = image
          }
          if (!cancelled) setEtbImages(art)
        } catch { /* The binder remains usable if no ETB image is indexed. */ }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de charger les classeurs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLibrary()
    return () => { cancelled = true }
  }, [supabase])

  const mcDonaldSets = sets.filter(isMcDonaldsSet).sort((a, b) => setYear(a) - setYear(b) || a.set_name.localeCompare(b.set_name, 'fr'))
  const mcDonaldSetIds = mcDonaldSets.map(set => set.id)
  const mcDonaldBinder = {
    id: MCDONALDS_BINDER_ID,
    set_code: 'MCD',
    set_name: 'McDonald’s',
    series_name: 'Collection McDonald’s',
    memberSets: mcDonaldSets,
  }
  const selectedSet = requestedSetId === MCDONALDS_BINDER_ID
    ? mcDonaldBinder
    : sets.find(set => set.id === requestedSetId) || null
  const allLibrarySets = (() => {
    const firstMcDonaldsIndex = sets.findIndex(isMcDonaldsSet)
    const regularSets = sets.filter(set => !isMcDonaldsSet(set))
    if (firstMcDonaldsIndex < 0) return regularSets
    const beforeMcDonalds = sets.slice(0, firstMcDonaldsIndex).filter(set => !isMcDonaldsSet(set))
    return [...beforeMcDonalds, mcDonaldBinder, ...regularSets.filter(set => !beforeMcDonalds.some(existing => existing.id === set.id))]
  })()
  const ownedSets = allLibrarySets.filter(set => set.id === MCDONALDS_BINDER_ID
    ? set.memberSets.some(member => (ownedCardCounts[member.id] || 0) > 0 || (ownedExtraCounts[member.id] || 0) > 0)
    : (ownedCardCounts[set.id] || 0) > 0 || (ownedExtraCounts[set.id] || 0) > 0)
  const displayedSets = showAllBinders ? allLibrarySets : ownedSets

  useEffect(() => {
    setPdfFile(null)
    setPdfCanShare(false)
    setPdfNotice('')
  }, [selectedSet?.id, profileId, profileCreatedAt, cards, extraVariants, variantCopies])

  useEffect(() => {
    if (!selectedSet || !profileId) {
      setCards([])
      setExtraVariants([])
      setVariantCopies({})
      return
    }
    let cancelled = false
    async function loadBinder() {
      setCardsLoading(true)
      setError('')
      try {
        let cardQuery = supabase.from('cards')
          .select('id,card_set_id,collector_number,card_name,rarity_label,image_url,image_source_url,guide_order,card_sets!cards_card_set_id_fkey(id,set_name,set_code,release_date),card_print_variants(id,variant_label,variant_key,checklist_group,is_master_set_target)')
        cardQuery = selectedSet.id === MCDONALDS_BINDER_ID
          ? cardQuery.in('card_set_id', mcDonaldSetIds)
          : cardQuery.eq('card_set_id', selectedSet.id)
        const { data: cardRows, error: cardError } = await cardQuery.order('guide_order', { ascending: true }).order('collector_number')
        if (cardError) throw cardError
        const variants = (cardRows || []).flatMap(card => (card.card_print_variants || []).filter(variant => variant.is_master_set_target && !isJumboVariant(variant)))
        const extraItems = (cardRows || []).flatMap(card => (card.card_print_variants || [])
          .filter(variant => !variant.is_master_set_target && !isJumboVariant(variant))
          .map(variant => ({ card, variant, category: variant.checklist_group })))
        const { data: bonusRows, error: bonusError } = await supabase.from('card_set_bonus_cards')
          .select('card_id,category').eq('card_set_id', selectedSet.id)
        if (bonusError) throw bonusError
        const bonusCategoryByCard = new Map((bonusRows || []).map(row => [row.card_id, row.category]))
        const bonusCardIds = [...bonusCategoryByCard.keys()]
        let bonusCards = []
        for (let offset = 0; offset < bonusCardIds.length; offset += 100) {
          const { data, error: bonusCardError } = await supabase.from('cards')
            .select('id,card_set_id,collector_number,card_name,image_url,image_source_url,guide_order,card_sets!cards_card_set_id_fkey(id,set_name,set_code,release_date),card_print_variants(id,variant_label,variant_key,checklist_group,is_master_set_target)')
            .in('id', bonusCardIds.slice(offset, offset + 100))
          if (bonusCardError) throw bonusCardError
          bonusCards = bonusCards.concat(data || [])
        }
        const bonusItems = bonusCards.flatMap(card => (card.card_print_variants || [])
          .filter(variant => !isJumboVariant(variant))
          .map(variant => ({ card, variant, category: bonusCategoryByCard.get(card.id) })))
        const allExtraItems = [...extraItems, ...bonusItems]
          .filter(item => !isJumboVariant(item.variant) && item.category !== 'jumbo')
        const ids = [...variants, ...allExtraItems.map(item => item.variant)].map(variant => variant.id)
        let copies = []
        for (let offset = 0; offset < ids.length; offset += 250) {
          const { data, error: copyError } = await supabase.from('collection_cards')
            .select('id,card_print_variant_id,ownership_type,grade_label,raw_condition,condition_details,photo_path,created_at')
            .eq('collection_profile_id', profileId).in('card_print_variant_id', ids.slice(offset, offset + 250))
            .order('created_at', { ascending: true }).order('id', { ascending: true })
          if (copyError) throw copyError
          copies = copies.concat(data || [])
        }
        if (cancelled) return
        const grouped = {}
        for (const copy of copies) grouped[copy.card_print_variant_id] = [...(grouped[copy.card_print_variant_id] || []), copy]
        setCards((cardRows || []).filter(card => (card.card_print_variants || []).some(variant => variant.is_master_set_target)))
        setExtraVariants(allExtraItems)
        setVariantCopies(grouped)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Impossible de charger ce classeur.')
      } finally {
        if (!cancelled) setCardsLoading(false)
      }
    }
    loadBinder()
    return () => { cancelled = true }
  }, [supabase, selectedSet?.id, profileId, mcDonaldSetIds.join(',')])

  const copiesOnSet = useMemo(
    () => cards.reduce((sum, card) => sum + (card.card_print_variants || []).reduce((n, variant) => n + (isJumboVariant(variant) ? 0 : (variantCopies[variant.id] || []).length), 0), 0),
    [cards, variantCopies]
  )
  const isMcDonaldsBinder = selectedSet?.id === MCDONALDS_BINDER_ID
  const ownedOnSet = isMcDonaldsBinder
    ? mcDonaldSetIds.reduce((sum, setId) => sum + (ownedCardCounts[setId] || 0), 0)
    : cards.filter(card => (card.card_print_variants || []).some(variant => !isJumboVariant(variant) && (variantCopies[variant.id] || []).length > 0)).length
  const setTotal = cards.length || (isMcDonaldsBinder ? 0 : Number(selectedSet?.advertised_card_count || 0))
  const masterVariantTotal = cards.reduce((sum, card) => sum + (card.card_print_variants || []).filter(variant => variant.is_master_set_target && !isJumboVariant(variant)).length, 0)
  const ownedMasterVariantTotal = cards.reduce((sum, card) => sum + (card.card_print_variants || []).filter(variant => variant.is_master_set_target && !isJumboVariant(variant) && (variantCopies[variant.id] || []).length).length, 0)
  const missingOnSet = Math.max(masterVariantTotal - ownedMasterVariantTotal, 0)
  const promoStampItems = extraVariants.filter(item => ['promo', 'stamp'].includes(item.category || item.variant?.checklist_group))
  const promoStampTotal = promoStampItems.length
  const ownedPromoStampTotal = promoStampItems.filter(item => (variantCopies[item.variant.id] || []).length > 0).length
  const promoCatalogItems = (() => {
    const items = new Map()
    for (const card of cards) {
      for (const variant of card.card_print_variants || []) {
        if (variant.checklist_group === 'promo' && variant.is_master_set_target) {
          items.set(variant.id, { card, variant, category: 'promo' })
        }
      }
    }
    for (const item of extraVariants) {
      if ((item.category || item.variant?.checklist_group) === 'promo' && item.card?.card_set_id !== selectedSet?.id) {
        items.set(item.variant.id, item)
      }
    }
    return [...items.values()].sort((a, b) =>
      String(a.card?.collector_number || '').localeCompare(String(b.card?.collector_number || ''), 'fr', { numeric: true })
    )
  })()
  const seriesCompletionPercent = setTotal ? Math.round((ownedOnSet / setTotal) * 100) : 0
  const masterSetCompletionPercent = masterVariantTotal ? Math.round((ownedMasterVariantTotal / masterVariantTotal) * 100) : 0
  const ultraMasterTotal = masterVariantTotal + promoStampTotal
  const ownedUltraMasterTotal = ownedMasterVariantTotal + ownedPromoStampTotal
  const ultraMasterCompletionPercent = ultraMasterTotal ? Math.round((ownedUltraMasterTotal / ultraMasterTotal) * 100) : 0
  const missingBinderRows = cards.flatMap(card => (card.card_print_variants || [])
    .filter(variant => variant.is_master_set_target && !isJumboVariant(variant) && !(variantCopies[variant.id] || []).length)
    .map(variant => ({ card, variant, label: pdfVariantLabel(variant) })))
  const missingBinderGroups = [...new Map(missingBinderRows.map(row => [row.variant.variant_key, {
    key: row.variant.variant_key,
    label: row.label,
    rows: missingBinderRows.filter(candidate => candidate.variant.variant_key === row.variant.variant_key),
  }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  const familySections = useMemo(() => isMcDonaldsBinder
    ? mcDonaldSets.map(set => ({
      set,
      cards: cards.filter(card => card.card_set_id === set.id),
      extras: extraVariants.filter(item => item.card.card_set_id === set.id),
    })).filter(section => section.cards.length || section.extras.length)
    : [], [isMcDonaldsBinder, mcDonaldSets, cards, extraVariants])
  const familySpreads = useMemo(() => familySections.flatMap(section => {
    const masterCount = Math.ceil(section.cards.length / cardsPerSpread)
    const extraCount = Math.ceil(section.extras.length / cardsPerSpread)
    const spreads = []
    for (let index = 0; index < masterCount; index += 1) spreads.push({
      kind: 'master', section, index, count: masterCount,
      items: section.cards.slice(index * cardsPerSpread, (index + 1) * cardsPerSpread).map(card => ({ kind: 'master', card })),
    })
    for (let index = 0; index < extraCount; index += 1) spreads.push({
      kind: 'extra', section, index, count: extraCount,
      items: section.extras.slice(index * cardsPerSpread, (index + 1) * cardsPerSpread).map(item => ({ kind: 'extra', ...item })),
    })
    return spreads
  }), [familySections, cardsPerSpread])
  const cardsPerBookPage = cardsPerSpread === 16 ? 16 : 12
  const masterSpreadCount = cards.length ? Math.ceil(cards.length / cardsPerSpread) : (extraVariants.length ? 0 : 1)
  const extraSpreadCount = Math.ceil(extraVariants.length / cardsPerSpread)
  const promoCatalogSpreadCount = Math.ceil(promoCatalogItems.length / cardsPerSpread)
  const totalSpreads = isPromoCatalogView
    ? Math.max(1, promoCatalogSpreadCount)
    : isMcDonaldsBinder
      ? Math.max(1, familySpreads.length)
      : Math.max(1, masterSpreadCount + extraSpreadCount)
  const totalBookPages = (cardsPerSpread === 16 ? 1 : 2) * totalSpreads
  const page = Math.max(0, Math.min(Number.isFinite(rawPage) ? rawPage : 0, totalSpreads - 1))
  const familyPage = isMcDonaldsBinder ? familySpreads[page] : null
  const isExtraSpread = isPromoCatalogView ? false : familyPage ? familyPage.kind === 'extra' : extraSpreadCount > 0 && page >= masterSpreadCount
  const pageItems = isPromoCatalogView
    ? promoCatalogItems.slice(page * cardsPerSpread, (page + 1) * cardsPerSpread).map(item => ({ kind: 'extra', ...item }))
    : familyPage ? familyPage.items : isExtraSpread
      ? extraVariants.slice((page - masterSpreadCount) * cardsPerSpread, (page - masterSpreadCount + 1) * cardsPerSpread).map(item => ({ kind: 'extra', ...item }))
      : cards.slice(page * cardsPerSpread, page * cardsPerSpread + cardsPerSpread).map(card => ({ kind: 'master', card }))
  const spreadSlots = Array.from({ length: cardsPerSpread }, (_, index) => pageItems[index] || null)
  const pageSides = cardsPerSpread === 16 ? [0] : [0, 1]

  function handleCopyDeleted(copy) {
    const remainingForVariant = (variantCopies[copy.card_print_variant_id] || []).filter(row => row.id !== copy.id)
    const owningCard = cards.find(card => (card.card_print_variants || []).some(variant => variant.id === copy.card_print_variant_id))
    const owningExtra = extraVariants.find(item => item.variant.id === copy.card_print_variant_id)
    const cardStillOwned = (owningCard?.card_print_variants || []).some(variant =>
      variant.id === copy.card_print_variant_id
        ? remainingForVariant.length > 0
        : (variantCopies[variant.id] || []).length > 0
    )

    setVariantCopies(current => ({
      ...current,
      [copy.card_print_variant_id]: (current[copy.card_print_variant_id] || []).filter(row => row.id !== copy.id),
    }))
    setOwnedCopyCount(current => Math.max(current - 1, 0))
    const owningSetId = owningCard?.card_set_id || owningExtra?.card.card_set_id || selectedSet.id
    if (owningCard && !cardStillOwned) {
      setOwnedCardCounts(current => ({ ...current, [owningSetId]: Math.max((current[owningSetId] || 0) - 1, 0) }))
    }
    if (owningExtra && remainingForVariant.length === 0) {
      setOwnedExtraCounts(current => ({ ...current, [owningSetId]: Math.max((current[owningSetId] || 0) - 1, 0) }))
    }
    setZoomedCard(current => current ? { ...current, copies: (current.copies || []).filter(row => row.id !== copy.id) } : current)
  }

  async function copyMissingBinderNumbers(variantKey = null) {
    const rows = variantKey ? missingBinderRows.filter(row => row.variant.variant_key === variantKey) : missingBinderRows
    if (!rows.length) {
      setCopyNotice('Aucune variante manquante dans le Master Set.')
      return
    }
    const rowNumber = row => isMcDonaldsBinder
      ? setYear(cardSetFor(row.card)) + ' · ' + row.card.collector_number
      : row.card.collector_number
    const textToCopy = variantKey
      ? [...new Set(rows.map(rowNumber).filter(Boolean))].join(', ')
      : rows.map(row => rowNumber(row) + ' (' + row.label + ')').join(', ')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = textToCopy
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('La copie n’est pas disponible dans ce navigateur.')
      }
      const count = variantKey ? [...new Set(rows.map(rowNumber).filter(Boolean))].length : rows.length
      setCopyNotice(count + ' variante' + (count === 1 ? '' : 's') + ' manquante' + (count === 1 ? '' : 's') + ' copiée' + (count === 1 ? '' : 's') + '.')
    } catch (copyError) {
      setCopyNotice('Copie impossible : ' + (copyError.message || 'sélectionne les numéros manuellement.'))
    }
  }

  async function prepareBinderPdf() {
    if (!selectedSet || pdfBusy || cardsLoading) return
    setPdfBusy(true)
    setPdfFile(null)
    setPdfCanShare(false)
    setPdfNotice('Préparation du classeur…')
    try {
      const pdf = await createBinderPdf({
        set: selectedSet,
        cards,
        extraVariants,
        binderSections: isMcDonaldsBinder ? familySections : null,
        variantCopies,
        coverArt,
        profileName,
        ownerDisplayName,
        profileCreatedAt,
        ownedOnSet,
        copiesOnSet,
        missingOnSet,
        onProgress: setPdfNotice,
      })
      const slug = normalize(selectedSet.set_name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const fileName = 'pokevaleur-' + shortCode(selectedSet).toLowerCase() + '-' + (slug || 'classeur') + '.pdf'
      const file = new File([pdf.output('blob')], fileName, { type: 'application/pdf' })
      let canShareFile = false
      try {
        canShareFile = typeof navigator.share === 'function'
          && typeof navigator.canShare === 'function'
          && navigator.canShare({ files: [file] })
      } catch { canShareFile = false }
      setPdfFile(file)
      setPdfCanShare(canShareFile)
      setPdfNotice(canShareFile
        ? 'PDF prêt. Appuyez sur « Partager » pour choisir une application.'
        : 'PDF prêt à télécharger.')
    } catch (pdfError) {
      setPdfNotice('Impossible de créer le PDF : ' + (pdfError.message || 'réessayez.'))
    } finally {
      setPdfBusy(false)
    }
  }

  async function sharePreparedBinderPdf() {
    if (!pdfFile || !pdfCanShare || pdfBusy) return
    setPdfBusy(true)
    try {
      await navigator.share({
        files: [pdfFile],
        title: 'Classeur ' + selectedSet.set_name + ' · PokéValeur',
        text: 'Mon classeur ' + selectedSet.set_name + ' sur PokéValeur · pokevaleur.fr',
      })
      setPdfNotice('Le classeur a été partagé.')
    } catch (shareError) {
      setPdfNotice(shareError?.name === 'AbortError' ? 'Partage annulé.' : 'Le partage n’a pas abouti. Vous pouvez télécharger le PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  function downloadPreparedBinderPdf() {
    if (!pdfFile || pdfBusy) return
    const url = URL.createObjectURL(pdfFile)
    const link = document.createElement('a')
    link.href = url
    link.download = pdfFile.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    setPdfNotice('PDF téléchargé. Vous pouvez le joindre à un message ou le partager depuis votre téléphone.')
  }

  function navigate(next) {
    const query = new URLSearchParams()
    const nextSetId = Object.prototype.hasOwnProperty.call(next, 'set') ? next.set : requestedSetId
    if (nextSetId) query.set('set', nextSetId)
    if (next.open) query.set('open', '1')
    if (next.page !== undefined) query.set('page', String(next.page))
    if (next.catalog ?? isBonusCatalogView) query.set('catalog', '1')
    if (next.promos ?? isPromoCatalogView) query.set('promos', '1')
    router.push('/collection/classeurs' + (query.size ? '?' + query.toString() : ''))
  }

  if (loading) return <main className={styles.page}><p className={styles.status}>Chargement de tes classeurs…</p></main>
  if (!user) return <main className={styles.page}><p className={styles.status}>Redirection vers la connexion…</p></main>

  const libraryMode = !selectedSet
  const currentSectionSet = familyPage?.section.set || selectedSet
  const currentSectionLabel = isMcDonaldsBinder && familyPage
    ? setYear(currentSectionSet) + ' · ' + currentSectionSet.set_name
    : shortCode(selectedSet)
  const [coverStart, coverEnd] = colorFor(selectedSet?.set_code)
  const generatedCoverArt = selectedSet && generatedCoverFor(selectedSet)
  const coverArt = selectedSet && (generatedCoverArt || (shortCode(selectedSet) === 'EV8' ? '/binder-covers/etincelles-deferlantes.svg' : etbImages[selectedSet.id]))
  const profileName = profiles.find(profile => profile.id === profileId)?.display_name
    || (profiles.find(profile => profile.id === profileId)?.profile_type === 'child' ? 'Collection familiale' : 'Ma collection')

  return (
    <main className={styles.page}>
      {libraryMode ? <>
        <div className={styles.topLine}>
          <BackLink href="/collection">← Ma collection</BackLink>
          <span className={styles.eyebrow}>Ta bibliothèque</span>
        </div>
        <header className={styles.header}>
          <p className={styles.kicker}>Ma Collection · Cartes</p>
          <h1>Mes classeurs</h1>
          <p>Un classeur par série. Les tranches en couleur signalent les séries où tu as déjà des cartes.</p>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <section className={styles.librarySummary} aria-label="Résumé de la bibliothèque">
          <strong>{ownedSets.length} classeur{ownedSets.length === 1 ? '' : 's'} avec des cartes</strong><span>{ownedCopyCount} cartes dans {profileName}</span>
        </section>
        {allLibrarySets.length > ownedSets.length && <div className={styles.libraryControls}>
          <span>{showAllBinders ? 'Toutes les séries du catalogue' : 'Tes séries en cours'}</span>
          <button type="button" className={styles.allBindersButton} onClick={() => setShowAllBinders(value => !value)}>
            {showAllBinders ? 'Masquer les séries sans carte' : 'Voir toutes les séries'}
          </button>
        </div>}
        {displayedSets.length ? <section className={styles.library} aria-label="Bibliothèque des séries">
          {displayedSets.map(set => {
            const [start, end] = colorFor(set.set_code)
            const memberSets = set.id === MCDONALDS_BINDER_ID ? set.memberSets : [set]
            const masterOwned = memberSets.reduce((sum, member) => sum + (ownedCardCounts[member.id] || 0), 0)
            const extraOwned = memberSets.reduce((sum, member) => sum + (ownedExtraCounts[member.id] || 0), 0)
            const hasCards = masterOwned > 0 || extraOwned > 0
            const spineCover = generatedCoverFor(set) || etbImages[set.id]
            return <button key={set.id} type="button" className={hasCards ? styles.spineActive : styles.spine}
              style={{ '--spine-start': start, '--spine-end': end }}
              onClick={() => navigate({ open: false, set: set.id })}
              aria-label={'Ouvrir le classeur ' + set.set_name + (set.id === MCDONALDS_BINDER_ID ? ' (' + memberSets.length + ' éditions annuelles)' : '') + ', ' + masterOwned + ' cartes du Master Set et ' + extraOwned + ' versions hors Master Set possédées'}>
              {(hasCards || set.id === MCDONALDS_BINDER_ID) && spineCover && <span className={styles.spineArtwork} aria-hidden="true"><img src={spineCover} alt="" loading="lazy" /></span>}
              <span className={styles.spineCode}>{shortCode(set)}</span>
              <span className={styles.spineMarker} aria-hidden="true" />
            </button>
          })}
        </section> : <p className={styles.empty}>{allLibrarySets.length ? 'Tu n’as pas encore de carte dans un classeur.' : 'Aucune série française n’est publiée dans le catalogue.'}</p>}
        {requestedSetId && selectedSet && <p className={styles.notice}>Série sélectionnée : {selectedSet.set_name}</p>}
        <section className={styles.seriesJump} aria-label="Accès à un classeur">
          <label htmlFor="binder-series">Choisir une série</label>
          <select id="binder-series" value={requestedSetId} onChange={event => navigate({ open: false, set: event.target.value })}>
            <option value="">Sélectionner une série</option>
            <option value={MCDONALDS_BINDER_ID}>MCD · McDonald’s (toutes les années)</option>
            {sets.filter(set => !isMcDonaldsSet(set)).map(set => <option key={set.id} value={set.id}>{shortCode(set)} · {set.set_name}</option>)}
          </select>
        </section>
      </> : !isOpen ? <>
        <div className={styles.topLine}>
          <BackLink href="/collection/classeurs" />
          <span className={styles.eyebrow}>{shortCode(selectedSet)}</span>
        </div>
        <section className={styles.coverStage}>
          <div className={styles.coverGlow} style={{ '--cover-start': coverStart, '--cover-end': coverEnd }} />
          {generatedCoverArt ? (
            <img className={styles.generatedProductCover} src={generatedCoverArt} alt={'Classeur ' + selectedSet.set_name} />
          ) : (
          <article className={styles.closedBinder} style={{ '--cover-start': coverStart, '--cover-end': coverEnd }}>
            <div className={styles.binderSpine}><span>{shortCode(selectedSet)}</span></div>
            <div className={styles.coverFace}>
              {coverArt && <img className={styles.coverArtwork} src={coverArt} alt="" />}
              <div className={styles.coverTint} />
              <p className={styles.coverBrand}>POKÉVALEUR · CLASSEUR</p>
              <h1>{selectedSet.set_name}</h1>
              <p className={styles.coverCode}>{shortCode(selectedSet)} · {selectedSet.release_date ? new Date(selectedSet.release_date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Collection'}</p>
            </div>
          </article>
          )}
          <div className={styles.coverDetails}>
            <p className={styles.kicker}>Ton classeur de série</p>
            <h2>{selectedSet.set_name}</h2>
            <div className={styles.stats}>
              <div>
                <strong>{ownedOnSet}/{setTotal} · {seriesCompletionPercent}%</strong>
                <span>Série complète</span>
                <details className={styles.statExplanation}>
                  <summary>Explication</summary>
                  <p>Nombre de cartes différentes de la série possédées, sur {setTotal}. Les doublons ne sont pas comptés.</p>
                </details>
              </div>
              <div>
                <strong>{ownedMasterVariantTotal}/{masterVariantTotal} · {masterSetCompletionPercent}%</strong>
                <span>Master Set</span>
                <details className={styles.statExplanation}>
                  <summary>Explication</summary>
                  <p>Le Master Set PokéValeur comprend toutes les variantes et les énergies de la série. Les promos et cartes tampon s’ajoutent pour former l’Ultra Master Set.</p>
                </details>
              </div>
              <div><strong>{copiesOnSet}</strong><span>cartes possédées (doublons compris)</span></div>
              {promoStampTotal > 0 && <div>
                <strong>{ownedPromoStampTotal}/{promoStampTotal}</strong>
                <span>promos et tampons · Ultra Master Set</span>
                <button type="button" className={styles.bonusCardsButton}
                  onClick={() => navigate({ open: true, page: masterSpreadCount, catalog: false })}
                  aria-label="Ouvrir les emplacements des promos et cartes tampon">
                  Ouvrir les emplacements
                </button>
                <button type="button" className={styles.bonusCardsCatalogButton}
                  onClick={() => navigate({ open: true, page: masterSpreadCount, catalog: true })}
                  aria-label="Voir les images des huit promos et de la carte tampon du catalogue">
                  Voir les 8 promos + le tampon
                </button>
                <small>{ownedUltraMasterTotal}/{ultraMasterTotal} · {ultraMasterCompletionPercent}% de l’Ultra Master Set</small>
              </div>}
            </div>
            <section className={styles.missingCopyPanel} aria-label="Copier les variantes manquantes">
              <strong>Copier les manquantes du Master Set</strong>
              <div className={styles.missingCopyActions}>
                <button type="button" onClick={() => copyMissingBinderNumbers()} disabled={!missingBinderRows.length}>
                  Toutes ({missingBinderRows.length})
                </button>
                {missingBinderGroups.map(group => <button key={group.key} type="button" onClick={() => copyMissingBinderNumbers(group.key)} disabled={!group.rows.length}>
                  {group.label} ({group.rows.length})
                </button>)}
              </div>
              {copyNotice && <p role="status">{copyNotice}</p>}
            </section>
            <div className={styles.coverActions}>
              <button className={styles.openButton} type="button" onClick={() => navigate({ open: true, page: 0 })}>Ouvrir le classeur <span aria-hidden="true">→</span></button>
              {pdfFile ? <div className={styles.pdfReadyActions}>
                {pdfCanShare && <button className={styles.shareButton} type="button" onClick={sharePreparedBinderPdf} disabled={pdfBusy}>
                  {pdfBusy ? 'Ouverture du partage…' : 'Partager le PDF'}
                </button>}
                <button className={styles.downloadButton} type="button" onClick={downloadPreparedBinderPdf} disabled={pdfBusy}>Télécharger le PDF</button>
              </div> : <button className={styles.shareButton} type="button" onClick={prepareBinderPdf} disabled={pdfBusy || cardsLoading}>
                {pdfBusy ? 'Création du PDF…' : 'Créer le PDF à partager'}
              </button>}
            </div>
            {pdfNotice && <p className={styles.shareNotice} role="status">{pdfNotice}</p>}
          </div>
        </section>
      </> : <>
        <div className={styles.topLine}>
          <BackLink href={'/collection/classeurs?set=' + encodeURIComponent(selectedSet.id)} />
          <span className={styles.eyebrow}>{shortCode(selectedSet)}</span>
        </div>
        <header className={styles.openHeader}>
          <div><h1>{selectedSet.set_name}</h1></div>
          <p>{isPromoCatalogView
            ? promoCatalogItems.length + ' promos du catalogue · visibles même si elles ne sont pas possédées'
            : (isMcDonaldsBinder ? mcDonaldSets.length + ' éditions annuelles · ' : '') + ownedOnSet + ' possédée' + (ownedOnSet === 1 ? '' : 's') + ' · ' + missingOnSet + ' variante' + (missingOnSet === 1 ? '' : 's') + ' à compléter · ' + extraVariants.length + ' version' + (extraVariants.length === 1 ? '' : 's') + ' hors Master Set'}</p>
        </header>
        {!isPromoCatalogView && promoCatalogItems.length > 0 && <button type="button" className={styles.bonusCardsCatalogButton}
          onClick={() => navigate({ open: true, page: 0, promos: true })}
          aria-label={'Voir les ' + promoCatalogItems.length + ' promos du catalogue'}>
          Voir les {promoCatalogItems.length} promos du catalogue
        </button>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {cardsLoading ? <p className={styles.status}>Chargement des cartes du classeur…</p> : <>
          <nav className={styles.pageNav} aria-label="Navigation du classeur">
            <button type="button" onClick={() => navigate({ open: true, page: Math.max(page - 1, 0) })} disabled={page === 0} aria-label="Double page précédente">←</button>
            <span>{isPromoCatalogView
              ? 'Promos du catalogue ' + (page + 1) + '/' + Math.max(1, promoCatalogSpreadCount)
              : familyPage
              ? setYear(familyPage.section.set) + ' · ' + (isExtraSpread ? 'Hors Master ' : 'Master ') + (familyPage.index + 1) + '/' + familyPage.count
              : isExtraSpread
                ? 'Hors Master ' + (page - masterSpreadCount + 1) + '/' + extraSpreadCount
                : 'Master ' + (masterSpreadCount ? page + 1 : 0) + '/' + masterSpreadCount}</span>
            <button type="button" onClick={() => navigate({ open: true, page: Math.min(page + 1, totalSpreads - 1) })} disabled={page >= totalSpreads - 1} aria-label="Double page suivante">→</button>
          </nav>
          <section className={styles.spread} style={{ '--spread-accent': coverEnd }} aria-label={(familyPage ? familyPage.section.set.set_name + ', ' : '') + (isExtraSpread ? 'Hors Master Set, ' : 'Master Set, ') + (cardsPerSpread === 16 ? 'page ' : 'double page ') + (familyPage ? familyPage.index + 1 : isExtraSpread ? page - masterSpreadCount + 1 : page + 1)}>
            {pageSides.map(side => <section key={side} className={styles.bookPage} aria-label={cardsPerSpread === 16 ? 'Page du classeur' : side === 0 ? 'Page de gauche' : 'Page de droite'}>
              <div className={styles.pageTop}><span>{isPromoCatalogView ? 'Catalogue · Promos' : isExtraSpread ? 'Hors Master Set · ' + (familyPage?.section.extras.length || extraVariants.length) : currentSectionLabel}</span><span>{cardsPerSpread === 16 ? page + 1 : page * 2 + side + 1}</span></div>
              <div className={styles.cardSlots}>
                {spreadSlots.slice(side * cardsPerBookPage, side * cardsPerBookPage + cardsPerBookPage).map((item, slotIndex) => {
                  const card = item?.card
                  const variants = binderVariantsForItem(item)
                  const ownedCopies = binderCopiesForItem(item, variantCopies)
                  const copyCount = ownedCopies.length
                  const cardArt = imageFor(card)
                  const missingVariants = variants.filter(variant => !(variantCopies[variant.id] || []).length)
                  const isPromoOrStamp = ['promo', 'stamp'].includes(item?.category || item?.variant?.checklist_group)
                  if (card && (isBonusCatalogView || isPromoCatalogView) && item?.kind === 'extra' && (isPromoCatalogView ? item?.category === 'promo' : isPromoOrStamp)) {
                    const catalogArt = bonusCatalogImageFor(item)
                    const bonusLabel = binderExtraLabel(item)
                    return <button key={item.kind + '-' + card.id + '-' + variants.map(variant => variant.id).join('-')} type="button" className={styles.slotCatalog}
                      onClick={() => setZoomedBonusCard({ card: { ...card, category: item.category }, label: bonusLabel, imageUrl: catalogArt })}
                      aria-label={'Agrandir ' + card.card_name + ', ' + bonusLabel}>
                      <div className={styles.thumb}>
                        {catalogArt ? <CardArtwork card={card} src={catalogArt} alt="" /> : <span>Illustration indisponible</span>}
                      </div>
                      <strong className={styles.cardName}>{card.card_name}</strong>
                      <span className={styles.cardNumber}>{card.collector_number}</span>
                      <span className={styles.extraVariantLabel}>{bonusLabel}</span>
                    </button>
                  }
                  if (card && copyCount) {
                    return <button key={item.kind + '-' + card.id + '-' + variants.map(variant => variant.id).join('-')} type="button" className={styles.slotOpen}
                      onClick={() => setZoomedCard({ ...card, setName: cardSetFor(card)?.set_name || selectedSet.set_name, copies: ownedCopies })}
                      aria-label={'Voir ' + (item.kind === 'extra' ? binderExtraLabel(item) + ' de ' : '') + card.card_name + ', ' + ownedCopies.length + ' exemplaire' + (ownedCopies.length === 1 ? '' : 's')}>
                      <div className={styles.thumb}>
                        {cardArt ? <CardArtwork card={card} alt="" /> : <span>Illustration absente</span>}
                        <span className={styles.slotZoomHint} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.3" fill="none" stroke="currentColor" strokeWidth="2.2"/><path d="m15.4 15.4 5.1 5.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>
                        {copyCount > 1 && <b className={styles.copyBadge}>×{copyCount}</b>}
                      </div>
                      <strong className={styles.cardName}>{card.card_name}</strong>
                      <span className={styles.cardNumber}>{card.collector_number}</span>
                      {missingVariants.length > 0 && <span className={styles.extraVariantLabel}>Manque : {missingVariants.map(pdfVariantLabel).join(', ')}</span>}
                      {item.kind === 'extra' && <span className={styles.extraVariantLabel}>{binderExtraLabel(item)}</span>}
                    </button>
                  }
                  return <article key={item ? item.kind + '-' + card.id + '-' + variants.map(variant => variant.id).join('-') : 'empty-' + side + '-' + slotIndex} className={styles.slot}>
                    {card ? <>
                      <span className={styles.emptyNumber}>{card?.collector_number || '—'}</span>
                      <span className={styles.emptyHint}>À compléter</span>
                      {missingVariants.length > 0 && <span className={styles.extraVariantLabel}>{missingVariants.map(pdfVariantLabel).join(', ')}</span>}
                      {item.kind === 'extra' && <span className={styles.extraVariantLabel}>{binderExtraLabel(item)}</span>}
                    </> : <><span className={styles.emptyNumber}>—</span><span className={styles.emptyHint}>Emplacement libre</span></>}
                  </article>
                })}
              </div>
          <div className={styles.pageFooter}><span>{profileName}</span><span>{cardsPerSpread === 16 ? page + 1 : page * 2 + side + 1}/{totalBookPages}</span></div>
            </section>)}
          </section>
        </>}
      </>}
      {zoomedCard && <CardCopyDialog supabase={supabase} user={user} profileId={profileId} card={zoomedCard}
        copies={zoomedCard.copies || []} onCopyDeleted={handleCopyDeleted} onClose={() => setZoomedCard(null)} />}
      {zoomedBonusCard && <BonusCatalogImageDialog {...zoomedBonusCard} onClose={() => setZoomedBonusCard(null)} />}
    </main>
  )
}


export default function BindersPage() {
  return <Suspense fallback={<main className={styles.page}><p className={styles.status}>Chargement de tes classeurs…</p></main>}><BindersContent /></Suspense>
}
