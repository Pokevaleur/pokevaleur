"use client"

import { useEffect, useMemo, useState } from "react"

const surprises=[
 {icon:"🎁",type:"Cadeau partenaire",title:"Un cadeau offert par un partenaire",text:"Certains coffres pourront contenir un bon d’achat ou un avantage offert par une boutique partenaire. La récompense indiquera clairement le partenaire, sa durée de validité et ses conditions.",rare:true,partner:true},
 {icon:"🌟",type:"Surprise rare",title:"Le coffre doré de Lukulu",text:"Aujourd'hui est un jour spécial. Tu viens de trouver une surprise rare : le badge Éclat doré sera débloqué lorsque les badges seront reliés à ton compte.",rare:true,badge:"Éclat doré"},
 {icon:"💡",type:"Astuce de Lukulu",title:"Protège aussi tes produits scellés",text:"La lumière, l'humidité et les variations de température peuvent marquer un emballage avec le temps. Un rangement stable et à l'abri de la lumière aide à préserver son état."},
 {icon:"🔎",type:"Le savais-tu ?",title:"Une collection raconte une époque",text:"Les emballages, artworks et formats de produits évoluent avec les générations. Conserver ces détails dans ta fiche rend ta collection plus intéressante à suivre."},
 {icon:"🧩",type:"Mini-défi",title:"Inspecte un de tes artsets",text:"Choisis aujourd'hui une série et vérifie si tous tes artworks sont bien renseignés. Une petite vérification peut révéler une pièce manquante."},
 {icon:"📚",type:"Conseil collection",title:"Documente la provenance",text:"Quand tu ajoutes une pièce, renseigne son lieu et son prix d'achat. Dans quelques années, cet historique fera partie de l'histoire de ta collection."},
 {icon:"✨",type:"Mission du jour",title:"Redécouvre une pièce oubliée",text:"Ouvre ta collection au hasard et regarde un objet que tu n'as pas consulté depuis longtemps. C'est parfois là que se cachent les meilleurs souvenirs."},
 {icon:"💎",type:"Bonus Lukulu",title:"+2 XP aujourd'hui",text:"Tu as ouvert le coffre du jour. Cette récompense sera reliée à ton vrai compte lorsque le système d'XP sera activé.",xp:2},
 {icon:"🕰️",type:"Coin vintage",title:"Regarde au-delà des nouveautés",text:"Les anciennes générations méritent aussi leur place dans PokéValeur. Aujourd'hui, explore une série que tu collectionnais moins ou que tu ne connais pas encore."}
]

function dayNumber(){const d=new Date();return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000)}

export default function CoffrePage(){
 const [opened,setOpened]=useState(false)
 const [ready,setReady]=useState(false)
 const day=dayNumber()
 const partnerDay = day % 31 === 0
 const rareDay = !partnerDay && day % 17 === 0
 const surprise=useMemo(()=>partnerDay?surprises[0]:rareDay?surprises[1]:surprises[2+(day%(surprises.length-2))],[day,rareDay,partnerDay])
 useEffect(()=>{setOpened(localStorage.getItem("lukulu-chest-day")===String(day));setReady(true)},[day])
 function openChest(){localStorage.setItem("lukulu-chest-day",String(day));setOpened(true)}
 return <main className="chestPage">
  <section className="chestHero">
   <div className="chestCopy"><span className="chestEyebrow">LE COFFRE DE LUKULU</span><h1>Une surprise t'attend chaque jour.</h1><p>Conseil, découverte, petit défi ou bonus : Lukulu garde chaque jour quelque chose pour les collectionneurs curieux.</p><div className="chestRule">✦ Un seul coffre par jour • Une nouvelle surprise demain</div><div className="chestRarity">Certains jours, le coffre peut être <b>doré</b>… et cacher un vrai cadeau. 👀</div></div>
   <div className="chestScene">
    <img src="/Lukulu-1.png" alt="Lukulu" className="chestLukulu"/>
    <button className={"treasureChest "+(opened?"open ":"")+((rareDay||partnerDay)?"golden":"")+(partnerDay?" partner":"")} onClick={openChest} disabled={!ready||opened} aria-label="Ouvrir le coffre de Lukulu"><span className="chestGlow">✦</span><span className="chestLid"></span><span className="chestBody"><i>◆</i></span></button>
   </div>
  </section>
  <section className={"dailyReveal "+(opened?"revealed ":"")+((rareDay||partnerDay)?"rareReveal":"")+(partnerDay?" partnerReveal":"")}>
   {!opened?<div className="chestWaiting"><span>🔒</span><h2>Le coffre est encore fermé</h2><p>Touche le coffre pour découvrir la surprise de Lukulu.</p></div>:
   <article className="surpriseCard"><span className="surpriseIcon">{surprise.icon}</span><div><small>{surprise.type}</small><h2>{surprise.title}</h2><p>{surprise.text}</p>{surprise.xp&&<b className="xpReward">+{surprise.xp} XP</b>}{surprise.badge&&<b className="badgeReward">🏅 Badge : {surprise.badge}</b>}{surprise.partner&&<div className="partnerReward"><b>🎟️ Récompense partenaire</b><span>Le bouton de réclamation apparaîtra ici lorsqu’un partenaire sera actif.</span></div>}<span className="tomorrow">Reviens demain : Lukulu prépare déjà autre chose…</span></div></article>}
  </section>
  <section className="chestFooter"><h2>Les surprises peuvent venir de toutes les générations.</h2><p>Le coffre pourra bientôt contenir des actualités, anecdotes, défis, découvertes du catalogue, badges rares et petites récompenses de progression.</p><a href="/progression" className="btn">Voir mon grade</a></section>
 </main>
}