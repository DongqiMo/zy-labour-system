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
 const result=P.analyze(fixture.source,'ZY-26-1103-90');assert(result.order,fixture.id);const view=P.present(result.order);
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
globalThis.window=globalThis;globalThis.loginScreen=()=>{};await import('../dist/order-audit.js');
const sourceCase=catalog.cases.find(c=>c.id==='REC-013');const audit=ZYOrderAudit.inspect({id:'audit-synthetic',code:'ZY-26-1103-90 CV',raw:sourceCase.source,salary:'1',title:'旧职位'});assert(audit.missing.includes('workContent'));assert.equal(audit.candidate.workContent,'');assert.equal(audit.candidate.salary,'HKD14260+');assert(!audit.unsupported.length);assert(audit.changed.includes('salary'));assert(audit.sources.salary.length);
console.log('PASS: shift merged into hours, read-only self-audit, field provenance and no invented duties');
