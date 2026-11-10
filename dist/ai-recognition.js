/* Optional authenticated AI assistance. No API key, external model URL or automatic writes. */
(function(root){
 const keys=['title','employer','salary','gender','age','language','hours','rest','interview','workContent','requirements','notes'];
 let availability=null,matchWarningShown=false;
 function reset(){availability=null;matchWarningShown=false}
 async function available(){
  if(root.ZY_CONFIG?.provider!=='supabase')return false;
  if(!availability)availability=api('/api/recognition-status',{method:'POST'}).then(data=>data).catch(()=>false);
  return !!(await availability)?.enabled;
 }
 function apply(analysis,response){
  const P=root.ZYOrderParser,source=analysis.order?.raw;if(!source||!response||!['gemini','deepseek'].includes(response.provider)||typeof response.model!=='string'||!Array.isArray(response.facts)||response.facts.length>60)return analysis;
  // Only fresh machine drafts may be merged; persisted/manual records require a new explicit preview.
  if(analysis.order.id||analysis.order.humanReviewedSource||P.isHumanReviewed(analysis.order))return analysis;
  let manual=[];try{manual=JSON.parse(analysis.order.manualFields||'[]')}catch{}
  if(Array.isArray(manual)&&manual.length)return analysis;
  const grouped={},facts=[];
  for(const fact of response.facts){
   if(!fact||!keys.includes(fact.field)||typeof fact.value!=='string'||typeof fact.evidence!=='string'||!fact.value.trim()||!source.includes(fact.evidence)||!fact.evidence.includes(fact.value)||fact.value.length>2000)throw new Error('AI返回内容缺少原文依据');
   if(P.sourceIdentifiers(fact.value).length||/底价|底價|全包|包价|包價|总价|總價|上家|劳务|勞務|办证|辦證|中介|保险另计|保險另計/.test(fact.evidence))continue;
   if(fact.field==='salary'&&!/工资|工資|月薪|薪资|薪資|薪酬|薪金|津贴|津貼|奖金|獎金|提成|花红|花紅|MOP|澳门元|澳門元|HKD|HK\$|HK|港币|港幣|港元|[$]/i.test(fact.evidence))continue;
   if(['hours','rest'].includes(fact.field)&&!/[时時钟鐘天日周週班休更]|[hH](?![A-Za-z])|\d{1,2}:\d{2}/.test(fact.value))continue;
   if(fact.field==='interview'&&/^(?:具体|具體|详情|詳情|以上|仅供|僅供|以面试|以面試)/.test(fact.value)&&/(?:为准|為準|参考|參考)/.test(fact.value))continue;
   (grouped[fact.field]??=[]).push(fact.value);facts.push({field:fact.field,value:fact.value,evidence:fact.evidence});
  }
  let order={...analysis.order},warnings=[];
  const normal=(key,value)=>key==='salary'?P.formatCompanySalary(value):key==='gender'?P.normalizeGender(value):String(value||'').replace(/\s/g,'');
  for(const [key,items]of Object.entries(grouped)){
   const values=[...new Set(items)];
   if(['title','employer','age','gender'].includes(key)&&values.length>1){warnings.push('AI与规则结果有差异，请核对原文');continue;}
   const value=values.join('；'),existing=order[key]||'';
   if(existing&&['title','employer','salary','gender','age'].includes(key)&&normal(key,existing)!==normal(key,value))warnings.push('已采用AI原文识别结果，与规则有差异，请核对');
   order[key]=key==='gender'?P.normalizeGender(value):value;
  }
  if(!grouped.interview&&/(?:具体|具體|详情|詳情|以面试|以面試).*(?:为准|為準)/.test(order.interview||''))order.interview='';
  order=P.sanitizeCompany(order);order.salary=P.formatCompanySalary(order.salary);
  // Fixed code/source/price are never supplied or changed by AI.
  order.code=analysis.order.code;order.raw=source;order.price=analysis.order.price;
  order.aiProvider=response.provider;order.aiModel=response.model;order.aiEvidence=JSON.stringify(facts);order.aiWarnings=JSON.stringify([...new Set(warnings)]);
  if(response.matchProfile&&root.ZYMatching){const profile={...response.matchProfile,version:1,sourceHash:root.ZYMatching.sourceHash(order,'order'),by:'ai',at:new Date().toISOString()};if(root.ZYMatching.profileFor({...order,matchProfile:profile},'order').valid)order.matchProfile=profile;}
  const review=P.reviewOrder(source,order);
  order.parsedSnapshot=JSON.stringify(Object.fromEntries(['code',...keys,'price'].map(key=>[key,order[key]||''])));
  return {...analysis,order,warnings:[...new Set([...review.warnings,...warnings])],sources:review.sources,unclassified:review.unclassified,conflicts:review.conflicts,ledger:review.ledger};
 }
 async function enhance(analysis,onProgress){
  if(!analysis.order||!await available())return analysis;
  onProgress?.(45,'等待AI返回');
  try{return apply(analysis,await api('/api/recognize-order',{method:'POST',body:{source:analysis.order.raw}}))}
  catch{return {...analysis,warnings:[...analysis.warnings,'AI暂不可用，已保留规则识别结果']}}
 }
 async function analyzeMatch(record,kind,{quiet=false}={}){
  const M=root.ZYMatching;if(!M)return null;if(M.profileFor(record,kind).valid)return record.matchProfile;
  if(!await available()||!(await availability)?.classification){if(!quiet&&typeof toast==='function')toast('AI暂不可用，使用规则归类');return null}
  let timer;try{const response=await Promise.race([api('/api/match-profile',{method:'POST',body:{kind,input:M.sourceFor(record,kind)}}),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('timeout')),20000))]),profile={...response.matchProfile,version:1,sourceHash:M.sourceHash(record,kind),by:'ai',at:new Date().toISOString()};if(!response.matchProfile||!M.profileFor({...record,matchProfile:profile},kind).valid)throw Error('Invalid profile');return profile}
  catch{if(!matchWarningShown&&typeof toast==='function'){matchWarningShown=true;toast('AI归类未完成或额度不足，使用规则归类')}return null}finally{clearTimeout(timer)}
 }
 root.ZYAI={enhance,apply,reset,analyzeMatch};
})(globalThis);
