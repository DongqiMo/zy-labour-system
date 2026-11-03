import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
globalThis.window=globalThis;const store=new Map();globalThis.sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
await import('../dist/supabase-adapter.js');
const base={supabaseUrl:'https://project.example.test',supabaseAnonKey:'sb_publishable_test'};
assert.throws(()=>new ZYSupabase({...base,supabaseAnonKey:'sb_secret_do-not-use'}));
const jwt='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';assert.throws(()=>new ZYSupabase({...base,supabaseAnonKey:jwt}));
const adapter=new ZYSupabase(base),requests=[];let refreshCount=0,member=true;
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
globalThis.fetch=async(url,opts)=>{const path=new URL(url).pathname,body=opts.body?JSON.parse(opts.body):{};requests.push({url,opts,body});assert.equal(opts.headers.apikey,base.supabaseAnonKey);assert(!Object.values(opts.headers).some(v=>String(v).includes('sb_secret')));
 if(path==='/auth/v1/token'){
  const refresh=new URL(url).searchParams.get('grant_type')==='refresh_token';if(refresh)refreshCount++;
  return response({access_token:refresh?'refreshed-jwt':'login-jwt',refresh_token:'refresh-token',expires_in:3600,user:{id:'user-one',email:'owner@example.test'}});
 }
 if(path==='/auth/v1/logout')return response({});
 if(path==='/auth/v1/user')return response({id:'user-one'});
 if(path==='/rest/v1/rpc/zy_session')return member?response({user:{id:'user-one',username:'owner@example.test',role:'admin'},csrf:''}):response({message:'账号未获授权'},403);
 if(path==='/rest/v1/rpc/zy_orders_get')return response({orders:[],revision:0});
 if(path==='/rest/v1/rpc/zy_workers_get')return response({workers:[]});
 if(path==='/rest/v1/rpc/zy_orders_save'){assert.equal(body.p_revision,0);return response({revision:1})}
 if(path==='/rest/v1/rpc/zy_export')return response({format:'zy-labour-portable',version:1,orders:[],workers:[]});
 if(path==='/rest/v1/rpc/zy_import'){assert.equal(body.p_payload.version,1);return response({orders:0,workers:0,revision:1})}
 if(path==='/rest/v1/rpc/zy_maintenance_set'){assert.equal(body.p_read_only,true);return response({readOnly:true})}
 if(path==='/rest/v1/rpc/zy_member_disable'){assert.equal(body.p_id,'staff-one');return response({ok:true})}
 if(path==='/functions/v1/team-admin'){assert.deepEqual(body,{action:'create',email:'staff@example.test',password:'safe-test-password',role:'staff'});return response({ok:true},201)}
 throw new Error('Unexpected request '+path);
};
await assert.rejects(()=>adapter.call('/api/session'),e=>e.status===401);
const session=await adapter.call('/api/login',{method:'POST',body:{username:'owner@example.test',password:'safe-test-password'}});assert.equal(session.user.role,'admin');
assert.deepEqual(requests[0].body,{email:'owner@example.test',password:'safe-test-password'});
adapter.session.expires_at=0;await Promise.all([adapter.call('/api/orders'),adapter.call('/api/workers')]);assert.equal(refreshCount,1);
await adapter.call('/api/orders',{method:'PUT',body:{orders:[],revision:0}});
const backup=await adapter.call('/api/export');await adapter.call('/api/import',{method:'POST',body:{payload:backup,revision:0}});
await adapter.call('/api/maintenance',{method:'POST',body:{readOnly:true}});
await adapter.call('/api/users',{method:'POST',body:{username:'staff@example.test',password:'safe-test-password',role:'staff'}});
await adapter.call('/api/users/disable',{method:'POST',body:{id:'staff-one'}});
await adapter.call('/api/password',{method:'POST',body:{current:'safe-test-password',password:'new-safe-password'}});assert.equal(adapter.session,null);
member=false;await assert.rejects(()=>adapter.call('/api/login',{method:'POST',body:{username:'outsider@example.test',password:'safe-test-password'}}),/未获授权/);assert.equal(adapter.session,null);assert.equal(store.size,0);
console.log('PASS: Supabase Auth/refresh concurrency, RPC mapping, backup/restore/maintenance, edge account creation, admin-key rejection and unauthorized membership cleanup (mocked HTTP)');
