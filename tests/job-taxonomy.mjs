import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1)});
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
for(const file of ['202611030001_zy_shared.sql','202611050001_gemini_quota.sql','202611080001_retire_first_recognition.sql','202611100001_match_profile.sql','202611110001_job_taxonomy_v2.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
const admin='10000000-0000-0000-0000-000000000001',staff='10000000-0000-0000-0000-000000000002',outsider='10000000-0000-0000-0000-000000000003';
await db.exec(`insert into auth.users values('${admin}'),('${staff}'),('${outsider}');insert into zy_private.members values('${admin}','synthetic-admin','admin',true),('${staff}','synthetic-staff','staff',true);`);
async function role(name,id=''){await db.exec('reset role');await db.exec(`set role ${name};select set_config('request.jwt.claim.sub','${id}',false)`)}
async function rpc(name,...args){const r=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args);return r.rows[0].result}
const reject=async(fn,pattern)=>assert.rejects(fn,pattern);
await role('anon');await reject(()=>rpc('zy_job_taxonomy'),/permission denied/);
await role('authenticated',outsider);assert.equal((await db.query('select * from public.zy_job_subcategories')).rows.length,0);await reject(()=>rpc('zy_job_taxonomy'),/账号未获/);
await role('authenticated',staff);assert((await rpc('zy_job_taxonomy')).subcategories.length>30);await reject(()=>db.exec("insert into public.zy_job_subcategories(major,name) values('maintenance','forbidden')"),/permission denied/);await reject(()=>db.exec("insert into public.zy_job_classification_cache(text_hash,kind,major,evidence,by) values(repeat('a',64),'order','maintenance','x','user')"),/permission denied/);await reject(()=>rpc('zy_job_manage','update',{id:'seed:electrician',name:'denied'}),/权限不足/);await reject(()=>rpc('zy_job_profiles_apply',[],[],0),/权限不足/);await reject(()=>rpc('zy_job_reserve',staff),/permission denied/);await reject(()=>rpc('zy_job_classification_commit',staff,[]),/permission denied/);
await role('service_role');const item={text_hash:'a'.repeat(64),kind:'history',major:'maintenance',new_name:'电工',evidence:'电工证'};
const ticketA='20000000-0000-0000-0000-000000000001',ticketB='20000000-0000-0000-0000-000000000002';
const claimA=await rpc('zy_job_claim',staff,[item.text_hash],ticketA,false);assert.equal(claimA.claimed.length,1);
const claimB=await rpc('zy_job_claim',staff,[item.text_hash],ticketB,false);assert.equal(claimB.busy.length,1);await rpc('zy_job_release',ticketA);
const first=await rpc('zy_job_classification_commit',staff,[item]);assert.equal(first.items[0].subcategory_id,'seed:electrician');assert.equal((await rpc('zy_job_claim',staff,[item.text_hash],ticketB,false)).cached.length,1);
const added=await rpc('zy_job_classification_commit',staff,[{...item,text_hash:'b'.repeat(64),new_name:'合成复合技师',evidence:'合成技师'}]);const id=added.items[0].subcategory_id;assert(id);
const again=await rpc('zy_job_classification_commit',staff,[{...item,text_hash:'c'.repeat(64),new_name:'合成复合技师',evidence:'合成技师'}]);assert.equal(again.items[0].subcategory_id,id);
await role('authenticated',admin);await rpc('zy_job_manage','update',{id,name:'合成复合维修技工',major:'maintenance',aliases:['合成技师'],status:'active'});await rpc('zy_job_manage','merge',{id:'seed:general_repair',target:id});await rpc('zy_job_manage','merge',{id,target:'seed:electrician'});await reject(()=>rpc('zy_job_manage','merge',{id:'seed:electrician',target:'seed:general_repair'}),/循环/);await reject(()=>rpc('zy_job_manage','merge',{id,target:id}),/自身/);
await rpc('zy_job_manage','assign',{text_hash:'a'.repeat(64),kind:'history',subcategory_id:'seed:forklift',evidence:'电工证'});
await role('service_role');await rpc('zy_job_classification_commit',staff,[item]);
await role('authenticated',staff);const manual=(await rpc('zy_job_taxonomy')).cache.find(x=>x.text_hash==='a'.repeat(64));assert.equal(manual.by,'user');assert.equal(manual.subcategory_id,'seed:forklift');
await role('service_role');for(let i=0;i<50;i++)assert.equal((await rpc('zy_job_reserve',staff)).remaining,49-i);await reject(()=>rpc('zy_job_reserve',staff),/归类额度/);
await role('authenticated',admin);assert.equal((await rpc('zy_ai_reserve')).ok,true);assert.equal((await rpc('zy_job_taxonomy')).remaining,0); // Independent counters.
const o={id:'synthetic-order',code:'ZY-26-1110-01',title:'电工',raw:'合成原单',status:'ready',createdAt:'2026-11-10T00:00:00Z',price:'3.8w',humanReviewedBy:'synthetic-admin'};await rpc('zy_orders_save',[o],0);await rpc('zy_worker_save',{id:'synthetic-worker',name:'合成劳工',createdAt:'2026-11-10',updatedAt:'2026-11-10',workHistory:[]});
const profile={version:2,by:'ai',sourceHash:'v2-synthetic',major:'maintenance',subcategory_id:'seed:electrician',evidence:'电工'};await rpc('zy_job_profiles_apply',[{id:o.id,profile}],[{id:'synthetic-worker',version:1,profile}],1);const saved=(await rpc('zy_orders_get')).orders[0];assert.deepEqual(saved,{...o,matchProfile:profile});assert.equal((await rpc('zy_workers_get')).workers[0]._version,2);
await reject(()=>rpc('zy_job_profiles_apply',[{id:o.id,profile}],[],1),/已修改/);await reject(()=>rpc('zy_job_profiles_apply',[],[{id:'synthetic-worker',version:1,profile}],2),/已修改/);
await rpc('zy_maintenance_set',true);await reject(()=>rpc('zy_job_manage','update',{id,name:'no-write'}),/暂停/);await role('service_role');await reject(()=>rpc('zy_job_reserve',staff),/暂停/);
await db.close();console.log('PASS: taxonomy RLS, service-only writes, admin management/backfill, deduplication, merges/cycles, manual precedence, independent 50-call quota and metadata-only revision-safe writes');
