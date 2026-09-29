"use client"

import { useEffect, useMemo, useState } from "react"

const ranks=[["Curieux",0,"✦"],["Chercheur",100,"✧"],["Collectionneur",300,"◆"],["Connaisseur",700,"◇"],["Expert",1400,"✦"],["Gardien",2500,"💎"],["Grand Gardien",4500,"👑"]]
const badges=[["🧩","Maître des artsets","Compléter plusieurs artsets"],["🕰️","Chasseur de vintage","Ajouter des pièces anciennes"],["✨","30 jours avec Lukulu","Revenir régulièrement"],["🤝","Main tendue","Contribuer utilement à la communauté"],["📚","Archiviste","Enrichir des fiches du catalogue"],["🔎","Œil de Lukulu","Signaler une correction validée"]]
const actions=[["Ajouter un produit correctement renseigné","+5 XP"],["Ajouter une photo utile","+3 XP"],["Compléter un artset","+20 XP"],["Contribution catalogue validée","+25 XP"],["Trade finalisé","+15 XP"],["Ouvrir le coffre de Lukulu","+2 XP / jour"],["Visite active","+1 XP / jour"]]

export default function ProgressionPage(){
 const [xp,setXp]=useState(0)
 useEffect(()=>setXp(Number(localStorage.getItem("pokevaleur-demo-xp")||0)),[])
 const index=useMemo(()=>{let n=0;ranks.forEach((r,i)=>{if(xp>=r[1])n=i});return n},[xp])
 const current=ranks[index], next=ranks[index+1]
 const progress=next?Math.min(100,((xp-current[1])/(next[1]-current[1]))*100):100
 return <main className="progressPage">
  <section className="progressHero"><div><span className="progressEyebrow">PROGRESSION POKÉVALEUR</span><h1>Grandis aux côtés de Lukulu.</h1><p>Ton grade récompense ta fidélité et surtout ce que tu apportes à ta collection et à la communauté. Pas besoin de rester connecté des heures : ce sont les actions utiles qui comptent.</p></div><div className="rankCard"><span className="rankCrystal">{current[2]}</span><small>TON GRADE</small><strong>{current[0]}</strong><b>{xp} XP</b><div className="rankBar"><i style={{width:progress+"%"}} /></div><span>{next?(next[1]-xp)+" XP avant "+next[0]:"Grade maximum atteint"}</span></div></section>
  <section className="progressSection"><div className="progressTitle"><span>Les 7 grades</span><h2>Une progression qui raconte ton parcours</h2></div><div className="rankGrid">{ranks.map((r,i)=><article className={i===index?"active":""} key={r[0]}><em>{r[2]}</em><small>NIVEAU {i+1}</small><strong>{r[0]}</strong><span>Dès {r[1]} XP</span></article>)}</div></section>
  <section className="progressTwoCols"><article className="progressPanel"><span className="progressEyebrow dark">GAGNER DE L'XP</span><h2>Les bonnes actions sont récompensées</h2><div className="xpList">{actions.map(([a,b])=><div key={a}><span>{a}</span><b>{b}</b></div>)}</div><p className="progressNote">Les actions répétitives seront plafonnées et les contributions communautaires ne compteront qu'après validation.</p></article><article className="progressPanel"><span className="progressEyebrow dark">BADGES</span><h2>Collectionne aussi tes exploits</h2><div className="badgeGrid">{badges.map(([icon,name,desc])=><div key={name}><em>{icon}</em><span><strong>{name}</strong><small>{desc}</small></span></div>)}</div></article></section>
  <section className="progressRules"><h2>L'esprit PokéValeur</h2><p>Le grade ne dépend ni de la valeur de ta collection ni de l'argent dépensé. Il reflète l'ancienneté, la régularité et les contributions utiles. Les badges permettent ensuite à chacun d'avoir sa propre personnalité de collectionneur.</p><a className="btn" href="/">Retour à l'accueil</a></section>
 </main>
}