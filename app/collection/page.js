'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

const emptyForm = {
  custom_name: '',
  quantity: 1,
  purchase_price: '',
  purchase_date: '',
  purchase_place: '',
  current_value_override: ''
}

export default function CollectionPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [query, setQuery] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) return

    const { data, error } = await supabase
      .from('collection_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setMessage(error.message)
    else setItems(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function addItem(e) {
    e.preventDefault()
    if (!user) return setMessage('Connecte-toi d’abord.')

    const payload = {
      user_id: user.id,
      custom_name: form.custom_name.trim(),
      quantity: Number(form.quantity || 1),
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_date: form.purchase_date || null,
      purchase_place: form.purchase_place.trim() || null,
      current_value_override: form.current_value_override ? Number(form.current_value_override) : null
    }

    const { error } = await supabase.from('collection_items').insert(payload)
    if (error) return setMessage(error.message)

    setForm(emptyForm)
    setMessage('Produit ajouté à ta collection.')
    await load()
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({
      custom_name: item.custom_name || '',
      quantity: item.quantity || 1,
      purchase_price: item.purchase_price ?? '',
      purchase_date: item.purchase_date || '',
      purchase_place: item.purchase_place || '',
      current_value_override: item.current_value_override ?? ''
    })
    setMessage('')
  }

  async function saveEdit(id) {
    const payload = {
      custom_name: editForm.custom_name.trim(),
      quantity: Number(editForm.quantity || 1),
      purchase_price: editForm.purchase_price === '' ? null : Number(editForm.purchase_price),
      purchase_date: editForm.purchase_date || null,
      purchase_place: editForm.purchase_place.trim() || null,
      current_value_override: editForm.current_value_override === '' ? null : Number(editForm.current_value_override)
    }

    const { error } = await supabase
      .from('collection_items')
      .update(payload)
      .eq('id', id)

    if (error) return setMessage(error.message)

    setEditingId(null)
    setMessage('Produit modifié.')
    await load()
  }

  async function deleteItem(item) {
    const ok = window.confirm(`Supprimer “${item.custom_name}” de ta collection ?`)
    if (!ok) return

    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('id', item.id)

    if (error) return setMessage(error.message)

    setMessage('Produit supprimé.')
    await load()
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const invested = items.reduce(
    (sum, item) => sum + (Number(item.purchase_price) || 0) * (item.quantity || 1),
    0
  )

  const current = items.reduce(
    (sum, item) =>
      sum +
      (Number(item.current_value_override) || Number(item.purchase_price) || 0) *
        (item.quantity || 1),
    0
  )

  const difference = current - invested
  const percent = invested > 0 ? (difference / invested) * 100 : 0
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0)

  const filteredItems = items.filter(item =>
    (item.custom_name || '').toLowerCase().includes(query.toLowerCase())
  )

  if (!user) {
    return (
      <main className="narrow">
        <section className="panel">
          <h1>Ma collection</h1>
          <p>Connecte-toi pour accéder à ta collection personnelle.</p>
          <a className="btn" href="/login">Connexion / inscription</a>
        </section>
      </main>
    )
  }

  return (
    <main>
      <div className="collectionHeader">
        <div>
          <span className="eyebrow dark">Mon espace</span>
          <h1>Ma collection</h1>
          <p className="muted">{user.email}</p>
        </div>
        <button className="btn ghost dangerGhost" onClick={signOut}>Se déconnecter</button>
      </div>

      <section className="stats">
        <div>
          <span>Investi</span>
          <strong>{invested.toFixed(2)} €</strong>
        </div>
        <div>
          <span>Valeur actuelle</span>
          <strong>{current.toFixed(2)} €</strong>
        </div>
        <div>
          <span>Évolution</span>
          <strong className={difference >= 0 ? 'gain' : 'loss'}>
            {difference >= 0 ? '+' : ''}{difference.toFixed(2)} €
            <small>{invested > 0 ? ` (${percent >= 0 ? '+' : ''}${percent.toFixed(1)} %)` : ''}</small>
          </strong>
        </div>
        <div>
          <span>Items</span>
          <strong>{itemCount}</strong>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <h2>Ajouter un produit</h2>
          <form onSubmit={addItem} className="formGrid">
            <label>
              Nom du produit
              <input
                value={form.custom_name}
                onChange={e => setForm({ ...form, custom_name: e.target.value })}
                placeholder="Ex. ETB 151"
                required
              />
            </label>

            <label>
              Quantité
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
              />
            </label>

            <label>
              Prix d’achat (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_price}
                onChange={e => setForm({ ...form, purchase_price: e.target.value })}
              />
            </label>

            <label>
              Valeur actuelle (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.current_value_override}
                onChange={e => setForm({ ...form, current_value_override: e.target.value })}
                placeholder="Peut être renseignée plus tard"
              />
            </label>

            <label>
              Date d’achat
              <input
                type="date"
                value={form.purchase_date}
                onChange={e => setForm({ ...form, purchase_date: e.target.value })}
              />
            </label>

            <label>
              Lieu d’achat
              <input
                value={form.purchase_place}
                onChange={e => setForm({ ...form, purchase_place: e.target.value })}
                placeholder="Vinted, boutique, Voggt..."
              />
            </label>

            <button className="btn" type="submit">Ajouter à ma collection</button>
          </form>

          {message && <p className="message">{message}</p>}
        </div>

        <div className="panel">
          <div className="listHeader">
            <h2>Mes produits</h2>
            <input
              className="searchInput"
              placeholder="Rechercher..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="productList">
            {filteredItems.length === 0 ? (
              <p>{items.length === 0 ? 'Ta collection est vide pour le moment.' : 'Aucun produit trouvé.'}</p>
            ) : (
              filteredItems.map(item => {
                const buy = Number(item.purchase_price) || 0
                const value = Number(item.current_value_override ?? item.purchase_price ?? 0)
                const diff = value - buy
                const pct = buy > 0 ? (diff / buy) * 100 : 0

                if (editingId === item.id) {
                  return (
                    <article className="productCard editing" key={item.id}>
                      <div className="editGrid">
                        <label>
                          Produit
                          <input value={editForm.custom_name} onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                        </label>
                        <label>
                          Quantité
                          <input type="number" min="1" value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} />
                        </label>
                        <label>
                          Achat (€)
                          <input type="number" min="0" step="0.01" value={editForm.purchase_price} onChange={e => setEditForm({ ...editForm, purchase_price: e.target.value })} />
                        </label>
                        <label>
                          Valeur (€)
                          <input type="number" min="0" step="0.01" value={editForm.current_value_override} onChange={e => setEditForm({ ...editForm, current_value_override: e.target.value })} />
                        </label>
                        <label>
                          Date
                          <input type="date" value={editForm.purchase_date} onChange={e => setEditForm({ ...editForm, purchase_date: e.target.value })} />
                        </label>
                        <label>
                          Lieu
                          <input value={editForm.purchase_place} onChange={e => setEditForm({ ...editForm, purchase_place: e.target.value })} />
                        </label>
                      </div>
                      <div className="rowActions">
                        <button className="miniBtn primaryMini" onClick={() => saveEdit(item.id)}>Enregistrer</button>
                        <button className="miniBtn" onClick={() => setEditingId(null)}>Annuler</button>
                      </div>
                    </article>
                  )
                }

                return (
                  <article className="productCard" key={item.id}>
                    <div className="productMain">
                      <div>
                        <h3>{item.custom_name}</h3>
                        <p>
                          Qté {item.quantity}
                          {item.purchase_date ? ` • acheté le ${new Date(item.purchase_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}
                          {item.purchase_place ? ` • ${item.purchase_place}` : ''}
                        </p>
                      </div>
                      <div className="productValues">
                        <b>{buy.toFixed(2)} € → {value.toFixed(2)} €</b>
                        <span className={diff >= 0 ? 'gain' : 'loss'}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(2)} €
                          {buy > 0 ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %)` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="rowActions">
                      <button className="miniBtn" onClick={() => startEdit(item)}>Modifier</button>
                      <button className="miniBtn dangerMini" onClick={() => deleteItem(item)}>Supprimer</button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
