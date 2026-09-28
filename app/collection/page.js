'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function CollectionPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ custom_name:'', quantity:1, purchase_price:'', purchase_date:'', purchase_place:'', current_value_override:'' })
  const [message, setMessage] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) return
    const { data, error } = await supabase.from('collection_items').select('*').order('created_at', { ascending:false })
    if (error) setMessage(error.message)
    else setItems(data || [])
  }

  useEffect(() => { load() }, [])

  async function addItem(e) {
    e.preventDefault()
    if (!user) return setMessage('Connecte-toi d’abord.')
    const payload = {
      user_id: user.id,
      custom_name: form.custom_name,
      quantity: Number(form.quantity || 1),
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_date: form.purchase_date || null,
      purchase_place: form.purchase_place || null,
      current_value_override: form.current_value_override ? Number(form.current_value_override) : null
    }
    const { error } = await supabase.from('collection_items').insert(payload)
    if (error) return setMessage(error.message)
    setForm({ custom_name:'', quantity:1, purchase_price:'', purchase_date:'', purchase_place:'', current_value_override:'' })
    setMessage('Produit ajouté.')
    load()
  }

  const invested = items.reduce((s,i)=>s+(Number(i.purchase_price)||0)*(i.quantity||1),0)
  const current = items.reduce((s,i)=>s+(Number(i.current_value_override)||Number(i.purchase_price)||0)*(i.quantity||1),0)

  if (!user) return <main className="narrow"><section className="panel"><h1>Ma collection</h1><p>Connecte-toi pour accéder à ta collection personnelle.</p><a className="btn" href="/login">Connexion / inscription</a></section></main>

  return (
    <main>
      <section className="stats">
        <div><span>Investi</span><strong>{invested.toFixed(2)} €</strong></div>
        <div><span>Valeur actuelle</span><strong>{current.toFixed(2)} €</strong></div>
        <div><span>Écart</span><strong>{(current-invested).toFixed(2)} €</strong></div>
        <div><span>Items</span><strong>{items.reduce((s,i)=>s+(i.quantity||1),0)}</strong></div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <h2>Ajouter un produit</h2>
          <form onSubmit={addItem} className="formGrid">
            <label>Nom du produit<input value={form.custom_name} onChange={e=>setForm({...form,custom_name:e.target.value})} required /></label>
            <label>Quantité<input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} /></label>
            <label>Prix d’achat (€)<input type="number" step="0.01" value={form.purchase_price} onChange={e=>setForm({...form,purchase_price:e.target.value})} /></label>
            <label>Valeur actuelle (€)<input type="number" step="0.01" value={form.current_value_override} onChange={e=>setForm({...form,current_value_override:e.target.value})} /></label>
            <label>Date d’achat<input type="date" value={form.purchase_date} onChange={e=>setForm({...form,purchase_date:e.target.value})} /></label>
            <label>Lieu d’achat<input value={form.purchase_place} onChange={e=>setForm({...form,purchase_place:e.target.value})} /></label>
            <button className="btn" type="submit">Ajouter à ma collection</button>
          </form>
          {message && <p className="message">{message}</p>}
        </div>

        <div className="panel">
          <h2>Mes produits</h2>
          <div className="sampleRows">
            {items.length === 0 ? <p>Ta collection est vide pour le moment.</p> : items.map(i => (
              <div key={i.id}><span>{i.custom_name} × {i.quantity}</span><b>{Number(i.purchase_price||0).toFixed(2)} € → {Number(i.current_value_override ?? i.purchase_price ?? 0).toFixed(2)} €</b></div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
