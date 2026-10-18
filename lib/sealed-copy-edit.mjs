import { sealedFormats } from './sealed-collection-counts.mjs'

export async function saveSealedCopyDetails(supabase, itemId, draft) {
  const name = draft.custom_name.trim()
  const format = draft.sealed_format_override || null
  if (!name || name.length > 200) throw new Error('Saisis un repère personnel de 1 à 200 caractères.')
  if (format && !sealedFormats.some(entry => entry.key === format)) throw new Error('Choisis un type proposé.')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Ta session a expiré. Reconnecte-toi.')
  const { data, error } = await supabase.from('collection_items')
    .update({ custom_name: name, sealed_format_override: format })
    .eq('id', itemId).eq('user_id', user.id)
    .select('id,custom_name,sealed_format_override').single()
  if (error || !data) throw new Error('Impossible d’enregistrer cet exemplaire. Réessaie.')
  return data
}
