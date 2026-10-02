'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import styles from './home.module.css'

const categories = [['sealed', 'Scellés'], ['graded', 'Cartes gradées'], ['binder', 'Master sets']]
const avatars = ['Loutre', 'Chouette', 'Petit papillon', 'Panda roux', 'Raton laveur', 'Hérisson', 'Phoque', 'Petit galet', 'Alpaga', 'Renard', 'Petit nuage', 'Chat', 'Blaireau', 'Fennec', 'Macareux', 'Petite feuille']

function Art({ kind, label, className = '' }) {
  if (kind === 'lukulu' || kind === 'chest') return <img className={`${styles.art} ${styles[kind]} ${className}`} src={kind === 'lukulu' ? '/accueil/lukulu-solo.webp' : '/accueil/chest-floating.webp'} alt={label} loading="lazy"/>
  const windows = {
    sealed: '510 640 130 120', graded: '665 640 135 120', binder: '835 640 150 120',
    cards: '490 827 70 70', missing: '32 942 125 78',
    beginner: '383 936 88 87', experienced: '747 943 38 70',
    lukulu: '570 1168 195 250', chest: '801 1193 195 225',
  }
  return <svg role="img" aria-label={label} viewBox={windows[kind]} className={`${styles.art} ${styles[kind]} ${className}`}>
    <image href="/accueil/approved-desktop.webp" width="1024" height="1536"/>
  </svg>
}

function ValueChart() {
  const points = [[44,174],[84,152],[124,165],[164,132],[204,111],[244,143],[284,127],[324,122],[364,105],[404,87],[444,99],[484,65],[524,44],[564,19]]
  const line = points.map(p => p.join(',')).join(' ')
  return <article className={`${styles.card} ${styles.chartCard}`}>
    <div className={styles.chartTitle}><h2><span aria-hidden="true">▥</span> L’évolution de la valeur de ta collection</h2><div><span>1 an</span><small>Exemple</small></div></div>
    <svg className={styles.chart} viewBox="0 0 590 230" role="img" aria-label="Exemple de l’évolution d’une valeur de collection en euros, de janvier à septembre. Ces chiffres ne représentent pas ta collection.">
      <defs><linearGradient id="home-value-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3697f5" stopOpacity=".35"/><stop offset="1" stopColor="#3697f5" stopOpacity=".02"/></linearGradient></defs>
      {[20,80,140,200].map((y,i) => <g key={y}><line x1="44" y1={y} x2="564" y2={y} stroke="#e7edf5"/><text x="35" y={y+4} textAnchor="end" className={styles.chartTick}>{[800,600,400,200][i]} €</text></g>)}
      <polygon points={`44,200 ${line} 564,200`} fill="url(#home-value-fill)"/>
      <polyline points={line} stroke="#1976ed" strokeWidth="3" fill="none" strokeLinejoin="round"/>
      {points.map(([x,y],i) => <circle key={x} cx={x} cy={y} r={i===13?6:4} fill="#fff" stroke={i%3===0?'#efae1b':'#1976ed'} strokeWidth="2"/>)}
      {['Jan','Mars','Mai','Juil','Sept'].map((m,i) => <text key={m} x={44+i*130} y="225" textAnchor={i===0?'start':i===4?'end':'middle'} className={styles.chartMonth}>{m}</text>)}
    </svg>
  </article>
}

export default function Home() {
  const [member, setMember] = useState(false)
  useEffect(() => {
    let active = true
    const supabase = createClient()
    const sync = async () => {
      try { const { data: { user }, error } = await supabase.auth.getUser(); if (active) setMember(!error && Boolean(user)) }
      catch { if (active) setMember(false) }
    }
    sync()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { if (active) setMember(false); setTimeout(() => { if (active) sync() }, 0) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <h1>Chaque collection<br/>a ses <span>trésors.</span></h1>
        <p>Scellés, cartes gradées et master sets : organise ta collection et partage ta passion.</p>
        <a className={styles.join} href={member ? '/collection' : '/login'}>{member ? 'Retrouve ma collection' : 'Rejoins PokéValeur'}</a>
      </div>
      <img className={styles.heroArt} src="/accueil/hero-crystals.webp" alt="Un album, un produit scellé et une carte gradée, illustrés comme des trésors de collection" fetchPriority="high"/>
    </section>
    {member && <nav className={styles.memberLinks} aria-label="Mon espace de collectionneur"><a href="/collection#ajouter-produit">Ajouter un achat</a><a href="/opportunites">Mes doublons et souhaits</a><a href="/communaute">Communauté</a><a href="/coffre">Mon coffre du jour</a></nav>}
    <section className={styles.dashboard} aria-label="Les services de PokéValeur, exemples de présentation">
      <ValueChart/>
      <div className={styles.productTypes}>{categories.map(([kind,label]) => <article className={`${styles.card} ${styles.type}`} key={kind}><Art kind={kind} label={`Illustration : ${label}`}/><h2>{label}</h2></article>)}</div>
      <div className={styles.metrics}>
        <article className={`${styles.card} ${styles.master}`}><Art kind="cards" label="Quelques cartes de collection"/><div><h2>Master set</h2><div className={styles.progressNumber}><strong>186 / 210</strong><small>Exemple</small></div><div className={styles.progress} role="img" aria-label="Exemple : 186 cartes sur 210, soit environ 89 %"><span/></div></div></article>
        <article className={`${styles.card} ${styles.duplicates}`}><Art kind="cards" label="Des exemplaires à comparer"/><div><h2>Doublons à vérifier</h2><p>Compare tes exemplaires.</p></div></article>
      </div>
      <div className={styles.services}>
        <article className={`${styles.card} ${styles.missing}`}><Art kind="missing" label="Un emplacement de carte à compléter"/><div><h2>Trouve la pièce manquante</h2><p>Complète tes séries grâce aux échanges entre passionnés.</p></div></article>
        <article className={`${styles.card} ${styles.audience}`}><Art kind="beginner" label="Des livres pour apprendre"/><div><h2>Tu débutes ?</h2><p>Des conseils pour constituer ta collection à ton rythme.</p></div></article>
        <article className={`${styles.card} ${styles.audience}`}><Art kind="experienced" label="Des informations pour compléter ses connaissances"/><div><h2>Tu collectionnes déjà ?</h2><p>Complète tes séries et partage tes connaissances.</p></div></article>
      </div>
    </section>
    <section className={styles.social} aria-label="Partager sa passion et apprendre avec Lukulu">
      <div className={styles.community}><h2><span aria-hidden="true">♧</span> Une passion à partager</h2><p>Rencontre d’autres passionnés et échange tes découvertes.</p><div className={styles.avatars} aria-label="Exemples d’avatars originaux">{avatars.map((label,i) => <div key={label} role="img" aria-label={`Avatar original : ${label}`} className={styles.avatar} style={{backgroundPosition:`${(i%4)*100/3}% ${Math.floor(i/4)*100/3}%`}}/>)}</div><small>Exemples d’avatars</small></div>
      <div className={styles.guides}>
        <article className={`${styles.card} ${styles.guide}`}><h2>Lukulu t’accompagne</h2><p>Des conseils pour apprendre et faire grandir ta collection.</p><Art kind="lukulu" label="Lukulu, le gardien de tes trésors, te salue"/></article>
        <article className={`${styles.card} ${styles.guide}`}><h2>Le coffre de Lukulu</h2><p>Conseils, découvertes ou cadeaux selon les disponibilités.</p><Art kind="chest" label="Le coffre bleu scintillant de Lukulu"/></article>
      </div>
    </section>
  </main>
}
