"use client"
import {useState} from "react"

const modes={
 normal:{label:"ASTUCE DE LUKULU",title:"Une nouvelle découverte",text:"Lukulu a gardé une petite surprise pour ta collection.",bubble:"Une nouvelle découverte gardée pour toi. 💙",icon:"💡"},
 rare:{label:"SURPRISE RARE",title:"Éclat doré débloqué !",text:"Un badge rare vient de rejoindre tes exploits PokéValeur.",bubble:"Lukulu semble très fier de cette trouvaille. ✨",icon:"🌟"},
 partner:{label:"CADEAU PARTENAIRE",title:"Un vrai trésor !",text:"Un cadeau partenaire est réservé. Le code personnel apparaît uniquement après réclamation.",bubble:"Lukulu a trouvé un vrai trésor ! 🎁",icon:"🎁"}
}
export default function CoffreApercu(){
 const [mode,setMode]=useState("rare"),[opened,setOpened]=useState(true)
 const m=modes[mode]
 return <main className="previewPage"><section className="previewHead"><span>APERÇU VISUEL</span><h1>Le coffre de Lukulu</h1><p>Voici le rendu de travail avec le vrai Lukulu du site. Change de récompense pour voir son attitude.</p><div className="previewTabs">{Object.keys(modes).map(k=><button className={mode===k?"active":""} onClick={()=>{setMode(k);setOpened(true)}} key={k}>{k==="normal"?"Coffre normal":k==="rare"?"Badge rare":"Cadeau partenaire"}</button>)}</div></section><section className={"previewStage "+mode+(opened?" opened":"")}><div className={"lukuluReaction "+(opened?mode:"waiting")}><span>{opened?m.bubble:"Lukulu veille sur le coffre…"}</span><img src="/Lukulu-1.png" alt="Lukulu" className="chestLukulu"/></div><button className={"treasureChest "+(opened?"open "+mode+" golden":"")} onClick={()=>setOpened(!opened)}><span className="chestGlow">✦</span><span className="chestLid"></span><span className="chestBody"><i>◆</i></span></button></section>{opened&&<article className={"previewReward "+mode}><span>{m.icon}</span><div><small>{m.label}</small><h2>{m.title}</h2><p>{m.text}</p>{mode==="rare"&&<b className="badgeReward">🏅 Badge Éclat doré</b>}{mode==="partner"&&<button className="claimRewardBtn">Réclamer mon cadeau</button>}</div></article>}<button className="previewReset" onClick={()=>setOpened(!opened)}>{opened?"Refermer le coffre":"Ouvrir le coffre"}</button></main>
}