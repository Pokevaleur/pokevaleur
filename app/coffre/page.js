"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "../../lib/supabase-browser"

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

const visitorSurprises = surprises.filter(item => !item.partner && !item.badge && !item.xp)

function dayNumber(){const d=new Date();return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000)}

export default function CoffrePage(){
 const [opened,setOpened]=useState(false)
 const revealRef=useRef(null)
 const revealRequested=useRef(false)
 const [ready,setReady]=useState(false)
 const openingRef=useRef(false)
 const [opening,setOpening]=useState(false)
 const [openError,setOpenError]=useState("")
 const [member,setMember]=useState(false)
 const [serverReward,setServerReward]=useState(null)
 const [voucher,setVoucher]=useState(null)
 const [claiming,setClaiming]=useState(false)
 const [claimError,setClaimError]=useState("")
 const day=dayNumber()
 const partnerDay = day % 31 === 0
 const rareDay = !partnerDay && day % 17 === 0
 const surprise=useMemo(()=>partnerDay?surprises[0]:rareDay?surprises[1]:surprises[2+(day%(surprises.length-2))],[day,rareDay,partnerDay])
 useEffect(()=>{
  const supabase=createClient()
  async function load(){
    const {data:{user}}=await supabase.auth.getUser()
    setMember(!!user)
    if(user){
      const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date())
      const datePart=type=>parts.find(part=>part.type===type).value
      const today=`${datePart("year")}-${datePart("month")}-${datePart("day")}`
      const {data}=await supabase.from("chest_openings").select("opened_on").eq("user_id",user.id).eq("opened_on",today).maybeSingle()
      if(data){
        const {data:reward}=await supabase.rpc("open_daily_chest")
        if(reward) setServerReward(reward)
      }
      setOpened(!!data)
    }else setOpened(localStorage.getItem("lukulu-chest-day")===String(day))
    setReady(true)
  }
  load()
 },[day])
 useEffect(()=>{
  if(!opened||!revealRequested.current)return
  revealRequested.current=false
  const frame=requestAnimationFrame(()=>{
   const reward=revealRef.current
   if(!reward)return
   reward.focus({preventScroll:true})
   const rect=reward.getBoundingClientRect()
   if(rect.bottom>window.innerHeight||rect.top<90)reward.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"})
  })
  return ()=>cancelAnimationFrame(frame)
 },[opened])
 async function claimVoucher(){
  if(!member||claiming)return
  setClaiming(true);setClaimError("")
  const supabase=createClient()
  const {data,error}=await supabase.rpc("claim_partner_voucher")
  if(error){setClaimError("Le cadeau n’est pas disponible pour le moment.");setClaiming(false);return}
  setVoucher(data);setClaiming(false)
 }
 async function openChest(){
  if(!ready||opened||openingRef.current)return
  openingRef.current=true;setOpening(true);setOpenError("")
  try{
   if(member){
    const supabase=createClient()
    const {data,error}=await supabase.rpc("open_daily_chest")
    if(error||!data)throw error||new Error("Récompense indisponible")
    setServerReward(data)
   }else localStorage.setItem("lukulu-chest-day",String(day))
   revealRequested.current=true
   setOpened(true)
  }catch{
   setOpenError("Le coffre n’a pas pu être ouvert. Réessaie dans un instant : aucun gain supplémentaire ne sera compté.")
  }finally{
   openingRef.current=false;setOpening(false)
  }
 }

 const shown=!member?visitorSurprises[day%visitorSurprises.length]:member&&serverReward?{icon:serverReward.icon,type:serverReward.label,title:serverReward.title,text:serverReward.body,xp:serverReward.xp_awarded,badge:serverReward.badge_key,partner:serverReward.reward_type==="partner"}:surprise
 const revealKind=shown.partner?"partner":shown.badge?"rare":shown.xp>0?"xp":"normal"
 const lukuluReaction=opened?({partner:"Lukulu a trouvé un vrai trésor ! 🎁",rare:"Lukulu semble très fier de cette trouvaille. ✨",xp:"Quelques éclats de plus pour ta progression ! 💎",normal:"Une nouvelle découverte gardée pour toi. 💙"}[revealKind]):"Lukulu veille sur le coffre…"
 return <main className="chestPage">
  <section className="chestHero crystalHero">
   <div className="chestCopy"><span className="chestEyebrow">LE COFFRE DE LUKULU</span><h1>Ton trésor du jour</h1><p className="chestIntro">Une surprise à découvrir avec Lukulu.{member&&<span className="chestXpPromise"> +1 XP par ouverture quotidienne</span>}</p>{openError&&<p role="alert" className="chestOpenError">{openError}</p>}</div>
   <div className="chestScene">
    <div className={"lukuluReaction "+(opened?revealKind:"waiting")}><span>{lukuluReaction}</span><img src={opened?"/coffre/lukulu-happy.webp":"/coffre/lukulu-waiting.webp"} alt={opened?"Lukulu célèbre ta découverte":"Lukulu veille sur ton coffre"} className="chestLukulu"/></div>
    <button className={"crystalChest "+(opened?"open":"")} onClick={openChest} disabled={!ready||opened||opening} aria-label={opened?"Coffre ouvert, surprise découverte":"Ouvrir le coffre de Lukulu"}><img src={opened?"/coffre/chest-blue-open.webp":"/coffre/chest-blue-closed.webp"} alt=""/><span className="crystalAction">{opened?"À demain ✦":opening?"Ouverture…":"Toucher pour ouvrir ✦"}</span></button>
   </div>
  <section ref={revealRef} tabIndex={-1} aria-label="Ta surprise du jour" aria-live="polite" className={"dailyReveal "+(opened?"revealed "+revealKind+"Reveal ":"")}>
   {!opened?null:
   <article className="surpriseCard"><span className="surpriseIcon">{shown.icon}</span><div><small>{shown.type}</small><h2>{shown.title}</h2><p>{shown.text}</p>{member&&serverReward&&shown.xp>0&&<div className="chestXpSummary"><b className="xpReward">+{shown.xp} XP {serverReward.already_opened?"obtenus aujourd’hui":"gagnés"}</b>{Number.isFinite(serverReward.total_xp)&&<a href="/progression">Mon compteur : <strong>{serverReward.total_xp} XP</strong> →</a>}</div>}{shown.badge&&<b className="badgeReward">🏅 Badge débloqué</b>}{shown.partner&&<div className="partnerReward"><b>🎟️ Récompense partenaire</b>{!voucher?<><span>Ton cadeau est réservé. Réclame-le pour afficher ton code personnel.</span><button type="button" className="claimRewardBtn" onClick={claimVoucher} disabled={claiming}>{claiming?"Attribution en cours…":"Réclamer mon cadeau"}</button>{claimError&&<small className="claimError">{claimError}</small>}</>:<div className="voucherCard"><small>OFFERT PAR</small><strong>{voucher.partner}</strong><h3>{voucher.title}</h3>{voucher.description&&<p>{voucher.description}</p>}<div className="voucherCode"><span>TON CODE</span><b>{voucher.code}</b></div>{voucher.valid_until&&<small>Valable jusqu’au {new Date(voucher.valid_until).toLocaleDateString("fr-FR")}</small>}{voucher.terms&&<small className="voucherTerms">{voucher.terms}</small>}</div>}</div>}<span className="tomorrow">Reviens demain : Lukulu prépare déjà autre chose…</span></div></article>}
  </section>
  </section>
  <div hidden aria-hidden="true"><img src="/coffre/lukulu-happy.webp" alt=""/><img src="/coffre/chest-blue-open.webp" alt=""/></div>
  <section className="chestDetails"><p>Conseil, découverte, petit défi ou bonus : Lukulu garde chaque jour quelque chose pour les collectionneurs curieux.</p><div className="chestRule">✦ Un seul coffre par jour • Une nouvelle surprise demain</div>{!member&&ready&&<div className="chestLoginHint">Découvre gratuitement un conseil ou un défi. Aucun XP, badge ou cadeau n’est attribué en visiteur. <a href="/login?next=%2Fcoffre">Connecte-toi pour accéder aux récompenses et retrouver ton historique.</a></div>}<div className="chestRarity">Les membres connectés peuvent aussi découvrir un coffre <b>doré</b> et des cadeaux partenaires, selon les disponibilités. 👀</div></section>
  <section className="chestFooter"><h2>Les surprises peuvent venir de toutes les générations.</h2><p>Le coffre pourra bientôt contenir des actualités, anecdotes, défis, découvertes du catalogue, badges rares et petites récompenses de progression.</p><a href="/progression" className="btn">Voir mon grade</a></section>
 </main>
}
