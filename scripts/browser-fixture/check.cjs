const fs=require('node:fs/promises')
const assert=require('node:assert/strict')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base='http://127.0.0.1:3100'
const fixture='http://127.0.0.1:54321'
async function api(path){const response=await fetch(fixture+'/__fixture/'+path);assert(response.ok);return response.json()}
async function main(){
 await fs.mkdir('connected-browser-report',{recursive:true})
 const browser=await chromium.launch()
 const report=[]
 try{
  for(const [name,width,height] of [['mobile-small',360,800],['mobile',390,844],['desktop',1440,900]]){
   await api('reset')
   const session=await api('session')
   const context=await browser.newContext({viewport:{width,height},locale:'fr-FR',timezoneId:'Europe/Paris',isMobile:width<600,hasTouch:width<600})
   const errors=[],external=[]
   await context.route('**/*',async route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();external.push(url.origin);return route.abort()})
   await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}])
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
   async function capture(label){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Horizontal overflow')
    await page.screenshot({path:`connected-browser-report/${name}-${label}.png`,fullPage:true})
   }
   async function step(label,fn){try{await fn();report.push({name,label,passed:true});console.log('PASS '+name+' '+label)}catch(e){report.push({name,label,passed:false,error:e.message});await capture('failure').catch(()=>{});throw e}}
   try{
    await step('Collection search and filters',async()=>{
     await page.goto(base+'/collection',{waitUntil:'networkidle'})
     assert.equal(new URL(page.url()).pathname,'/collection','Synthetic session must display collection')
     await page.waitForFunction(()=>document.querySelector('.stats>div:last-child strong')?.textContent==='4')
     await page.getByRole('heading',{name:'Ma collection',exact:true}).waitFor()
     await capture('collection')
     assert.equal(await page.locator('.productCard').count(),0,'No products displayed without search')
     await page.getByRole('searchbox',{name:'Rechercher dans ma collection'}).fill('coffret')
     await page.waitForFunction(()=>document.querySelectorAll('.productCard').length===2)
     await capture('collection-search')
     await page.getByRole('button',{name:'Effacer',exact:true}).click()
     await page.locator('.collectionSearchFilters select').selectOption('zero_defect')
     await page.waitForFunction(()=>document.querySelectorAll('.productCard').length===1)
     assert((await page.locator('.productCard').innerText()).includes('Blister Test'))
     await page.getByRole('button',{name:'Effacer',exact:true}).click()
     if(width<600){await page.getByLabel('Ouvrir le menu').click();assert.equal(await page.locator('.mobileMenuPanel a[href="/admin"]').count(),0);await page.getByLabel('Ouvrir le menu').click()}
    })
    await step('Catalog reference does not confirm duplicates',async()=>{
     await page.goto(base+'/opportunites',{waitUntil:'networkidle'})
     await page.getByRole('button',{name:'À vérifier (2)',exact:true}).waitFor()
     assert.equal(await page.locator('.stats>div:first-child strong').innerText(),'0')
     assert.equal(await page.getByText('Identité confirmée par toi',{exact:true}).count(),0)
     await capture('duplicates-pending')
    })
    await step('Confirm and persist without changing collection',async()=>{
     const before=await api('state')
     await page.locator('.productCard').filter({hasText:'Coffret Bleu Test'}).getByRole('button',{name:'Même produit et même variante',exact:true}).click()
     await page.getByText('Identité des exemplaires confirmée. Aucune mise en vente effectuée.',{exact:true}).waitFor()
     assert.deepEqual((await api('state')).items,before.items)
     await page.getByRole('button',{name:'Doublons validés (1)',exact:true}).click()
     await page.getByText('Identité confirmée par toi',{exact:true}).waitFor()
     assert.equal(await page.locator('.stats>div:first-child strong').innerText(),'1')
     await capture('duplicates-confirmed')
     await page.reload({waitUntil:'networkidle'})
     await page.getByRole('button',{name:'Doublons validés (1)',exact:true}).waitFor()
    })
    await step('Reject different variants and persist',async()=>{
     await page.locator('.productCard').filter({hasText:'Blister Test'}).getByRole('button',{name:'Ce sont des articles différents',exact:true}).click()
     await page.getByRole('button',{name:'Écartés (1)',exact:true}).click()
     await page.getByText('Articles différents',{exact:true}).waitFor()
     await capture('duplicates-excluded')
     await page.reload({waitUntil:'networkidle'})
     await page.getByRole('button',{name:'Écartés (1)',exact:true}).waitFor()
     await page.getByRole('button',{name:'À vérifier (0)',exact:true}).waitFor()
    })
    await step('Quantity change invalidates prior confirmation',async()=>{
     await api('change-quantity');await page.reload({waitUntil:'networkidle'})
     await page.getByRole('button',{name:'À vérifier (1)',exact:true}).waitFor()
     await page.getByRole('button',{name:'Doublons validés (0)',exact:true}).waitFor()
     assert.equal(await page.locator('.stats>div:first-child strong').innerText(),'0')
    })
    await step('Save failure keeps group unvalidated; retry succeeds',async()=>{
     await api('fail-next')
     await page.getByRole('button',{name:'Même produit et même variante',exact:true}).click()
     await page.getByText('Validation non enregistrée. Réessaie.',{exact:true}).waitFor()
     await page.getByRole('button',{name:'À vérifier (1)',exact:true}).waitFor()
     assert.equal(await page.locator('.stats>div:first-child strong').innerText(),'0')
     await capture('duplicates-save-failure')
     await page.getByRole('button',{name:'Même produit et même variante',exact:true}).click()
     await page.getByRole('button',{name:'Doublons validés (1)',exact:true}).waitFor()
     assert.equal(await page.locator('.stats>div:first-child strong').innerText(),'2')
    })
    await step('No production calls or unexpected fixture mutations',async()=>{
     assert.deepEqual(external,[])
     assert.deepEqual(errors,[])
     assert.deepEqual((await api('state')).unexpected,[])
    })
   }catch(e){console.error(name+': '+e.message)}finally{await context.close()}
  }
 }finally{
  await browser.close()
  await fs.writeFile('connected-browser-report/results.json',JSON.stringify(report,null,2))
  const summary=`## Connected UI fixture checks\n\n${report.filter(r=>r.passed).length}/${report.length} completed checks passed. Expected: 21 checks.\n\nSynthetic session and in-memory data only. Real authentication, Postgres persistence and RLS are NOT covered. No production calls are allowed.\n\n`+report.map(r=>`- ${r.passed?'✅':'❌'} ${r.name}: ${r.label}${r.error?' — '+r.error:''}`).join('\n')+'\n'
  await fs.writeFile('connected-browser-report/summary.md',summary)
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary)
 }
 assert(report.length===21 && report.every(r=>r.passed),'Connected UI checks failed; see screenshots and report')
}
main().catch(e=>{console.error(e);process.exitCode=1})
