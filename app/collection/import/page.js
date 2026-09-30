'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '../../../lib/supabase-browser'
import { fetchAllRows } from '../../../lib/supabase-pagination'

const HEADER_ALIASES = {
  name: ['produit','nom','nom produit','item','article','reference','référence','designation','désignation'],
  quantity: ['quantite','quantité','qty','qte','qté','nombre','nb'],
  purchase_price: ['prix achat','prix d achat','prix achat unitaire','achat','prix','cout','coût'],
  purchase_date: ['date achat','date d achat','date','achete le','acheté le'],
  purchase_place: ['lieu achat','lieu d achat','lieu','magasin','boutique','plateforme'],
  seller_name: ['vendeur','seller','pseudo vendeur','nom vendeur'],
  sealed_condition: ['etat','état','condition','etat scelle','état scellé'],
  variant_note: ['variante','particularite','particularité','version'],
  booster_configuration: ['boosters','composition boosters','configuration boosters','composition'],
  notes: ['notes','note','commentaire','commentaires']
}

function norm(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const n = Number(String(value).replace(/\s/g,'').replace(',','.').replace(/[^0-9.-]/g,''))
  return Number.isFinite(n) ? n : null
}

function parseDate(value) {
  if (!value) return null
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`
  const fr = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (fr) {
    const y = Number(fr[3]) < 100 ? 2000 + Number(fr[3]) : Number(fr[3])
    return `${y}-${String(fr[2]).padStart(2,'0')}-${String(fr[1]).padStart(2,'0')}`
  }
  return null
}

function tokenScore(a,b) {
  const A = new Set(norm(a).split(' ').filter(Boolean))
  const B = new Set(norm(b).split(' ').filter(Boolean))
  if (!A.size || !B.size) return 0
  let common=0
  A.forEach(x=>{ if(B.has(x)) common++ })
  return common / Math.max(A.size,B.size)
}

function detectMapping(headers) {
  const mapping = {}
  headers.forEach(header => {
    const h = norm(header)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(a => norm(a) === h || h.includes(norm(a)))) {
        if (!mapping[field]) mapping[field] = header
      }
    }
  })
  return mapping
}

export default function ImportCollectionPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user,setUser] = useState(null)
  const [targetProfileId,setTargetProfileId] = useState(null)
  const [targetProfileName,setTargetProfileName] = useState('Ma collection')
  const [catalog,setCatalog] = useState([])
  const [existing,setExisting] = useState([])
  const [rows,setRows] = useState([])
  const [mapping,setMapping] = useState({})
  const [headers,setHeaders] = useState([])
  const [fileName,setFileName] = useState('')
  const [message,setMessage] = useState('')
  const [importing,setImporting] = useState(false)
  const [initializing,setInitializing] = useState(true)
  const existingProductIds = useMemo(
    () => new Set(existing.map(item => item.product_id).filter(Boolean)),
    [existing]
  )
  const existingNames = useMemo(
    () => new Set(existing.map(item => norm(item.custom_name)).filter(Boolean)),
    [existing]
  )

  useEffect(()=>{ init() },[])

  async function init(){
    const { data:{ user } } = await supabase.auth.getUser()
    setUser(user)
    if(!user) {
      setInitializing(false)
      return
    }
    const { data: profileRows, error: profilesError } = await supabase.from('collection_profiles')
      .select('id,display_name,is_default')
      .order('created_at')
    if (profilesError) {
      setMessage(profilesError.message)
      setInitializing(false)
      return
    }
    const savedProfileId = window.localStorage.getItem(`pokevaleur-collection:${user.id}`)
    const targetProfile = (profileRows || []).find(profile => profile.id === savedProfileId)
      || (profileRows || []).find(profile => profile.is_default)
    if (!targetProfile?.id) {
      setMessage('Aucun profil de collection disponible pour ce compte.')
      setInitializing(false)
      return
    }
    setTargetProfileId(targetProfile.id)
    setTargetProfileName(targetProfile.display_name)
    const [{data:products,error:productsError},{data:items,error:itemsError}] = await Promise.all([
      fetchAllRows(() => supabase.from('products').select('id,name,series,product_type,category')
        .eq('is_public',true).order('name').order('id')),
      fetchAllRows(() => supabase.from('collection_items')
        .select('id,product_id,custom_name,quantity,purchase_price,purchase_date')
        .eq('collection_profile_id',targetProfile.id)
        .order('created_at').order('id'))
    ])
    if (productsError || itemsError) {
      setMessage(productsError?.message || itemsError.message)
      setInitializing(false)
      return
    }
    setCatalog(products||[])
    setExisting(items||[])
    setInitializing(false)
  }

  function scoreProducts(name) {
    const n = norm(name)
    if (!n) return []
    return catalog
      .map(p => {
        const pn = norm(p.name)
        let score = tokenScore(name,p.name)
        if (pn === n) score = 1
        else if (pn.includes(n) || n.includes(pn)) score = Math.max(score,.9)
        if (p.series && n.includes(norm(p.series))) score = Math.min(1, score + .05)
        return { product:p, score }
      })
      .filter(x => x.score >= .55)
      .sort((a,b)=>b.score-a.score)
      .slice(0,5)
  }

  function validateSourceRow(source, index, currentMapping=mapping) {
    const name = String(source[currentMapping.name] ?? '').trim()
    const quantity = parseNumber(source[currentMapping.quantity])
    const price = parseNumber(source[currentMapping.purchase_price])
    const date = parseDate(source[currentMapping.purchase_date])
    const matches = scoreProducts(name)
    const best = matches[0]
    const second = matches[1]
    const errors = []
    const warnings = []

    if (!name) errors.push('Nom du produit manquant')
    const q = quantity == null ? 1 : Math.trunc(quantity)
    if (q < 1 || q > 999) errors.push('Quantité invalide')
    if (price != null && (price < 0 || price > 1000000)) errors.push('Prix incohérent')
    if (source[currentMapping.purchase_date] && !date) warnings.push('Date non reconnue')

    if ((best?.product?.id && existingProductIds.has(best.product.id)) || existingNames.has(norm(name))) {
      warnings.push('Déjà présent dans ta collection')
    }

    let status='unknown'
    let productId=null
    if(errors.length) status='error'
    else if(best?.score >= .94 && (!second || best.score-second.score >= .08)) {
      status='identified'
      productId=best.product.id
    } else if(best?.score >= .62) status='review'

    return {
      _index:index,
      source,
      name,
      quantity:q,
      purchase_price:price,
      purchase_date:date,
      purchase_place:String(source[currentMapping.purchase_place] ?? '').trim(),
      seller_name:String(source[currentMapping.seller_name] ?? '').trim(),
      sealed_condition:norm(source[currentMapping.sealed_condition]).includes('zero') ? 'zero_defect' : 'standard',
      variant_note:String(source[currentMapping.variant_note] ?? '').trim(),
      booster_configuration:String(source[currentMapping.booster_configuration] ?? '').trim(),
      notes:String(source[currentMapping.notes] ?? '').trim(),
      matches,
      productId,
      status,
      errors,
      warnings,
      selected:true
    }
  }

  async function handleFile(file){
    if(!file) return
    if(file.size > 10 * 1024 * 1024) return setMessage('❌ Fichier trop volumineux (maximum 10 Mo).')
    setMessage('Lecture du fichier…')
    try{
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer,{type:'array',cellDates:false})
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet,{defval:''})
      if(!json.length) throw new Error('Le fichier ne contient aucune ligne exploitable.')
      if(json.length > 3000) throw new Error('Import limité à 3 000 lignes par fichier.')
      const detectedHeaders = Object.keys(json[0]||{})
      const detectedMapping = detectMapping(detectedHeaders)
      setHeaders(detectedHeaders)
      setMapping(detectedMapping)
      setFileName(file.name)
      const analyzed = json.map((r,i)=>validateSourceRow(r,i+2,detectedMapping))
      setRows(analyzed)
      setMessage(`✓ ${json.length} lignes analysées. Vérifie les correspondances avant import.`)
    }catch(e){
      setRows([])
      setMessage('❌ '+(e.message||'Impossible de lire ce fichier.'))
    }
  }

  function remap(field, header){
    const next={...mapping,[field]:header}
    setMapping(next)
    setRows(prev=>prev.map(r=>validateSourceRow(r.source,r._index,next)))
  }

  function chooseMatch(rowIndex, productId){
    setRows(prev=>prev.map((r,i)=>i===rowIndex?{
      ...r,
      productId,
      status:productId?'identified':'unknown',
      selected:!!productId
    }:r))
  }

  function toggleRow(rowIndex){
    setRows(prev=>prev.map((r,i)=>i===rowIndex?{...r,selected:!r.selected}:r))
  }

  async function importValidated(){
    const ready=rows.filter(r=>r.selected && r.status==='identified' && r.productId && !r.errors.length)
    if(!ready.length) return setMessage('Aucune ligne validée à importer.')
    if(!window.confirm(`Importer ${ready.length} ligne${ready.length>1?'s':''} validée${ready.length>1?'s':''} dans « ${targetProfileName} » ?`)) return
    setImporting(true)
    setMessage('Import en cours…')

    const payload=ready.map(r=>({
      user_id:user.id,
      collection_profile_id:targetProfileId,
      product_id:r.productId,
      custom_name:catalog.find(p=>p.id===r.productId)?.name || r.name,
      quantity:r.quantity || 1,
      purchase_price:r.purchase_price,
      purchase_date:r.purchase_date,
      purchase_place:r.purchase_place || null,
      seller_name:r.seller_name || null,
      sealed_condition:r.sealed_condition || 'standard',
      variant_note:r.variant_note || null,
      booster_configuration:r.booster_configuration || null,
      notes:r.notes || null
    }))

    const {error}=await supabase.from('collection_items').insert(payload)
    setImporting(false)
    if(error) return setMessage('❌ '+error.message)
    setMessage(`✓ ${payload.length} ligne${payload.length>1?'s':''} importée${payload.length>1?'s':''}. Les lignes incertaines n’ont pas été ajoutées.`)
    const importedIndexes=new Set(ready.map(r=>r._index))
    setRows(prev=>prev.map(r=>importedIndexes.has(r._index)?{...r,selected:false,status:'imported'}:r))
  }

  if(initializing) return <main className="narrow"><section className="panel"><p>Préparation de l’import…</p></section></main>
  if(!user) return <main className="narrow"><section className="panel"><h1>Importer ma collection</h1><p>Connecte-toi pour importer ton fichier.</p><a className="btn" href="/login">Connexion</a></section></main>

  const counts={
    identified:rows.filter(r=>r.status==='identified').length,
    review:rows.filter(r=>r.status==='review').length,
    unknown:rows.filter(r=>r.status==='unknown').length,
    error:rows.filter(r=>r.status==='error').length
  }

  return (
    <main>
      <div className="collectionHeader">
        <div>
          <span className="eyebrow dark">Import assisté</span>
          <h1>Importer Excel / CSV</h1>
          <p className="muted">PokéValeur analyse ton fichier avant toute insertion. Une ligne incertaine n’est jamais importée automatiquement.</p>
          <p className="muted">Destination de l’import : <strong>{targetProfileName}</strong>.</p>
        </div>
        <div className="collectionHeaderActions"><a className="btn ghost" href="/collection">← Ma collection</a></div>
      </div>

      <section className="panel importDrop">
        <h2>1. Choisis ton fichier</h2>
        <p>Formats acceptés : .xlsx, .xls et .csv. Maximum 3 000 lignes.</p>
        <label className="importFileButton">
          <input type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>handleFile(e.target.files?.[0])} />
          <span>📄 Sélectionner mon fichier</span>
        </label>
        {fileName && <p className="message">Fichier : <b>{fileName}</b></p>}
        {message && <p className="message">{message}</p>}
      </section>

      {headers.length>0 && (
        <section className="panel">
          <h2>2. Vérifie les colonnes détectées</h2>
          <div className="importMappingGrid">
            {[
              ['name','Produit *'],['quantity','Quantité'],['purchase_price','Prix d’achat'],['purchase_date','Date d’achat'],
              ['purchase_place','Lieu d’achat'],['seller_name','Vendeur'],['sealed_condition','État'],['variant_note','Variante'],
              ['booster_configuration','Composition boosters'],['notes','Notes']
            ].map(([field,label])=>(
              <label key={field}>{label}
                <select value={mapping[field]||''} onChange={e=>remap(field,e.target.value)}>
                  <option value="">Non importé</option>
                  {headers.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {rows.length>0 && <>
        <section className="stats importStats">
          <div><span>Identifiées</span><strong>{counts.identified}</strong></div>
          <div><span>À confirmer</span><strong>{counts.review}</strong></div>
          <div><span>Inconnues</span><strong>{counts.unknown}</strong></div>
          <div><span>Erreurs</span><strong>{counts.error}</strong></div>
        </section>

        <section className="panel">
          <div className="listHeader">
            <div><h2>3. Contrôle avant import</h2><p className="muted">Seules les lignes vertes validées seront importées.</p></div>
            <button className="btn" disabled={importing||!counts.identified} onClick={importValidated}>{importing?'Import…':`Importer les ${rows.filter(r=>r.selected&&r.status==='identified').length} lignes validées`}</button>
          </div>

          <div className="importReviewList">
            {rows.map((row,rowIndex)=>(
              <article className={`importRow import-${row.status}`} key={row._index}>
                <div className="importRowTop">
                  <label className="importCheck"><input type="checkbox" checked={row.selected} disabled={row.status==='error'||row.status==='imported'} onChange={()=>toggleRow(rowIndex)} /></label>
                  <div className="importRowMain">
                    <div className="importStatus">{row.status==='identified'?'✅ Identifié':row.status==='review'?'🟡 À confirmer':row.status==='unknown'?'🟠 Inconnu':row.status==='error'?'🔴 Erreur':'✓ Importé'}</div>
                    <h3>{row.name || 'Produit sans nom'}</h3>
                    <p>Ligne {row._index} • Qté {row.quantity || 1}{row.purchase_price!=null?` • ${row.purchase_price.toFixed(2)} €`:''}{row.purchase_date?` • ${row.purchase_date}`:''}</p>
                    {row.warnings.length>0 && <p className="importWarning">{row.warnings.join(' • ')}</p>}
                    {row.errors.length>0 && <p className="importError">{row.errors.join(' • ')}</p>}
                  </div>
                </div>

                {row.status!=='error' && row.status!=='imported' && (
                  <div className="importMatches">
                    {row.matches.length===0 ? <span className="muted">Aucune correspondance suffisante dans le catalogue.</span> :
                      row.matches.map(({product,score})=>(
                        <button
                          type="button"
                          className={row.productId===product.id?'importMatch selected':'importMatch'}
                          key={product.id}
                          onClick={()=>chooseMatch(rowIndex,product.id)}
                        >
                          <b>{product.name}</b>
                          <small>{product.series||product.product_type||''} • {Math.round(score*100)}%</small>
                        </button>
                      ))
                    }
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </>}
    </main>
  )
}
