"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "../../lib/supabase-browser"

const ranks=[["Curieux",0,"✦"],["Chercheur",100,"✧"],["Collectionneur",300,"◆"],["Connaisseur",700,"◇"],["Expert",1400,"✦"],["Gardien",2500,"💎"],["Grand Gardien",4500,"👑"]]
const badges=[["🗝️","Premier coffre","Ouvrir son premier coffre","premier-coffre"],["✨","Ami de Lukulu","Ouvrir 7 coffres","ami-de-lukulu"],["🌟","30 jours avec Lukulu","Ouvrir 30 coffres","30-jours-avec-lukulu"],["💯","Premier cap","Atteindre 100 XP","premier-cap"],["💎","Mille éclats","Atteindre 1 000 XP","mille-eclats"],["🎁","Chanceux de Lukulu","Réclamer un cadeau partenaire","chanceux-de-lukulu"],["🧩","Maître des artsets","Compléter plusieurs artsets","artset-master"],["📚","Archiviste","Enrichir des fiches du catalogue","archiviste"]]
const actions=[["Ajouter un produit correctement renseigné","+5 XP"],["Ajouter une photo utile","+3 XP"],["Compléter un artset","+20 XP"],["Contribution catalogue validée","+25 XP"],["Trade finalisé","+15 XP"],["Ouvrir le coffre de Lukulu","+2 XP / jour"],["Visite active","+1 XP / jour"]]

export default function ProgressionPage(){
 const [xp,setXp]=useState(0)
 const [history,setHistory]=useState([])
 const [earned,setEarned]=useState([])
 const [connected,setConnected]=useState(false)
 useEffect(()=>{
  const supabase=createClient()
  async function load(){
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setXp(Number(localStorage.getItem("pokevaleur-demo-xp")||0));return}
    setConnected(true)
    const {data}=await supabase.rpc("get_member_progression")
    if(data){setXp(data.xp||0);setHistory(data.chest_history||[]);setEarned(data.badges||[])}
  }
  load()
 },[])
 const index=useMemo(()=>{let n=0;ranks.forEach((r,i)=>{if(xp>=r[1])n=i});return n},[xp])
 const current=ranks[index], next=ranks[index+1]
 const progress=next?Math.min(100,((xp-current[1])/(next[1]-current[1]))*100):100
 return <main className="progressPage">
  <section className="progressHero"><div><span className="progressEyebrow">PROGRESSION POKÉVALEUR</span><h1>Grandis aux côtés de Lukulu.</h1><p>Ton grade récompense ta fidélité et surtout ce que tu apportes à ta collection et à la communauté. Pas besoin de rester connecté des heures : ce sont les actions utiles qui comptent.</p></div><div className="rankCard"><span className="rankCrystal">{current[2]}</span><small>TON GRADE</small><strong>{current[0]}</strong><b>{xp} XP</b><div className="rankBar"><i style={{width:progress+"%"}} /></div><span>{next?(next[1]-xp)+" XP avant "+next[0]:"Grade maximum atteint"}</span></div></section>
  <section className="progressSection"><div className="progressTitle"><span>Les 7 grades</span><h2>Une progression qui raconte ton parcours</h2></div><div className="rankGrid">{ranks.map((r,i)=><article className={i===index?"active":""} key={r[0]}><em>{r[2]}</em><small>NIVEAU {i+1}</small><strong>{r[0]}</strong><span>Dès {r[1]} XP</span></article>)}</div></section>
  <section className="progressTwoCols"><article className="progressPanel"><span className="progressEyebrow dark">GAGNER DE L'XP</span><h2>Les bonnes actions sont récompensées</h2><div className="xpList">{actions.map(([a,b])=><div key={a}><span>{a}</span><b>{b}</b></div>)}</div><p className="progressNote">Les actions répétitives seront plafonnées et les contributions communautaires ne compteront qu'après validation.</p></article><article className="progressPanel"><span className="progressEyebrow dark">BADGES</span><h2>Collectionne aussi tes exploits</h2><div className="badgeGrid">{badges.map(([icon,name,desc,key])=>{const got=earned.some(b=>b.key===key);return <div className={got?"badgeEarned":"badgeLocked"} key={name}><em>{got?icon:"🔒"}</em><span><strong>{name}</strong><small>{got?"Obtenu • "+desc:desc}</small></span></div>})}</div></article></section>
  <section className="progressHistory">
   <div className="progressTitle"><span>Mon parcours</span><h2>Mes dernières découvertes avec Lukulu</h2></div>
   {!connected?<p className="historyEmpty">Connecte-toi pour retrouver ici ton historique personnel.</p>:history.length===0?<p className="historyEmpty">Ton histoire commence ici. Ouvre ton premier coffre de Lukulu !</p>:<div className="historyList">{history.slice(0,8).map((h,i)=><div key={h.opened_on+"-"+i}><span className="historyIcon">{h.reward_type==="partner"?"🎁":h.reward_type==="badge"?"🏅":h.reward_type==="xp"?"✨":"🔐"}</span><span><strong>{h.reward_type==="partner"?"Cadeau partenaire":h.reward_type==="badge"?"Badge découvert":h.reward_type==="xp"?"Bonus XP":"Coffre ouvert"}</strong><small>{new Date(h.opened_on+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}{h.xp_awarded?(" • +"+h.xp_awarded+" XP"):""}</small></span></div>)}</div>}
   {connected&&<div className="earnedCount">🏅 {earned.length} badge{earned.length!==1?"s":""} obtenu{earned.length!==1?"s":""}</div>}
  </section>
  <section className="progressRules"><h2>L'esprit PokéValeur</h2><p>Le grade ne dépend ni de la valeur de ta collection ni de l'argent dépensé. Il reflète l'ancienneté, la régularité et les contributions utiles. Les badges permettent ensuite à chacun d'avoir sa propre personnalité de collectionneur.</p><a className="btn" href="/">Retour à l'accueil</a></section>
 </main>
}