import assert from 'node:assert/strict';
let handler:any;const env={SUPABASE_URL:'https://test-project.example',SUPABASE_SERVICE_ROLE_KEY:'test-server-only',SUPABASE_ANON_KEY:'test-public',ZY_ALLOWED_ORIGINS:'https://site.example'};
(globalThis as any).Deno={env:{get:(key:string)=>(env as any)[key]},serve:(fn:any)=>{handler=fn}};
let calls:any[]=[],memberFailure=false;
globalThis.fetch=async(url:any,options:any)=>{
 calls.push({url,options});
 if(String(url).endsWith('/rpc/zy_users_get'))return new Response('{}',{status:options.headers.Authorization==='Bearer valid-admin'?200:403});
 if(String(url).endsWith('/auth/v1/admin/users')){assert.equal(options.headers.Authorization,'Bearer test-server-only');return new Response(JSON.stringify({id:'20000000-0000-0000-0000-000000000001'}),{status:201})}
 if(String(url).endsWith('/rpc/zy_member_add')){assert.equal(options.headers.Authorization,'Bearer valid-admin');return new Response('{}',{status:memberFailure?403:200})}
 if(options.method==='DELETE')return new Response('{}',{status:200});
 throw new Error('Unexpected upstream request');
};
await import('../supabase/functions/team-admin/index.ts');
const invoke=(token='valid-admin',origin='https://site.example',method='POST',data:any={action:'create',email:'staff@example.test',password:'safe-long-password',role:'staff'})=>handler(new Request('https://edge.example/team-admin',{method,headers:{origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(data):undefined}));
assert.equal((await invoke('valid-admin','https://evil.example')).status,403);assert.equal(calls.length,0);
assert.equal((await invoke('invalid-user')).status,403);assert.equal(calls.length,1);
assert.equal((await invoke('valid-admin','https://site.example','OPTIONS')).status,204);
assert.equal((await invoke()).status,201);
const result=await invoke('valid-admin','https://site.example','POST',{action:'create',email:'wrong',password:'short',role:'admin'});assert.equal(result.status,400);
memberFailure=true;const failed=await invoke();assert.equal(failed.status,409);assert(calls.some(c=>c.options.method==='DELETE'));assert(!(await failed.text()).includes('test-server-only'));
console.log('PASS: Edge Function CORS, caller admin check, server-only key use, account validation and compensating cleanup (mocked upstream)');
