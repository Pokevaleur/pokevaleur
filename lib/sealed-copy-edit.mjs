export async function saveSealedCopyDetails(supabase, itemId, draft) {
  const name = draft.custom_name.trim()
  const format = draft.product_type_override?.trim() || null
  const purchasePrice = draft.purchase_price === '' || draft.purchase_price == null ? null : Number(draft.purchase_price)
  const purchaseDate = draft.purchase_date || null
  if (!name || name.length > 200) throw new Error('Saisis un repère personnel de 1 à 200 caractères.')
  if (format && format.length > 200) throw new Error('Le type personnel doit contenir au maximum 200 caractères.')
  if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) throw new Error('Saisis un prix d’achat valide.')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Ta session a expiré. Reconnecte-toi.')
  const { data, error } = await supabase.from('collection_items')
    .update({ custom_name: name, product_type_override: format, purchase_price: purchasePrice, purchase_date: purchaseDate })
    .eq('id', itemId).eq('user_id', user.id)
    .select('id,custom_name,product_type_override,purchase_price,purchase_date').single()
  if (error || !data) throw new Error('Impossible d’enregistrer cet exemplaire. Réessaie.')
  return data
}
