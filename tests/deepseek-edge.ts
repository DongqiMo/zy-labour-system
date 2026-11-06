import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {validateFacts,redactSource} from '../supabase/functions/recognize-order/validation.ts';
let handler:any;const env:any={SUPABASE_URL:'https://project.example',SUPABASE_ANON_KEY:'public-test',ZY_ALLOWED_ORIGINS:'https://site.example',AI_PROVIDER:'deepseek',DEEPSEEK_ENABLED:'true',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:'server-test-secret'};
(globalThis as any).Deno={env:{get:(key:string)=>env[key]},serve:(fn:any)=>{handler=fn}};
let finish="stop";
let calls:any[]=[],quota=true,modelStatus=200,facts:any[]=[{field:'title',value:'场务协调专岗',evidence:'岗位：场务协调专岗'}];
globalThis.fetch=async(url:any,options:any)=>{
 calls.push({url:String(url),options});
 if(String(url).endsWith('/rpc/zy_session'))return new Response('{}',{status:options.headers.Authorization==='Bearer member'?200:403});
 if(String(url).endsWith('/rpc/zy_ai_reserve'))return new Response('{}',{status:quota?200:400});
 if(String(url)==='https://api.deepseek.com/chat/completions'){
  assert.equal(options.headers.Authorization,'Bearer server-test-secret');assert(!String(url).includes('server-test-secret'));
  const sent=JSON.parse(options.body);assert.equal(sent.model,'deepseek-flash');assert.equal(sent.max_tokens,8192);assert.equal(sent.response_format.type,'json_object');assert(!sent.messages[1].content.includes('staff@example.test'));
  return new Response(JSON.stringify({choices:[{finish_reason:finish,message:{content:JSON.stringify({facts})}}]}),{status:modelStatus});
 }throw new Error('Unexpected fetch');
};
await import('../supabase/functions/recognize-order/index.ts');
const source='岗位：场务协调专岗\n工资：HK21000\n电话：13812345678\nstaff@example.test';
const invoke=(body:any={action:'recognize',source},token='member',origin='https://site.example',method='POST')=>handler(new Request('https://edge.example/recognize-order',{method,headers:{origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined}));
assert.equal((await invoke({},'member','https://evil.example')).status,403);assert.equal(calls.length,0);
assert.equal((await invoke({},'outsider')).status,403);assert.equal(calls.length,1);
assert.equal((await invoke({},'member','https://site.example','OPTIONS')).status,204);
const status=await invoke({action:'status'});assert.equal((await status.json()).enabled,true);assert.equal(calls.filter(c=>c.url.includes('api.deepseek.com')).length,0);
const ok=await invoke();assert.equal(ok.status,200);assert.deepEqual((await ok.json()).facts,facts);
quota=false;const before=calls.filter(c=>c.url.includes('api.deepseek.com')).length;assert.equal((await invoke()).status,429);assert.equal(calls.filter(c=>c.url.includes('api.deepseek.com')).length,before);quota=true;
assert.equal((await invoke({action:'recognize',source:'x'.repeat(12001)})).status,400);
assert.equal((await invoke({action:'recognize',source,workerData:'private'})).status,400);
facts=[{field:'employer',value:'编造公司',evidence:source}];assert.equal((await invoke()).status,503);
facts=[{field:'price',value:'21000',evidence:source}];assert.equal((await invoke()).status,503);
modelStatus=429;assert.equal((await invoke()).status,503);modelStatus=200;
finish='length';assert.equal((await invoke()).status,502);finish='stop';
env.DEEPSEEK_ENABLED='false';assert.equal((await (await invoke({action:'status'})).json()).enabled,false);assert.equal((await invoke()).status,503);
assert(!redactSource(source).includes('13812345678'));assert(!redactSource(source).includes('staff@example.test'));
assert.deepEqual(validateFacts({facts:[{field:'salary',value:'31000',evidence:'全包31000'},{field:'salary',value:'23000+3000',evidence:'23000+3000'},{field:'hours',value:'31000',evidence:'31000'}]},'全包31000\n23000+3000\n31000'),[]);
console.log('PASS: mocked DeepSeek auth/CORS, atomic reservation gate, server-only key, redaction, schema, literal provenance, fee/footer exclusions and safe failure');

for(const item of JSON.parse(readFileSync(new URL('./fixtures/ai-recognition-errors.json',import.meta.url),'utf8')).cases){assert.equal(validateFacts({facts:[item.fact]},item.source).length,item.accepted?1:0,item.id);}
