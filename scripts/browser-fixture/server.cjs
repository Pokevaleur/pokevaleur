// Synthetic auth and in-memory REST fixtures. This is not a Supabase/RLS test.
const http = require('node:http')
const userId = '00000000-0000-4000-8000-000000000001'
const profileId = '00000000-0000-4000-8000-000000000002'
const productId = '00000000-0000-4000-8000-000000000003'
const user = { id:userId, aud:'authenticated', role:'authenticated', email:'test@example.invalid', email_confirmed_at:'2026-01-01T00:00:00Z', app_metadata:{provider:'email',providers:['email']}, user_metadata:{}, identities:[], created_at:'2026-01-01T00:00:00Z' }
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const expires = Math.floor(Date.now()/1000)+86400
const token = `${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:userId,aud:'authenticated',role:'authenticated',exp:expires,iat:expires-86400,email:user.email})}.fixture_signature`
const session = { access_token:token, refresh_token:'fixture-refresh', token_type:'bearer', expires_in:86400, expires_at:expires, user }
const products = [{id:productId,name:'Coffret Bleu Test',series:'Série fictive',product_type:'Coffret',category:'sealed',current_value:30,zero_defect_value:35,is_public:true,image_url:'/coffre/chest-blue-closed.webp'}]
const seedItems = [
  {id:'00000000-0000-4000-8000-000000000011',product_id:productId,custom_name:'Coffret Bleu Test',quantity:1,purchase_price:20,current_value_override:30,sealed_condition:'standard',variant_note:'Version standard',booster_configuration:'2 boosters fictifs'},
  {id:'00000000-0000-4000-8000-000000000012',product_id:productId,custom_name:'Coffret Bleu Test',quantity:1,purchase_price:22,current_value_override:30,sealed_condition:'standard',variant_note:'Version standard',booster_configuration:'2 boosters fictifs'},
  {id:'00000000-0000-4000-8000-000000000013',product_id:null,custom_name:'Blister Test',quantity:1,purchase_price:null,current_value_override:10,sealed_condition:'zero_defect',variant_note:'Illustration A'},
  {id:'00000000-0000-4000-8000-000000000014',product_id:null,custom_name:'Blister Test',quantity:1,purchase_price:8,current_value_override:12,sealed_condition:'standard',variant_note:'Illustration B'}
].map((r,i)=>({...r,user_id:userId,collection_profile_id:profileId,purchase_date:'2026-01-01',created_at:`2026-01-0${i+1}T00:00:00Z`,photo_path:null,booster_artwork:'',collection_profiles:{profile_type:'personal'}}))
let items, reviews, failNext, unexpected
function reset(){items=structuredClone(seedItems);reviews=[];failNext=false;unexpected=[]}
reset()
async function body(req){let text='';for await(const chunk of req)text+=chunk;return text?JSON.parse(text):null}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'http://127.0.0.1:3100','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Expose-Headers':'Content-Range','Content-Range':`0-${Math.max((Array.isArray(data)?data.length:1)-1,0)}/*`});res.end(JSON.stringify(data))}
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:54321')
  if(req.method==='OPTIONS')return reply(res,200,{})
  if(url.pathname==='/__fixture/session')return reply(res,200,session)
  if(url.pathname==='/__fixture/reset'){reset();return reply(res,200,{ok:true})}
  if(url.pathname==='/__fixture/fail-next'){failNext=true;return reply(res,200,{ok:true})}
  if(url.pathname==='/__fixture/change-quantity'){items[0].quantity=2;return reply(res,200,{ok:true})}
  if(url.pathname==='/__fixture/state')return reply(res,200,{items,reviews,unexpected})
  const authenticated=req.headers.authorization===`Bearer ${token}`
  if(url.pathname==='/auth/v1/user')return reply(res,authenticated?200:401,authenticated?user:{message:'No fixture session',code:'bad_jwt'})
  if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').at(-1)
   if(!authenticated&&table!=='products')return reply(res,401,{message:'Fixture sign-in required'})
   if(req.method==='POST'&&table==='collection_duplicate_reviews'){
    if(failNext){failNext=false;return reply(res,503,{message:'Simulated save failure'})}
    const row=await body(req);if(row.user_id!==userId)return reply(res,403,{message:'Wrong fixture user'})
    reviews=reviews.filter(r=>r.group_key!==row.group_key);reviews.push(row)
    return reply(res,200,(req.headers.accept||'').includes('object+json')?row:[row])
   }
   if(req.method!=='GET'){unexpected.push(`${req.method} ${url.pathname}`);return reply(res,405,{message:'Mutation not supported by UI fixture'})}
   const tables={profiles:[{id:userId,display_name:'Membre Test',avatar_key:'star',is_admin:false}],collection_profiles:[{id:profileId,user_id:userId,profile_type:'personal',is_default:true,display_name:'Membre Test',avatar_key:'star'}],collection_items:items,products,collection_duplicate_reviews:reviews,product_watchlist:[],product_price_history:[],notification_preferences:[],market_offers:[],collection_item_photos:[]}
   if(!(table in tables)){unexpected.push(`GET ${url.pathname}`);return reply(res,404,{message:'Unknown fixture table'})}
   let rows=tables[table]
   for(const [field,filter] of url.searchParams){if(filter.startsWith('eq.')&&!field.includes('.'))rows=rows.filter(r=>String(r[field])===filter.slice(3));if(filter.startsWith('in.')){const ids=filter.slice(4,-1).split(',');rows=rows.filter(r=>ids.includes(String(r[field])))}}
   return reply(res,200,(req.headers.accept||'').includes('object+json')?(rows[0]||null):rows)
  }
  unexpected.push(`${req.method} ${url.pathname}`);return reply(res,404,{message:'Unknown fixture endpoint'})
 }catch(error){reply(res,500,{message:error.message})}
}).listen(54321,'127.0.0.1',()=>console.log('In-memory UI fixture running on loopback port 54321'))
