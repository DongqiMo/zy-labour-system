import assert from 'node:assert/strict';
import '../dist/order-parser.js';import '../dist/recognition-archive.js';import '../dist/ai-recognition.js';
const P=ZYOrderParser,raw='岗位：场务协调专岗\n工资：HK21000\n性别：男\n年龄：43岁以下\n工作时间：每天9小时\n雇主提供住宿\n某院舍\n上家全包31000\n23000+3000';
const analysis=P.analyze(raw,'ZY-26-1103-90');analysis.order.employer='';
const enhanced=ZYAI.apply(analysis,{provider:'gemini',model:'gemini-test-model',facts:[{field:'employer',value:'某院舍',evidence:'某院舍'},{field:'salary',value:'31000',evidence:'上家全包31000'},{field:'hours',value:'23000+3000',evidence:'23000+3000'}]});
assert.equal(enhanced.order.employer,'某院舍');assert.equal(enhanced.order.salary,'HKD21000');assert.equal(enhanced.order.code,analysis.order.code);assert.equal(analysis.order.employer,'');assert(!JSON.stringify(enhanced.order.hours).includes('23000'));
assert.equal(enhanced.order.aiProvider,'gemini');assert(enhanced.sources.employer.includes('某院舍'));
const first=JSON.parse(ZYRecognitionArchive.capture(raw,enhanced.order));assert.equal(first.provider,'gemini');assert.equal(first.model,'gemini-test-model');
assert.throws(()=>ZYAI.apply(analysis,{provider:'gemini',model:'test',facts:[{field:'title',value:'编造职位',evidence:raw}]}));
assert.throws(()=>ZYAI.apply(analysis,{provider:'gemini',model:'test',facts:[{field:'price',value:'31000',evidence:'上家全包31000'}]}));
globalThis.ZY_CONFIG={provider:'sqlite'};assert.equal(await ZYAI.enhance(analysis),analysis);
globalThis.ZY_CONFIG={provider:'supabase'};globalThis.api=async(path)=>path==='/api/recognition-status'?{enabled:true}:Promise.reject(new Error('unavailable'));ZYAI.reset();const fallback=await ZYAI.enhance(analysis);assert.equal(fallback.order,analysis.order);assert(fallback.warnings.some(w=>w.includes('保留规则')));
console.log('PASS: optional AI assistance, literal facts, immutable rule baseline, privacy constraints, model-tagged first snapshots and offline/failure fallback');

const ds=ZYAI.apply(analysis,{provider:'deepseek',model:'deepseek-flash',facts:[{field:'employer',value:'某院舍',evidence:'某院舍'}]});
assert.equal(ds.order.aiProvider,'deepseek');assert.equal(ds.order.code,analysis.order.code);
assert.equal(JSON.parse(ZYRecognitionArchive.capture(raw,ds.order)).provider,'deepseek');
const foreign=validateForeign();function validateForeign(){const a=P.analyze('岗位：照护助理\n薪资：MOP11200含房补\n性别：女','ZY-26-1106-99');a.order.salary='';return ZYAI.apply(a,{provider:'deepseek',model:'deepseek-flash',facts:[{field:'salary',value:'MOP11200含房补',evidence:'薪资：MOP11200含房补'}]});}
assert(foreign.order.salary.includes('MOP11200'));
