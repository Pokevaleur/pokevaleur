export function duplicateFingerprint(rows) {
 return JSON.stringify(rows.map(r => [r.id,r.product_id || null,r.custom_name || '',Number(r.quantity)||1,r.variant_note || '',r.booster_configuration || '',r.booster_artwork || '']).sort((a,b)=>a[0].localeCompare(b[0])))
}
export function duplicateDecision(group, reviews) {
 const review=reviews.find(r=>r.group_key===group.key)
 return review?.fingerprint===duplicateFingerprint(group.rows) ? review.decision : 'pending'
}
