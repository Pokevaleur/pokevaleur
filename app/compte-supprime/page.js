'use client'

export default function AccountDeletedPage() {
  return (
    <main className="narrow profilePage">
      <section className="panel">
        <span className="eyebrow dark">Mon compte</span>
        <h1>Compte supprimé</h1>
        <p>Ton compte et les données personnelles qui lui étaient associées ont été supprimés.</p>
        <a className="btn" href="/">Retour à l’accueil</a>
      </section>
    </main>
  )
}
