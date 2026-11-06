/* Optional authenticated AI assistance. No API key, external model URL or automatic writes. */
(function(root){
 const keys=['title','employer','salary','gender','age','language','hours','rest','interview','workContent','requirements','notes'];
 let availability=null;
 function reset(){availability=null}
 async function available(){
  if(root.ZY_CONFIG?.provider!=='supabase')return false;
  if(!availability)availability=api('/api/recognition-status',{method:'POST'}).then(data=>!!data.enabled).catch(()=>false);
  return availability;
 }
 function apply(analysis,response){
  const P=root.ZYOrderParser,source=analysis.order?.raw;if(!source||!response||!['gemini','deepseek'].includes(response.provider)||typeof response.model!=='string'||!Array.isArray(response.facts)||response.facts.length>60)return analysis;
  const grouped={},facts=[];
  for(const fact of response.facts){
   if(!fact||!keys.includes(fact.field)||typeof fact.value!=='string'||typeof fact.evidence!=='string'||!fact.value.trim()||!source.includes(fact.evidence)||!fact.evidence.includes(fact.value)||fact.value.length>2000)throw new Error('AI返回内容缺少原文依据');
   if(P.sourceIdentifiers(fact.value).length||/底价|底價|全包|包价|包價|总价|總價|上家|劳务|勞務|办证|辦證|中介|保险另计|保險另計/.test(fact.evidence))continue;
   if(fact.field==='salary'&&!/工资|工資|月薪|薪资|薪資|薪酬|薪金|津贴|津貼|奖金|獎金|提成|花红|花紅|MOP|澳门元|澳門元|HKD|HK\$|HK|港币|港幣|港元|[$]/i.test(fact.evidence))continue;
   if(['hours','rest'].includes(fact.field)&&!/[时時天日周週班休更hH]|\d{1,2}:\d{2}/.test(fact.value))continue;
   (grouped[fact.field]??=[]).push(fact.value);facts.push({field:fact.field,value:fact.value,evidence:fact.evidence});
  }
  let order={...analysis.order},warnings=[];
  const normal=(key,value)=>key==='salary'?P.formatCompanySalary(value):key==='gender'?P.normalizeGender(value):String(value||'').replace(/\s/g,'');
  for(const [key,items]of Object.entries(grouped)){
   const values=[...new Set(items)];
   if(['title','employer','age','gender'].includes(key)&&values.length>1){warnings.push('AI与规则结果有差异，请核对原文');continue;}
   const value=values.join('；'),existing=order[key]||'';
   if(!existing){order[key]=key==='gender'?P.normalizeGender(value):value;continue;}
   if(['title','employer','salary','gender','age'].includes(key)&&normal(key,existing)!==normal(key,value))warnings.push('AI与规则结果有差异，请核对原文');
  }
  order=P.sanitizeCompany(order);order.salary=P.formatCompanySalary(order.salary);
  // Fixed code/source/price are never supplied or changed by AI.
  order.code=analysis.order.code;order.raw=source;order.price=analysis.order.price;
  order.aiProvider=response.provider;order.aiModel=response.model;order.aiEvidence=JSON.stringify(facts);order.aiWarnings=JSON.stringify([...new Set(warnings)]);
  const review=P.reviewOrder(source,order);
  order.parsedSnapshot=JSON.stringify(Object.fromEntries(['code',...keys,'price'].map(key=>[key,order[key]||''])));
  return {...analysis,order,warnings:[...new Set([...review.warnings,...warnings])],sources:review.sources,unclassified:review.unclassified,conflicts:review.conflicts,ledger:review.ledger};
 }
 async function enhance(analysis){
  if(!analysis.order||!await available())return analysis;
  try{return apply(analysis,await api('/api/recognize-order',{method:'POST',body:{source:analysis.order.raw}}))}
  catch{return {...analysis,warnings:[...analysis.warnings,'AI暂不可用，已保留规则识别结果']}}
 }
 root.ZYAI={enhance,apply,reset};
})(globalThis);
