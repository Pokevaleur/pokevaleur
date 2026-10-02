import test from 'node:test'
import assert from 'node:assert/strict'
import {duplicateFingerprint,duplicateDecision} from '../lib/duplicate-review.mjs'
const group={key:'test',rows:[{id:'a',quantity:2,product_id:'p',variant_note:'promo'}]}
test('Catalogue linkage alone never confirms duplicates',()=>assert.equal(duplicateDecision(group,[]),'pending'))
test('Review survives ordering but becomes stale after quantity or variant changes',()=>{
 const reviews=[{group_key:'test',fingerprint:duplicateFingerprint(group.rows),decision:'confirmed'}]
 assert.equal(duplicateDecision(group,reviews),'confirmed')
 for(const patch of [{quantity:3},{variant_note:'other'},{product_id:'q'},{booster_configuration:'other'}]) assert.equal(duplicateDecision({...group,rows:[{...group.rows[0],...patch}]},reviews),'pending')
 assert.equal(duplicateFingerprint([{id:'b'},{id:'a'}]),duplicateFingerprint([{id:'a'},{id:'b'}]))
})
test('Different items remain excluded until their composition changes',()=>assert.equal(duplicateDecision(group,[{group_key:'test',fingerprint:duplicateFingerprint(group.rows),decision:'different'}]),'different'))
