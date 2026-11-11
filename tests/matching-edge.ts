import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {matchInput,validateRow,categoryCodes,profileSchema,textHash} from '../supabase/functions/recognize-order/match-profile.ts';
const require=createRequire(import.meta.url),V=require('../dist/job-categories.js');let handler:any,calls:any[]=[],quota=true,role='admin',mode='ok',provider='deepseek',allowRecognition=false;
const env:any={SUPABASE_URL:'https://synthetic.example',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-only',ZY_ALLOWED_ORIGINS:'https://site.example',AI_PROVIDER:'deepseek',DEEPSEEK_ENABLED:'true',DEEPSEEK_MODEL:'deepseek-chat',DEEPSEEK_API_KEY:'synthetic-model-only',GEMINI_ENABLED:'true',GEMINI_MODEL:'gemini-test',GEMINI_API_KEY:'synthetic-gemini-only'};
(globalThis as any).Deno={env:{get:(k:string)=>env[k]},serve:(h:any)=>handler=h};let dict=V.subcategories.map((x:any)=>({...x})),cache:any[]=[];
globalThis.fetch=async(url:any,opts:any)=>{
 calls.push({url:String(url),opts});const body=JSON.parse(opts.body||'{}');
 if(String(url).endsWith('zy_session'))return new Response(JSON.stringify({user:{id:'synthetic-user-id',role}}));
 if(String(url).endsWith('zy_job_taxonomy'))return new Response(JSON.stringify({subcategories:dict,cache,remaining:quota?50:0}));
 if(String(url).endsWith('zy_job_claim'))return new Response(JSON.stringify({claimed:body.p_hashes,cached:[],busy:mode==='busy'?body.p_hashes:[]}));
 if(String(url).endsWith('zy_job_release'))return new Response('{}');
 if(String(url).endsWith('zy_job_reserve')){assert.equal(opts.headers.Authorization,'Bearer synthetic-service-only');return new Response('{}',{status:quota?200:429})}
 if(String(url).endsWith('zy_ai_reserve')){if(allowRecognition)return new Response('{}');throw Error('Classification must not consume recognition quota')}
 if(String(url).endsWith('zy_job_classification_commit')){assert.equal(opts.headers.apikey,'synthetic-service-only');const items=body.p_items.map((r:any)=>{let sid=r.subcategory_id;if(!sid&&r.new_name){let row=dict.find((x:any)=>x.major===r.major&&x.name===r.new_name);if(!row){row={id:'new:'+dict.length,major:r.major,name:r.new_name,aliases:[],status:'new'};dict.push(row)}sid=row.id}const saved={...r,subcategory_id:sid,by:'ai'};const prior=cache.find(c=>c.text_hash===r.text_hash);if(prior?.by==='user')return prior;cache=cache.filter(c=>c.text_hash!==r.text_hash);cache.push(saved);return saved});return new Response(JSON.stringify({items}))}
 if(String(url).includes('api.deepseek.com')||String(url).includes('googleapis.com')){
  const source=provider==='deepseek'?body.messages[1].content:body.contents[0].parts[0].text;assert(!source.includes('PRIVATE-NAME'));assert(!source.includes('PRIVATE-PHONE'));assert(!source.includes('PRIVATE-ID'));assert(!source.includes('PRIVATE-ADDRESS'));assert(!source.includes('PRIVATE-PHOTO'));
  if(provider==='deepseek')assert.equal(body.temperature,0);else assert.equal(body.generationConfig.temperature,0);
  if(allowRecognition&&!source.startsWith('{')){if(quota){assert(body.messages[0].content.includes('one optional matchProfile'));assert(!body.messages[0].content.includes('Return JSON {items:'))}return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({facts:[{field:'title',value:'电工',evidence:'岗位：电工'},{field:'workContent',value:'设备保养',evidence:'工作内容：设备保养'}],matchProfile:{major:'maintenance',subcategory_id:'seed:electrician',new_name:null,evidence:'电工'}})}}]}));}
  if(mode==='timeout')throw Error('timeout');const data=JSON.parse(source),items=data.items.map((x:any)=>({index:x.index,major:mode==='bad-major'?'unknown':x.kind==='intent'?'hotel_cleaning':'maintenance',subcategory_id:mode==='new'&&x.kind==='history'?null:x.kind==='intent'?'seed:cleaning':x.kind==='history'?'seed:appliance':'seed:electrician',new_name:mode==='new'&&x.kind==='history'?'合成复合维修技工':null,evidence:mode==='bad-evidence'?'编造依据':x.input.text||x.input.position||x.input.title}));
  const output=JSON.stringify({items});return new Response(JSON.stringify(provider==='deepseek'?{choices:[{finish_reason:'stop',message:{content:output}}]}:{candidates:[{finishReason:'STOP',content:{parts:[{text:output}]}}]}))
 }
 throw Error('Unexpected fetch '+url);
};
await import('../supabase/functions/recognize-order/index.ts');
const input={intents:['清洁'],history:[{position:'维修工',duties:'',employer:'SYNTHETIC-EMPLOYER'}],certificates:'电工证',name:'PRIVATE-NAME',phone:'PRIVATE-PHONE',idNumber:'PRIVATE-ID',address:'PRIVATE-ADDRESS',photo:'PRIVATE-PHOTO'};
const invoke=(body:any={action:'match-profile',kind:'worker',input})=>handler(new Request('https://edge.example',{method:'POST',headers:{origin:'https://site.example',authorization:'Bearer synthetic'},body:JSON.stringify(body)}));
const ok=await invoke();assert.equal(ok.status,200);const result=await ok.json();assert.equal(result.matchProfile.history[0].subcategory_id,'seed:appliance');assert.equal(calls.filter(c=>c.url.includes('api.deepseek.com')).length,1);
await invoke();assert.equal(calls.filter(c=>c.url.includes('api.deepseek.com')).length,1); // Shared cache.
cache=[];mode='new';const added=await (await invoke()).json();assert(added.matchProfile.history[0].subcategory_id.startsWith('new:'));assert.equal(added.taxonomy.subcategories.at(-1).status,'new');
for(const bad of ['bad-major','bad-evidence']){cache=[];mode=bad;const r=await(await invoke()).json();assert.equal(r.matchProfile.history.length,0)}
cache=[];mode='busy';const beforeBusy=calls.filter(c=>c.url.includes('api.deepseek.com')).length;assert.equal((await invoke()).status,409);assert.equal(calls.filter(c=>c.url.includes('api.deepseek.com')).length,beforeBusy);
cache=[];mode='timeout';assert.equal((await invoke()).status,503);mode='ok';quota=false;assert.equal((await invoke()).status,429);quota=true;
role='staff';assert.equal((await invoke({action:'classification-batch',items:[{kind:'order',input:{title:'电工'}}]})).status,403);assert.equal((await invoke({action:'classification-manage',operation:'merge',data:{}})).status,403);role='admin';
provider='gemini';env.AI_PROVIDER='gemini';cache=[];assert.equal((await invoke()).status,200);
const before=calls.filter(c=>c.url.includes('googleapis.com')).length;cache=[];assert.equal((await invoke({action:'match-profile',kind:'worker',input:{history:[{position:'',duties:'',employer:'industry only'}]}})).status,200);assert.equal(calls.filter(c=>c.url.includes('googleapis.com')).length,before);
assert.equal((await invoke({action:'classification-batch',items:Array.from({length:21},()=>({kind:'order',input:{title:'电工'}}))})).status,400);
const redacted=matchInput(input,'worker');assert.equal(redacted.history[0].employer,'SYNTHETIC-EMPLOYER');assert(!JSON.stringify(redacted).includes('PRIVATE'));
assert.equal(validateRow({major:'invalid',new_name:'技术员',evidence:'电工'},{title:'电工'},dict),null);assert.equal(validateRow({major:'maintenance',subcategory_id:'not-registered',evidence:'电工'},{title:'电工'},dict),null);assert.equal(validateRow({major:'maintenance',new_name:'新细类',evidence:'编造'},{title:'电工'},dict),null);
assert.deepEqual(categoryCodes.slice().sort(),V.majors.map((x:any)=>x.id).sort());
function checkSchema(s:any){if(s.type==='OBJECT')assert(Object.keys(s.properties||{}).length);for(const p of Object.values(s.properties||{}))checkSchema(p);if(s.items)checkSchema(s.items)}checkSchema(profileSchema('order'));assert(!('enum' in profileSchema('order').properties.subcategory_id));assert.equal(await textHash('order',{title:' 电工 ',workContent:''}),await textHash('order',{title:'电工',workContent:''}));
console.log('PASS: mocked DeepSeek/Gemini v2 classification, shared cache/no duplicate calls, new subcategories, evidence/major rejection, independent quota, admin gates, 20-item batches, skip empty work and employer-only allowlist');

// Embedded classification adds no provider request and cannot consume the recognition quota twice.
allowRecognition=true;provider='deepseek';env.AI_PROVIDER='deepseek';cache=[];quota=false;
const original={action:'recognize',source:'岗位：电工\n工作内容：设备保养'};
const limited=await(await invoke(original)).json();assert.equal(limited.facts[0].value,'电工');assert.equal(limited.matchProfile,null);
quota=true;const embedded=await(await invoke(original)).json();assert.equal(embedded.matchProfile.subcategory_id,'seed:electrician');
const classificationCalls=calls.filter(c=>c.url.endsWith('zy_job_reserve')).length;
await invoke(original);assert.equal(calls.filter(c=>c.url.endsWith('zy_job_reserve')).length,classificationCalls);
console.log('PASS: embedded classification shares one recognition model request, uses independent quota/cache, and quota exhaustion preserves recognition facts');
