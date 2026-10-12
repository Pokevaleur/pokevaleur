'use client'

import CollectionMockup from '../collection-mockup'

export default function RejoindrePage() {
  return (
    <>
      <CollectionMockup isMember={false} />
      <section className="narrow" style={{display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap',padding:'20px 0 36px'}}>
        <a className="btn" href="/login?mode=signup&next=%2Fcollection%2Faccueil">Créer mon compte gratuit</a>
        <a className="btn ghost" href="/login?next=%2Fcollection%2Faccueil">J’ai déjà un compte</a>
      </section>
    </>
  )
}
