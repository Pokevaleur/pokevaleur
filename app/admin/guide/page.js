'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { supabaseUrl } from '../../../lib/supabase-config'
import styles from './page.module.css'

const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
const newId = (value, suffix) => `${slug(value) || 'nouveau'}-${suffix}`

function updateRow(setRows, id, key, value) {
  setRows(rows => rows.map(row => row.id === id ? { ...row, [key]: value } : row))
}

function ImageFields({ row, setRows, onUpload }) {
  const imageUrl = row.image_path ? `${supabaseUrl}/storage/v1/object/public/guide-illustrations/${row.image_path.split('/').map(encodeURIComponent).join('/')}` : ''
  return <div className={styles.imageFields}>
    <label>Illustration<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => onUpload(event.target.files?.[0], row, setRows)} /></label>
    <label className={styles.wide}>Texte alternatif de l’image<input value={row.image_alt || ''} onChange={event => updateRow(setRows, row.id, 'image_alt', event.target.value)} placeholder="Décris brièvement l’image" /></label>
    {imageUrl && <div className={styles.preview}><img src={imageUrl} alt={row.image_alt || 'Aperçu de l’illustration'} /><button type="button" className={styles.textButton} onClick={() => { updateRow(setRows, row.id, 'image_path', null); updateRow(setRows, row.id, 'image_alt', '') }}>Retirer l’image du guide</button></div>}
  </div>
}

export default function AdminGuidePage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [topics, setTopics] = useState([])
  const [questions, setQuestions] = useState([])
  const [glossary, setGlossary] = useState([])
  const [selectedTopic, setSelectedTopic] = useState('bien-debuter')
  const [section, setSection] = useState('themes')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [newTopic, setNewTopic] = useState({ title: '', intro: '' })
  const [newQuestion, setNewQuestion] = useState({ question: '', answer: '' })
  const [newTerm, setNewTerm] = useState({ term: '', definition: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/login?next=%2Fadmin%2Fguide'); return }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!active) return
      if (profileError || profile?.is_admin !== true) { setLoading(false); return }
      setIsAdmin(true)
      const [topicResult, questionResult, glossaryResult] = await Promise.all([
        supabase.from('guide_topics').select('*').order('sort_order').order('id'),
        supabase.from('guide_questions').select('*').order('sort_order').order('id'),
        supabase.from('guide_glossary').select('*').order('sort_order').order('term')
      ])
      if (!active) return
      const failed = [topicResult, questionResult, glossaryResult].find(result => result.error)
      if (failed) setError('Le guide n’a pas pu être chargé. Vérifie la migration de la base puis actualise la page.')
      else {
        setTopics(topicResult.data || [])
        setQuestions(questionResult.data || [])
        setGlossary(glossaryResult.data || [])
        if (topicResult.data?.length) setSelectedTopic(topicResult.data[0].id)
      }
      setLoading(false)
    })().catch(() => { if (active) { setError('Une erreur a empêché le chargement du guide.'); setLoading(false) } })
    return () => { active = false }
  }, [supabase])

  const currentTopic = topics.find(item => item.id === selectedTopic)
  const topicQuestions = questions.filter(item => item.topic_id === selectedTopic)

  const setRow = updateRow

  async function saveRow(table, row, setRows, columns, label) {
    if (saving) return
    setSaving(row.id); setError(''); setNotice('')
    const payload = Object.fromEntries(columns.map(key => [key, row[key] ?? null]))
    payload.updated_at = new Date().toISOString()
    const { data, error: saveError } = await supabase.from(table).update(payload).eq('id', row.id).select('*').single()
    if (saveError) setError(`« ${label} » n’a pas été enregistré. ${saveError.message}`)
    else { setRows(rows => rows.map(item => item.id === row.id ? data : item)); setNotice(`« ${label} » enregistré. Les modifications sont visibles sur le guide.`) }
    setSaving('')
  }

  async function insertRow(table, row, setRows, label) {
    if (saving) return
    setSaving('new'); setError(''); setNotice('')
    const { data, error: insertError } = await supabase.from(table).insert(row).select('*').single()
    if (insertError) { setError(`Impossible d’ajouter ${label.toLowerCase()}. ${insertError.message}`); setSaving(''); return null }
    setRows(rows => [...rows, data].sort((a, b) => a.sort_order - b.sort_order))
    setNotice(`${label} ajouté${label.endsWith('e') ? 'e' : ''} au guide.`)
    setSaving('')
    return data
  }

  async function togglePublished(table, row, setRows, label) {
    const next = !row.is_published
    const { data, error: toggleError } = await supabase.from(table).update({ is_published: next, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').single()
    if (toggleError) return setError(`Impossible de modifier la publication de « ${label} ». ${toggleError.message}`)
    setRows(rows => rows.map(item => item.id === row.id ? { ...data, ...row, is_published: next, updated_at: data.updated_at } : item))
    setNotice(next ? `« ${label} » est de nouveau visible.` : `« ${label} » est masqué du guide. Tu pourras le réactiver ici.`)
  }

  async function uploadImage(file, row, setRows) {
    setError(''); setNotice('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return setError('Formats acceptés : JPG, PNG, WebP ou GIF.')
    if (file.size > 8 * 1024 * 1024) return setError('L’image doit faire 8 Mo maximum.')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setError('Ta session a expiré. Reconnecte-toi puis réessaie.')
    const path = `${user.id}/${Date.now()}-${slug(file.name) || 'illustration'}`
    const { error: uploadError } = await supabase.storage.from('guide-illustrations').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) return setError(`L’image n’a pas pu être envoyée. ${uploadError.message}`)
    setRow(setRows, row.id, 'image_path', path)
    setNotice('Image envoyée. Enregistre la rubrique pour afficher cette illustration sur le guide.')
  }

  if (loading) return <main className={styles.page}><p>Chargement de l’administration…</p></main>
  if (!isAdmin) return <main className={styles.page}><section className={styles.panel}><h1>Accès réservé</h1><p>Cette page est réservée à l’administration.</p><a href="/admin">Retour à l’administration</a></section></main>

  return <main className={styles.page}>
    <div className={styles.breadcrumb}><a href="/admin">← Administration</a><span>Guide et lexique</span></div>
    <header className={styles.header}><p className={styles.kicker}>Administration · Contenus éditoriaux</p><h1>Guide PokéValeur</h1><p>Modifie les thèmes, les réponses et le lexique, puis ajoute tes illustrations. Chaque enregistrement est publié immédiatement.</p><div className={styles.counts}><span>{topics.length} thèmes</span><span>{questions.length} questions</span><span>{glossary.length} définitions</span><a href="/guide" target="_blank" rel="noreferrer">Voir le guide public ↗</a></div></header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    <nav className={styles.tabs} aria-label="Rubriques du guide">{[['themes','Thèmes'],['questions','Questions / réponses'],['lexique','Lexique']].map(([id,label])=><button type="button" key={id} className={section===id?styles.activeTab:''} onClick={()=>setSection(id)}>{label}</button>)}</nav>

    {section === 'themes' && <div className={styles.layout}>
      <aside className={styles.panel}><h2>Thèmes existants</h2><div className={styles.topicList}>{topics.map(item=><button type="button" key={item.id} className={selectedTopic===item.id?styles.selectedTopic:''} onClick={()=>setSelectedTopic(item.id)}><span>{item.number}</span>{item.title}{!item.is_published&&<small>Masqué</small>}</button>)}</div></aside>
      {currentTopic && <form className={styles.panel} onSubmit={event=>{event.preventDefault();saveRow('guide_topics',currentTopic,setTopics,['number','title','intro','sort_order','is_published','image_path','image_alt'],'Thème')}}>
        <h2>Modifier le thème</h2><div className={styles.formGrid}>
          <label>Numéro<input value={currentTopic.number||''} onChange={e=>setRow(setTopics,currentTopic.id,'number',e.target.value)} /></label>
          <label>Ordre d’affichage<input type="number" value={currentTopic.sort_order} onChange={e=>setRow(setTopics,currentTopic.id,'sort_order',Number(e.target.value))} /></label>
          <label className={styles.wide}>Titre<input required value={currentTopic.title} onChange={e=>setRow(setTopics,currentTopic.id,'title',e.target.value)} /></label>
          <label className={styles.wide}>Introduction<textarea rows="4" value={currentTopic.intro} onChange={e=>setRow(setTopics,currentTopic.id,'intro',e.target.value)} /></label>
          <div className={styles.wide}><ImageFields row={currentTopic} setRows={setTopics} onUpload={uploadImage} /></div>
        </div><div className={styles.actions}><button className={styles.save} disabled={saving===currentTopic.id}>{saving===currentTopic.id?'Enregistrement…':'Enregistrer le thème'}</button><button type="button" className={styles.secondary} onClick={()=>togglePublished('guide_topics',currentTopic,setTopics,currentTopic.title)}>{currentTopic.is_published?'Masquer':'Réactiver'}</button></div>
      </form>}
      <form className={styles.panel} onSubmit={event=>{event.preventDefault();const id=newId(newTopic.title,Date.now().toString(36));insertRow('guide_topics',{id,number:String(topics.length+1).padStart(2,'0'),title:newTopic.title.trim(),intro:newTopic.intro.trim(),sort_order:topics.length+1,is_published:true,image_path:null,image_alt:''},setTopics,'Thème').then(row=>{if(row){setSelectedTopic(id);setNewTopic({title:'',intro:''})}})}}><h2>Ajouter un thème</h2><label>Titre<input required value={newTopic.title} onChange={e=>setNewTopic({...newTopic,title:e.target.value})} placeholder="Ex. Les collections" /></label><label>Introduction<textarea rows="3" value={newTopic.intro} onChange={e=>setNewTopic({...newTopic,intro:e.target.value})} /></label><button className={styles.save} disabled={saving==='new'}>Ajouter le thème</button></form>
    </div>}

    {section === 'questions' && <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Questions et réponses</h2><p>Les entrées masquées restent ici et peuvent être réactivées.</p></div><label>Thème<select value={selectedTopic} onChange={e=>setSelectedTopic(e.target.value)}>{topics.map(item=><option key={item.id} value={item.id}>{item.number} · {item.title}</option>)}</select></label></div>
      <form className={styles.newForm} onSubmit={event=>{event.preventDefault();if(!selectedTopic)return;const id=newId(newQuestion.question,Date.now().toString(36));insertRow('guide_questions',{id,topic_id:selectedTopic,question:newQuestion.question.trim(),answer:newQuestion.answer.trim(),sort_order:topicQuestions.length+1,is_published:true,image_path:null,image_alt:'',source_label:null,source_url:null},setQuestions,'Question').then(row=>{if(row)setNewQuestion({question:'',answer:''})})}}><h3>Ajouter une question</h3><label>Question<input required value={newQuestion.question} onChange={e=>setNewQuestion({...newQuestion,question:e.target.value})} /></label><label>Réponse<textarea required rows="4" value={newQuestion.answer} onChange={e=>setNewQuestion({...newQuestion,answer:e.target.value})} /></label><button className={styles.save} disabled={saving==='new'}>Ajouter la question</button></form>
      <div className={styles.entries}>{topicQuestions.map(item=><form key={item.id} className={`${styles.entry} ${!item.is_published?styles.hiddenEntry:''}`} onSubmit={event=>{event.preventDefault();saveRow('guide_questions',item,setQuestions,['topic_id','question','answer','sort_order','is_published','image_path','image_alt','source_label','source_url'],'Question')}}>
        <div className={styles.entryTitle}><strong>{item.question || 'Nouvelle question'}</strong><span>{item.is_published?'Publiée':'Masquée'}</span></div>
        <div className={styles.formGrid}><label className={styles.wide}>Question<input required value={item.question} onChange={e=>setRow(setQuestions,item.id,'question',e.target.value)} /></label><label className={styles.wide}>Réponse<textarea required rows="5" value={item.answer} onChange={e=>setRow(setQuestions,item.id,'answer',e.target.value)} /></label><label>Ordre<input type="number" value={item.sort_order} onChange={e=>setRow(setQuestions,item.id,'sort_order',Number(e.target.value))} /></label><label>Libellé de la source<input value={item.source_label||''} onChange={e=>setRow(setQuestions,item.id,'source_label',e.target.value)} /></label><label className={styles.wide}>Lien de la source<input type="url" value={item.source_url||''} onChange={e=>setRow(setQuestions,item.id,'source_url',e.target.value)} /></label><div className={styles.wide}><ImageFields row={item} setRows={setQuestions} onUpload={uploadImage} /></div></div>
        <div className={styles.actions}><button className={styles.save} disabled={saving===item.id}>{saving===item.id?'Enregistrement…':'Enregistrer'}</button><button type="button" className={styles.secondary} onClick={()=>togglePublished('guide_questions',item,setQuestions,item.question)}>{item.is_published?'Masquer':'Réactiver'}</button></div>
      </form>)}</div>
    </section>}

    {section === 'lexique' && <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Lexique</h2><p>Ajoute des termes et relie-les à un thème pour guider la lecture.</p></div></div>
      <form className={styles.newForm} onSubmit={event=>{event.preventDefault();const id=newId(newTerm.term,Date.now().toString(36));insertRow('guide_glossary',{id,term:newTerm.term.trim(),definition:newTerm.definition.trim(),topic_id:selectedTopic||null,sort_order:glossary.length+1,is_published:true,image_path:null,image_alt:''},setGlossary,'Définition').then(row=>{if(row)setNewTerm({term:'',definition:''})})}}><h3>Ajouter un terme</h3><label>Terme<input required value={newTerm.term} onChange={e=>setNewTerm({...newTerm,term:e.target.value})} /></label><label>Définition<textarea required rows="3" value={newTerm.definition} onChange={e=>setNewTerm({...newTerm,definition:e.target.value})} /></label><label>Thème lié<select value={selectedTopic} onChange={e=>setSelectedTopic(e.target.value)}>{topics.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button className={styles.save} disabled={saving==='new'}>Ajouter au lexique</button></form>
      <div className={styles.entries}>{glossary.map(item=><form key={item.id} className={`${styles.entry} ${!item.is_published?styles.hiddenEntry:''}`} onSubmit={event=>{event.preventDefault();saveRow('guide_glossary',item,setGlossary,['term','definition','topic_id','sort_order','is_published','image_path','image_alt'],'Définition')}}><div className={styles.entryTitle}><strong>{item.term}</strong><span>{item.is_published?'Publiée':'Masquée'}</span></div><div className={styles.formGrid}><label>Terme<input required value={item.term} onChange={e=>setRow(setGlossary,item.id,'term',e.target.value)} /></label><label>Ordre<input type="number" value={item.sort_order} onChange={e=>setRow(setGlossary,item.id,'sort_order',Number(e.target.value))} /></label><label className={styles.wide}>Définition<textarea required rows="3" value={item.definition} onChange={e=>setRow(setGlossary,item.id,'definition',e.target.value)} /></label><label className={styles.wide}>Thème lié<select value={item.topic_id||''} onChange={e=>setRow(setGlossary,item.id,'topic_id',e.target.value||null)}><option value="">Aucun thème</option>{topics.map(topic=><option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label><div className={styles.wide}><ImageFields row={item} setRows={setGlossary} onUpload={uploadImage} /></div></div><div className={styles.actions}><button className={styles.save} disabled={saving===item.id}>{saving===item.id?'Enregistrement…':'Enregistrer'}</button><button type="button" className={styles.secondary} onClick={()=>togglePublished('guide_glossary',item,setGlossary,item.term)}>{item.is_published?'Masquer':'Réactiver'}</button></div></form>)}</div>
    </section>}
    <p className={styles.footerNote}>Conseil : écris les réponses en texte simple, avec une ligne vide entre les paragraphes. Les modifications enregistrées sont publiées immédiatement.</p>
  </main>
}
