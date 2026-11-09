import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../dist/order-parser.js';
const P=ZYOrderParser,catalog=JSON.parse(readFileSync('tests/fixtures/recognition-errors.json','utf8'));
const businessKeys=['code','title','employer','salary','gender','age','language','hours','rest','workContent','requirements','interview','notes'];
function coverage(result){
 const raw=result.order.raw,covered=new Uint8Array(raw.length),ids=new Set();
 for(const entry of result.ledger){
  assert(['classified','excluded','review','conflict'].includes(entry.disposition));assert(entry.reason);assert(!ids.has(entry.id));ids.add(entry.id);
  assert.equal(raw.slice(entry.start,entry.end),entry.text);assert(entry.end>entry.start);
  if(entry.disposition==='classified')assert(entry.fields.length);
  for(let i=entry.start;i<entry.end;i++)covered[i]=1;
 }
 for(let i=0;i<raw.length;i++)if(!/[\s，,；;。]/.test(raw[i]))assert(covered[i],`Unaccounted character at ${i}: ${raw.slice(i,i+12)}`);
}
for(const fixture of catalog.cases){
 const result=P.analyze(fixture.source,'ZY-26-1103-90',fixture.options||{});assert(result.order,fixture.id);if(fixture.savedRecord){const saved={...result.order,...fixture.savedRecord};assert.equal(P.isHumanReviewed(saved),fixture.expectedReviewed,fixture.id);assert.deepEqual(P.validateCompany(saved,true),[]);}
 const view=P.present(result.order);
 for(const [key,value]of Object.entries(fixture.expected||{}))assert.equal(view[key],value,fixture.id+' '+key);
 for(const [key,values]of Object.entries(fixture.contains||{}))for(const value of values)assert(view[key].includes(value),fixture.id+' '+key+' missing '+value);
 const company=businessKeys.map(key=>view[key]||'').join('\n');for(const value of fixture.forbidden||[])assert(!company.includes(value),fixture.id+' leaked '+value);
 for(const value of fixture.unknown||[])assert(result.unclassified.includes(value),fixture.id+' omitted unknown '+value);
 if(fixture.warning)assert(result.warnings.some(w=>w.includes(fixture.warning)),fixture.id+' missing warning');
 if(fixture.excluded)assert(result.excluded.some(e=>e.text.includes(fixture.excluded)),fixture.id+' missing exclusion');
 if(fixture.conflict)assert(result.conflicts.some(e=>e.fields.includes(fixture.conflict)),fixture.id+' missing conflict');
 coverage(result);
 assert.equal(result.order.recognitionAudit,P.parse(fixture.source,'ZY-26-1103-90').recognitionAudit);
}
// Shared rules must work beyond the reported role, amount, and row order.
for(const title of ['人力资源文员','货车司机','西餐帮厨','维修电工','仓务助理','美容师','餐厅服务员','保险文员'])for(const currency of ['HK','HK$','HKD','港幣'])for(const plus of ['','+']){
 const raw=`38岁内，本科男女，略懂英文，2年经验\n8H，休4\n${title}${currency}17650${plus}\n工作内容：整理文件\n💰23000+3500`;
 const r=P.analyze(raw,'ZY-26-1103-90');assert.equal(r.order.title,title);assert.equal(P.present(r.order).salary,'HKD17650'+plus);assert.equal(r.order.gender,'男女不限');assert.equal(r.order.age,'38岁内');coverage(r);
}
const unknown=P.parse(catalog.cases.find(c=>c.id==='REC-005').source,'ZY-26-1103-90');assert(P.validateCompany(unknown,true).includes('请先核对未分类或冲突内容并确认'));
unknown.reviewConfirmation=P.reviewSignature(unknown.raw);assert(!P.validateCompany(unknown,true).includes('请先核对未分类或冲突内容并确认'));
assert(P.validateCompany({...unknown,raw:'新增未知条件\n'+unknown.raw},true).includes('请先核对未分类或冲突内容并确认'));
const unsafe=P.sanitizeCompany({salary:'HKD18000',workContent:'制作报价单；报价单35000；提供保险资料；保险另计',notes:'住扣10%；上家报价35000'});
assert(unsafe.workContent.includes('制作报价单'));assert(unsafe.workContent.includes('保险资料'));assert(!JSON.stringify(unsafe).includes('35000'));
const multiline=P.parse('岗位：厨师\n工资：\nHKD18800\n年龄：\n35岁以下\n性别：\n男\n工作时间：\n每天9小时','ZY-26-1103-90');assert.equal(multiline.salary,'HKD18800');assert.equal(multiline.age,'35岁以下');assert.equal(multiline.gender,'男');assert.match(multiline.hours,/9小时/);
for(const text of ['负责保险理赔，具备2年经验','制作费用报表，每月整理500份','操作功率500W设备']){const record=P.parse('岗位：文员\n工资：HKD18000\n性别：男\n工作内容：'+text,'ZY-26-1103-90');assert(!P.validateCompany(record,true).includes('公司单仍有原单报价或费用信息，请核对'));assert(record.workContent.includes(text.split('，')[0]));}
for(const amount of ['HKD35000','35000HKD','HK$35000','35000元','3.5w']){const record=P.parse('岗位：司机\n性别：男\n工资：HKD18000\n备注：保险'+amount+'；办证另计','ZY-26-1103-90');assert(!record.notes.includes('35000'));assert(!record.notes.includes('3.5w'));assert(!record.salary.includes('35000'));}
const html=readFileSync('dist/index.html','utf8');assert(!/^(?:async )?function (?:autoParse|saveOrder|previewBatch|renderBatch|saveBatch|copyOrder)\(/m.test(html),'Duplicate inline handlers must not return');
console.log(`PASS: ${catalog.cases.length} documented error families, 64 compact-role variants, complete span accounting, review confirmation invalidation and duplicate-handler guard`);

const oldShift={hours:'每天9小时',shift:'轮班',salary:'18000',raw:'旧原单'};const shifted=P.present(oldShift);assert.equal(shifted.hours,'每天9小时；轮班');assert(!Object.hasOwn(shifted,'shift'));assert.equal(oldShift.shift,'轮班');assert.equal(P.parse('岗位：司机\n工资：18000\n班次：夜班','ZY-26-1103-90').hours,'夜班');
// The audit uses private records in memory and does not manufacture absent facts.
globalThis.window=globalThis;globalThis.loginScreen=()=>{};await import('../dist/recognition-archive.js');await import('../dist/order-audit.js');
const sourceCase=catalog.cases.find(c=>c.id==='REC-013');const audit=ZYOrderAudit.inspect({id:'audit-synthetic',code:'ZY-26-1103-90 CV',raw:sourceCase.source,salary:'1',title:'旧职位'});assert(audit.notProvided.includes('workContent'));assert.equal(audit.candidate.workContent,'');assert.equal(audit.candidate.salary,'HKD14260+');assert(!audit.unsupported.length);assert.deepEqual(audit.changed,[]);assert(audit.sources.salary.length);
console.log('PASS: shift merged into hours, read-only self-audit, field provenance and no invented duties');

// Human confirmation is durable across parser releases and overrides machine disagreement.
const reviewedSource=catalog.cases.find(c=>c.id==='REC-005').source;
const manualRecord={...P.parse(reviewedSource,'ZY-26-1103-90'),id:'manual-reviewed',status:'ready',price:'4w',title:'人工确认的厨师',employer:'人工确认的雇主',reviewConfirmation:'8-54-8fc57fbe'};
assert(P.isHumanReviewed(manualRecord));assert.deepEqual(P.validateCompany(manualRecord,true),[]);assert.equal(ZYOrderAudit.inspect(manualRecord).needsReview,false);assert.equal(ZYOrderAudit.inspect(manualRecord).candidate,null);
const stamp=P.humanReviewMetadata(manualRecord,'test-owner');assert.equal(stamp.humanReviewedSource,P.reviewSignature(reviewedSource));
assert(P.isHumanReviewed({...manualRecord,...stamp,parserVersion:'future-version'}));
assert(!P.isHumanReviewed({...manualRecord,...stamp,raw:'changed source\n'+reviewedSource}));
const legacyManual={...manualRecord,reviewConfirmation:'',manualFields:'["title"]',parsedSnapshot:JSON.stringify({title:'旧识别标题'})};assert(P.isHumanReviewed(legacyManual));assert.equal(ZYOrderAudit.inspect(legacyManual).needsReview,false);
const unreviewed={...manualRecord,title:'厨师',reviewConfirmation:'',manualFields:'[]'};assert(!P.isHumanReviewed(unreviewed));assert(P.validateCompany(unreviewed,true).length);
assert(P.validateCompany({...manualRecord,...stamp,gender:''},true).length);assert(P.validateCompany({...manualRecord,...stamp,notes:'上家全包35000'},true).length);
console.log('PASS: durable historical review tokens, manual-save precedence, no audit re-warning, changed-source invalidation and retained field/fee checks');

// Supplier provenance is metadata, never authority to rewrite an edited company code.
const prefixed=P.parse('SUPPLIER-20994444 岗位：司机\n工资：HK18000\n性别：男','ZY-26-1103-90');
assert.equal(prefixed.code,'ZY-26-1103-90 SUPPLIER');
for(const code of ['ZY-26-1103-91','ZY-26-1103-91 OTHER']){
 const edited={...prefixed,code};assert.equal(P.sanitizeCompany(edited).code,code);assert.equal(P.present(edited).code,code);assert.equal(P.present(P.present(edited)).code,code);assert.equal(edited.sourcePrefix,'SUPPLIER');
}
for(const title of ['大车维修','汽車維修','机修工','维修工'])for(const currency of ['HK','HK$','HKD']){const o=P.parse(`${title}${currency}24780+\n男，49岁内`);assert.equal(o.title,title);assert.equal(P.present(o).salary,'HKD24780+');}
assert.equal(P.parse('汽车维修资格证\n岗位：司机\n工资：HK18000').title,'司机');
console.log('PASS: manual code precedence and vehicle repair/certificate boundaries');

// Identity evidence is collected across the document, never from a fixed row or a known-title gate.
let identityVariants=0;
for(const title of ['工序协调专岗','场务统筹专岗','接待协调专岗','布草整理专岗'])for(const currency of ['HK','HK$','HKD','港幣'])for(const format of ['招聘','compact','labelled']){
 const header=format==='招聘'?`海岸测试酒店招聘${title}${currency}21890+`:format==='compact'?`海岸测试酒店\n${title}${currency}21890+`:`【雇主】海岸测试酒店\n【岗位】${title}\n【月薪】${currency}21890+`;
 const sections=[header,'男，43岁以下，粤语','工作时间：每天9小时，轮班','工作内容：整理用品','备注：住扣10%\n💰3.87'];
 for(const reverse of [false,true]){
  const raw=(reverse?[...sections].reverse():sections).join('\n'),r=P.analyze(raw,'ZY-26-1103-90');assert(r.order);const o=P.present(r.order);
  assert.equal(o.title,title,raw);assert.equal(o.employer,'海岸测试酒店',raw);assert.equal(o.salary,'HKD21890+',raw);assert.equal(o.gender,'男');assert.equal(o.age,'43岁以下');assert(!businessKeys.map(k=>o[k]||'').join('').includes('3.87'));coverage(r);
  const evidence=JSON.parse(r.order.recognitionAudit).identityCandidates;
  for(const e of evidence)assert.equal(r.order.raw.slice(e.start,e.end),e.value,'Identity must be a literal source excerpt');
  for(const key of ['title','employer'])assert(evidence.some(e=>e.field===key&&e.value===o[key]));identityVariants++;
 }
}
for(const text of ['雇主提供住宿','持有车辆维修证书','工作地点：海岸测试酒店','工作内容：接待海岸测试酒店客户','【自定义】场务统筹专岗']){
 const r=P.parse(text+'\n工资：HK21000\n性别：男');assert.equal(r.title,'',text);assert.equal(r.employer,'',text);
}
const literal=P.parse('岗位：布草整理专岗\n工资：HK21000\n性别：女');assert.equal(literal.title,'布草整理专岗');assert.equal(literal.employer,'');assert.equal(literal.workContent,'');
const paired='工序协调专岗HK21000\n男，43岁以下\n\n布草统筹专岗HK22000\n女，42岁以下';assert.equal(P.splitOrders(paired).length,2);assert.deepEqual(P.splitOrders(paired).map(s=>P.parse(s).title),['工序协调专岗','布草统筹专岗']);
console.log(`PASS: ${identityVariants} identity/currency/order variants, literal source spans, no invented employers/duties and unfamiliar multi-order boundaries`);

// Staff-supplied batch boundaries are authoritative; do not infer extra documents inside them.
const delimited='岗位：司机\n工资：HK21000\n岗位：接待协调专岗\n---\n岗位：厨师\n工资：HK22000';
assert.equal(P.splitBatchOrders(delimited).length,2);assert.equal(P.splitBatchOrders(delimited.replace('\n---\n','\n')).length,1);
const confirmed=P.analyze(P.splitBatchOrders(delimited)[0],'ZY-26-1103-90',{explicitBoundary:true});assert(confirmed.order);assert.equal(confirmed.order.boundaryMode,'explicit');assert.equal(confirmed.order.title,'');assert(confirmed.conflicts.some(e=>e.fields.includes('title')));assert(!P.validateCompany(confirmed.order).some(e=>e.includes('检测到多份')));
assert.equal(P.analyze(P.splitBatchOrders(delimited)[0]).order,null,'Single entry still detects multiple explicit roles');

for(const heading of ['男','男女','粤语','本科','43岁以下','雇主免费提供住宿']){const o=P.parse(heading+'\n工资：HK21000');assert.equal(o.title,'',heading+' is a condition, not a role');assert.equal(o.employer,'');}
assert.equal(P.parse('岗位：招聘专员\n工资：HK21000').title,'招聘专员');assert.equal(P.parse('资料录入专岗HK21000').title,'资料录入专岗');

for(const title of ['餐厅服务员','酒店前台','美容中心接待专岗']){const o=P.parse(title+'\n工资：HK21000');assert.equal(o.title,title);assert.equal(o.employer,'');}
for(const employer of ['海岸诊所','海岸医院','海岸商行','海岸会所']){const o=P.parse(employer+'\n工序协调专岗HK21000');assert.equal(o.employer,employer);assert.equal(o.title,'工序协调专岗');}

// Retirement deletes only redundant first-machine snapshots, retaining all business values.
const retained={id:'retained',raw:'原单原文',title:'人工职位',salary:'HKD29999',notes:'人工备注',price:'3.8w',humanReviewedSource:'confirmed',firstRecognition:'private old snapshot'};
const cleaned=ZYRecognitionArchive.cleanOrders([retained])[0];assert(!('firstRecognition' in cleaned));const expected={...retained};delete expected.firstRecognition;assert.deepEqual(cleaned,expected);assert.equal(retained.firstRecognition,'private old snapshot');assert.equal(ZYRecognitionArchive.capture,undefined);
for(const fixture of catalog.cases.filter(f=>['REC-023','REC-024','REC-025','REC-026','REC-030'].includes(f.id))){const r=P.analyze(fixture.source,'ZY-26-1103-90',fixture.options||{});assert(!r.warnings.some(w=>w.includes('性别不明确')));assert(r.sources.gender?.length);if(r.order.age)assert(r.sources.age?.length);}
console.log('PASS: report-derived regressions, source-tracked demographics and snapshot retirement preserving business records');

// Entry mode owns document boundaries: repeated reference/footer is one submitted document.
const repeatedFooter='香港某餐饮集团\n【职位编号】BV1086241\n【职位名称】点心制作员\n【薪酬待遇】HKD18300-21500+加班费\n【工作时间】每周6天，每天9H\n【职位要求】男女不限，22-46岁，粤语流利\n【具体要求】制作点心，有2年以上经验\n【食宿安排】包工作餐，住宿扣10%底薪\n——————————————\n第三方费用2.18w（包含劳务费、办证费、保险）\nBV1086241 香港某餐饮集团 点心制作员 0';
const oneSubmitted=P.analyze(repeatedFooter,'ZY-26-1106-91',{explicitBoundary:true});assert(oneSubmitted.order);assert.equal(oneSubmitted.parts.length,1);assert.equal(oneSubmitted.order.boundaryMode,'explicit');assert.equal(oneSubmitted.order.title,'点心制作员');assert.equal(P.splitBatchOrders(repeatedFooter+'\n---\n职位：接待专员\n月薪HK18000').length,2);
