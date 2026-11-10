/* Deterministic experience-first matching. No DOM, storage or network access. */
(function(root){
 const T=root.ZYTime||(typeof require==='function'?require('./business-time.js'):null),vocab=root.ZYJobCategories||(typeof require==='function'?require('./job-categories.js'):null);
 const levels={流利:4,熟练:4,熟練:4,良好:3,一般:2,略懂:1,完全不懂:0},marks={ok:'✓',partial:'≈',unknown:'?',bad:'✗'};
 const languages=[{key:'cantonese',name:'粤语',aliases:['粤语','粵語','广东话','廣東話','白话','白話']},{key:'mandarin',name:'普通话',aliases:['普通话','普通話','国语','國語']},{key:'english',name:'英语',aliases:['英语','英語','英文']},...['日语','韩语','葡语','葡萄牙语','法语','德语','俄语','泰语','越南语','印尼语','西班牙语'].map(name=>({key:name,name,aliases:[name]}))];
 const string=x=>String(x??'').trim(),round=x=>Math.round(x*100)/100;
 function why(template,values={}){return {template,values,text:template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''))}}
 function dimension(key,label,got,max,mark,reasons,extra={}){return {key,label,got,displayGot:got===null?null:round(got),max,mark,reasons,text:reasons.map(r=>r.text).join('；'),missing:[],...extra}}
 function parseAgeRange(value){
  const text=string(value).replace(/\s+/g,'');if(!text||/不限/.test(text))return {min:null,max:null,unlimited:true,unknown:false};let m;
  if((m=text.match(/(\d{1,3})\s*(?:-|–|—|~|～|至|到)\s*(\d{1,3})/))&&+m[1]<=+m[2])return {min:+m[1],max:+m[2],unknown:false};
  if((m=text.match(/(\d{1,3})岁?(?:以内|以下|内|以內|以內)/)))return {min:null,max:+m[1],unknown:false};
  if((m=text.match(/(\d{1,3})岁?(?:以上|起)/)))return {min:+m[1],max:null,unknown:false};
  return {min:null,max:null,unknown:true};
 }
 function workerAge(worker,today=T.todayKey()){
  if(/^\d{4}-\d{2}-\d{2}$/.test(string(worker.birthDate))&&T.addDays(worker.birthDate,0)){
   const [by,bm,bd]=worker.birthDate.split('-').map(Number),[y,m,d]=today.split('-').map(Number),age=y-by-(m<bm||m===bm&&d<bd?1:0);if(age>=0&&age<=120)return age;
  }const match=string(worker.age).match(/\d{1,3}/);return match&&+match[0]<=120?+match[0]:null;
 }
 function parsePeriod(value,today=T.todayKey()){
  const [y,m]=today.split('-').map(Number),now=y*12+m-1,text=string(value).replace(/\s+/g,'').replace(/年/g,'.').replace(/月/g,'');
  const hit=text.match(/^(\d{4})(?:[./](\d{1,2}))?(?:-|–|—|~|～|至|到)(?:(\d{4})(?:[./](\d{1,2}))?|(至今|今|现在|目前))$/);
  const fallback={months:12,start:null,end:null,endYear:null,unknown:true,approximate:false,current:false,recency:.7};
  if(!hit)return fallback;const sy=+hit[1],sm=hit[2]?+hit[2]:1,current=!!hit[5],ey=current?y:+hit[3],em=current?m:hit[4]?+hit[4]:12;
  if(!T.monthInfo(sy,sm)||!T.monthInfo(ey,em))return fallback;
  const start=sy*12+sm-1,end=ey*12+em-1;if(end<start||start>now)return fallback;const ago=Math.max(0,now-end);
  return {months:Math.max(1,end-start),start,end,endYear:ey,unknown:false,approximate:!hit[2]||!current&&!hit[4],current,recency:ago<=60?1:ago<=120?.7:.4};
 }
 function jobCategory(title,workContent=''){const find=text=>vocab.categories.filter(c=>c.keywords.some(k=>string(text).includes(k))).map(c=>c.id),ids=find(title);return ids.length?ids:find(workContent)}
 function historyCategory(h){const ids=jobCategory([h.position,h.duties].filter(Boolean).join(' ')||(h.supplement?h.employer:''));return ids.length?ids:h.supplement?vocab.categories.filter(c=>(c.employerKeywords||[]).some(k=>string(h.employer).includes(k))).map(c=>c.id):[]}
 function categoryRelation(left,right){if(left.some(id=>right.includes(id)))return 1;return left.some(id=>vocab.categories.find(c=>c.id===id)?.related.some(other=>right.includes(other)))?.5:0}
 function relevance(history,order){const literal=jobCategory([history.position,history.duties].filter(Boolean).join(' ')|| (history.supplement?history.employer:'')),own=literal.length?literal:history.supplement?vocab.categories.filter(c=>(c.employerKeywords||[]).some(k=>string(history.employer).includes(k))).map(c=>c.id):[],target=jobCategory(order.title,order.workContent),category=categoryRelation(own,target);if(category)return category;return 0}
 function languageLevel(value){const text=string(value);if(!text)return null;for(const [word,n]of Object.entries(levels))if(text.includes(word))return n;return null}
 function requiredLevel(text){if(/流利|熟练|熟練/.test(text))return 4;if(/良好|会说|會說|会讲|會講/.test(text))return 3;if(/听得懂|聽得懂|略懂/.test(text))return 1;return 2}
 function parseLanguageRequirement(value,requirements=''){
  const text=[value,requirements].filter(Boolean).join('；'),mentions=[];
  for(const language of languages)for(const alias of language.aliases){let at=text.indexOf(alias);while(at>=0){mentions.push({...language,alias,index:at,end:at+alias.length});at=text.indexOf(alias,at+alias.length)}}
  for(const clause of text.split(/[、，,；;。\n]|或|和|及/)){const found=clause.match(/[\u4e00-\u9fff]{1,6}[语话話]/);if(!found)continue;const name=found[0].replace(/^(?:需要|要求|熟练|熟練|流利|良好|会说|會說|会讲|會講|略懂|简单|基本|需|须|懂)+/g,'');if(name.length<2||name.length>5||['语言','語言','说话','說話','讲话','講話','电话','電話','对话','外语'].includes(name)||languages.some(l=>l.aliases.some(alias=>name.includes(alias))))continue;const at=text.indexOf(name);if(at>=0)mentions.push({key:name,name,aliases:[name],alias:name,index:at,end:at+name.length})}
  mentions.sort((a,b)=>a.index-b.index||b.alias.length-a.alias.length);const unique=mentions.filter((item,i)=>!mentions.slice(0,i).some(prev=>prev.index<=item.index&&prev.end>=item.end));
  const groups=[],sequence=[],separator=/[、，,；;。\n]|以及|并且|和|及|或者|或|\//;
  unique.forEach((item,i)=>{
   const before=text.slice(i?unique[i-1].end:0,item.index),after=text.slice(item.end,unique[i+1]?.index??text.length),prefix=i===0||separator.test(before)?before.split(separator).at(-1):'',suffix=after.split(separator)[0];
   if(/不要求|无需|無需|不用/.test(prefix)||/不限|不要求/.test(suffix))return;
   const gradePattern=/流利|熟练|熟練|良好|会说|會說|会讲|會講|一般|基本|简单|听得懂|聽得懂|略懂/,quality=prefix+' '+suffix;const requirement={key:item.key,name:item.name,level:requiredLevel(quality),text:item.alias+suffix.trim(),explicitLevel:gradePattern.test(quality),critical:requiredLevel(quality)>=4||/(?:须会|須會|须讲|須講|必须会|必須會|必须讲|必須講|需会|需會|需懂|需要会|需要會)/.test(text.slice(Math.max(text.lastIndexOf('；',item.index-1),text.lastIndexOf('，',item.index-1),text.lastIndexOf('。',item.index-1),text.lastIndexOf('\n',item.index-1))+1,item.index))||/(?:必须|必須|须|須|需)\s*$/.test(prefix)};
   const shared=suffix.match(gradePattern)?.[0];if(shared&&!gradePattern.test(prefix)){let connector=before;for(let j=sequence.length-1;j>=0&&/^[\s、和及或/]+$/.test(connector);j--){if(sequence[j].req.explicitLevel)break;sequence[j].req.level=requiredLevel(shared);if(requiredLevel(shared)>=4)sequence[j].req.critical=true;sequence[j].req.text+=shared;connector=sequence[j].before}}sequence.push({req:requirement,before});
   if(groups.length&&/(?:或|\/)/.test(before)&&!/[；;。\n]/.test(before))groups.at(-1).push(requirement);else groups.push([requirement]);
  });
  return {groups,unknown:!groups.length&&!!string(value)&&!/不限|不要求|无需|無需/.test(value)};
 }
 function histories(worker){const rows=(worker.workHistory||[]).map((h,index)=>({...h,index})).filter(h=>[h.employer,h.position,h.duties,h.period].some(v=>string(v)));if(worker.workedHongKong==='是'&&string(worker.hkEmployer)&&!rows.some(h=>string(h.employer)===string(worker.hkEmployer)))rows.push({employer:worker.hkEmployer,exitDate:worker.hkExitDate,index:(worker.workHistory||[]).length,supplement:true});return rows}
 function parseSalary(value,defaultCurrency='HKD'){
  const text=string(value),m=text.replace(/,/g,'').match(/\d+(?:\.\d+)?/);if(!m)return null;const amount=+m[0]*(new RegExp(m[0].replace('.','\\.')+'\\s*[万萬w]','i').test(text.replace(/,/g,''))?10000:1);if(amount<=0)return null;
  const currency=/MOP|澳门|澳門|葡币|葡幣/i.test(text)?'MOP':/HKD|HK\$|港币|港幣|港元/i.test(text)?'HKD':/CNY|RMB|人民币|人民幣/i.test(text)?'CNY':/USD|美元/i.test(text)?'USD':(text.match(/(?:^|[^A-Z])(CAD|EUR|GBP|AUD|SGD|JPY)(?=\s*\d|\b)/i)?.[1]?.toUpperCase()||defaultCurrency);return {amount,currency};
 }
 const edu=value=>{const text=string(value);return /博士|硕士|碩士/.test(text)?6:/本科|学士|學士/.test(text)?5:/大专|大專/.test(text)?4:/高中|中专|中專/.test(text)?3:/初中/.test(text)?2:/小学|小學/.test(text)?1:null};
 function sourceFor(value,kind){return kind==='worker'?{intents:[value.desiredJob1||value.desiredJob||'',value.desiredJob2||'',value.desiredJob3||''],history:(value.workHistory||[]).map(h=>({position:h.position||'',duties:h.duties||''})),certificates:value.certificates||''}:{title:value.title||'',workContent:value.workContent||'',requirements:value.requirements||'',language:value.language||'',notes:value.notes||''}}
 function sourceHash(value,kind){const text=JSON.stringify(kind==='worker'?{...sourceFor(value,kind),periods:(value.workHistory||[]).map(h=>h.period||'')}:sourceFor(value,kind));let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return 'v1-'+(h>>>0).toString(16)}
 function validCategory(id){return vocab.categories.some(c=>c.id===id)}
 function profileFor(value,kind='order'){try{return checkedProfileFor(value,kind)}catch{return checkedProfileFor({...value,matchProfile:null},kind)}}
 function checkedProfileFor(value,kind='order'){
  const source=sourceFor(value,kind),p=value.matchProfile,hash=sourceHash(value,kind),strings=JSON.stringify(source),validRow=(r,text)=>r&&validCategory(r.category)&&typeof r.evidence==='string'&&!!r.evidence&&text.includes(r.evidence)&&(!r.related||Array.isArray(r.related)&&r.related.every(validCategory));
  if(p?.version===1&&p.sourceHash===hash&&p.by==='ai'){
   if(kind==='worker'&&Array.isArray(p.intents)&&Array.isArray(p.history)&&p.intents.every(r=>Number.isInteger(r.index)&&r.index>=0&&r.index<3&&validRow(r,source.intents[r.index]))&&p.history.every(r=>Number.isInteger(r.index)&&r.index>=0&&r.index<source.history.length&&validRow(r,JSON.stringify(source.history[r.index]))))return {...p,intents:source.intents.map((t,index)=>{const r=p.intents.find(x=>x.index===index);return r?{...r,categories:[...new Set([r.category,...jobCategory(t)])],by:'ai'}:{index,categories:jobCategory(t),by:'rules'}}),history:histories(value).map(h=>{const r=p.history.find(x=>x.index===h.index);return r?{...r,categories:[...new Set([r.category,...historyCategory(h)])],by:'ai'}:{index:h.index,categories:historyCategory(h),by:'rules'}}),valid:true};
   if(kind==='order'&&validRow(p,strings)){
    const r=p.requirements||{};if(typeof r!=='object'||Array.isArray(r)||r.language&&!Array.isArray(r.language)||r.certificate&&!Array.isArray(r.certificate))return {by:'rules',valid:false,categories:jobCategory(value.title,value.workContent)};const evidence=x=>x&&typeof x.evidence==='string'&&!!x.evidence&&strings.includes(x.evidence),conditions=[];
    if(Object.values(r).some(v=>v!==null&&(Array.isArray(v)?v.some(x=>!evidence(x)):!evidence(v))))return {by:'rules',valid:false,categories:jobCategory(value.title,value.workContent)};
    for(const x of r.language||[])if(!['cantonese','mandarin','english'].includes(x.lang)||!Number.isInteger(x.level)||x.level<0||x.level>4)return {by:'rules',valid:false,categories:jobCategory(value.title,value.workContent)};
    for(const key of ['height','weight'])if(r[key]){const x=r[key];if(typeof x.value!=='number'||x.value<=0||!x.evidence.includes(String(x.value))||!['minimum','maximum'].includes(x.operator))return {by:'rules',valid:false,categories:jobCategory(value.title,value.workContent)};conditions.push({key,field:key,label:key==='height'?'身高':'体重',kind:x.operator,value:x.value,evidence:x.evidence})}
    for(const x of r.certificate||[])if(typeof x.value==='string'&&x.evidence.includes(x.value))conditions.push({key:'certificate:'+x.value,field:'certificates',label:'专业证书',kind:'certificate',value:x.value,evidence:x.evidence});else return {by:'rules',valid:false,categories:jobCategory(value.title,value.workContent)};
    if(r.education&&Number.isInteger(r.education.value)&&r.education.value>=1&&r.education.value<=5)conditions.push({key:'education',field:'education',label:'学历',kind:'education',value:r.education.value,evidence:r.education.evidence});
    if(r.health?.value===true)conditions.push({key:'health',field:'health',label:'健康状况',kind:'health',value:true,evidence:r.health.evidence});
    return {...p,categories:[...new Set([p.category,...jobCategory(value.title,value.workContent)])],conditions,valid:true};
   }
  }
  return kind==='worker'?{by:'rules',valid:false,sourceHash:hash,intents:source.intents.map((t,index)=>({index,categories:jobCategory(t),by:'rules'})),history:histories(value).map(h=>({index:h.index,categories:historyCategory(h),by:'rules'}))}:{by:'rules',valid:false,sourceHash:hash,categories:jobCategory(value.title,value.workContent)};
 }
 function scoreIntent(worker,order){
  const wants=[worker.desiredJob1||worker.desiredJob,worker.desiredJob2,worker.desiredJob3].map(string),target=profileFor(order,'order').categories;
  if(!wants.some(Boolean))return dimension('intent','意向加分',0,10,'unknown',[why('意向未命中（不扣分）')],{matchedIntentIndex:-1,categories:[],missing:['求职意向']});
  const ranked=wants.map((want,index)=>{const categories=profileFor(worker,'worker').intents.find(r=>r.index===index)?.categories||jobCategory(want),relation=categoryRelation(categories,target);return {index,categories,relation,got:[10,7,5][index]*relation}}).sort((a,b)=>b.got-a.got||a.index-b.index),best=ranked[0];
  return dimension('intent','意向加分',best.got,10,best.relation===1?'ok':best.relation?'partial':'bad',[best.relation?why('第{n}意向「{intent}」{relation}「{title}」',{n:best.index+1,intent:wants[best.index],relation:best.relation===1?'✓':'≈',title:order.title}):why('意向未命中（不扣分）')],{matchedIntentIndex:best.relation?best.index:-1,categories:best.relation?best.categories:[]});
 }
 function durationFactor(months){if(!Number.isFinite(months)||months<=0)return 0;if(months<6)return .4;if(months<12)return .5+(months-6)/6*.2;if(months<24)return .7+(months-12)/12*.2;if(months<36)return .9+(months-24)/12*.1;return 1}
 function recencyFactor(agoMonths){return agoMonths<=60?1:agoMonths<=120?.7:.4}
 function scoreExperience(worker,order,today=T.todayKey()){
  const target=profileFor(order,'order'),wp=profileFor(worker,'worker'),all=histories(worker),ranked=all.map(h=>{
   const periodInfo=parsePeriod(h.period,today),hp=wp.history?.find(r=>r.index===h.index),categories=hp?.categories||historyCategory(h),related=categoryRelation(categories,target.categories);
   if(h.supplement&&/^\d{4}-\d{2}-\d{2}$/.test(h.exitDate||'')&&T.addDays(h.exitDate,0)){const [ey,em]=h.exitDate.split('-').map(Number),[y,m]=today.split('-').map(Number);Object.assign(periodInfo,{end:ey*12+em-1,endYear:ey,recency:recencyFactor(Math.max(0,(y-ey)*12+m-em))})}
   const factor=durationFactor(periodInfo.months),value=100*related*factor*periodInfo.recency;
   return {...h,periodInfo,related,categories,durationFactor:factor,value,by:hp?.by||'rules'};
  }).filter(h=>h.related>0).sort((a,b)=>b.value-a.value||a.index-b.index),used=ranked.slice(0,2),hkBonus=used.some(h=>h.supplement||/香港/.test(h.employer||''))?10:0,got=Math.min(100,(used[0]?.value||0)+.25*(used[1]?.value||0)+hkBonus),reasons=used.map(h=>{const p=h.periodInfo;return why('{employer} {position}；{duration}；{end}；相关度 {relevance}，时间系数 {recency}',{employer:h.employer||'',position:h.position||'',duration:p.unknown?'时长不明，按12个月':(p.approximate?'约':'')+Math.floor(p.months/12)+'年'+p.months%12+'个月',end:p.current?'至今':p.endYear?p.endYear+'年离职':'结束时间不明',relevance:h.related,recency:p.recency})});
  if(hkBonus)reasons.push(why('香港相关经历加10分'));if(!used.length)reasons.push(why('没有相关工作经历'));
  return dimension('experience','工作经历',got,100,used.some(h=>h.periodInfo.unknown)?'unknown':used.some(h=>h.related===1)?'ok':used.length?'partial':'bad',reasons,{score:round(got),relevance:ranked.some(h=>h.related===1)?'same':'related',historyIndexes:used.map(h=>h.index),histories:used,hasRelated:!!ranked.length,by:used.some(h=>h.by==='ai')||target.by==='ai'?'ai':'rules',missing:used.some(h=>h.periodInfo.unknown)?['工作经历起止时间']:[]});
 }
 function assessLanguages(worker,order){
  const parsed=parseLanguageRequirement(order.language,order.requirements),profile=profileFor(order,'order');
  if(profile.by==='ai')for(const x of profile.requirements?.language||[])if(!parsed.groups.flat().some(r=>r.key===x.lang))parsed.groups.push([{key:x.lang,name:languages.find(l=>l.key===x.lang).name,level:x.level,text:x.evidence,by:'ai'}]);
  return parsed.groups.map(group=>{
   const choices=group.map(req=>{const raw=Object.hasOwn(worker,req.key)?worker[req.key]:string(worker.otherLanguages).includes(req.name)?worker.otherLanguages:'',level=languageLevel(raw)??(!['cantonese','mandarin','english'].includes(req.key)&&raw?2:null);return {req,raw,level,ratio:level===null?null:level>=req.level?1:level===req.level-1?.6:0}}),known=choices.filter(c=>c.level!==null).sort((a,b)=>b.ratio-a.ratio||b.level-a.level),best=known[0],complete=best?.ratio===1,unknown=!complete&&choices.some(c=>c.level===null),ratio=unknown?null:best?.ratio??null,critical=group.every(req=>req.critical),mark=unknown?'unknown':ratio===1?'ok':ratio>0?'partial':'bad';
   return {key:'language',label:group.map(r=>r.name).join(' / '),known:ratio!==null,ratio,mark,choices,satisfiedLanguages:complete?[best.req.key]:[],reason:unknown?why('语言资料不足，待确认；不计入条件符合度'):why('要求{requirement}；劳工为{actual}（{gap}）',{requirement:best.req.text,actual:best.raw,gap:best.level>=best.req.level?'达到要求':`差${best.req.level-best.level}级`}),by:group.some(r=>r.by==='ai')?'ai':'rules',missing:unknown?group.map(r=>r.name):[]};
  });
 }
 function scoreLanguage(worker,order){const conditions=assessLanguages(worker,order),known=conditions.filter(c=>c.known),got=known.length?100*known.reduce((sum,c)=>sum+c.ratio,0)/known.length:null;return dimension('language','语言',got,100,!conditions.length||!known.length?'unknown':got===100?'ok':got?'partial':'bad',conditions.map(c=>c.reason),{conditions,satisfiedLanguages:conditions.flatMap(c=>c.satisfiedLanguages),missing:conditions.flatMap(c=>c.missing)})}
 function scoreSalary(worker,order){
  const offered=parseSalary(order.salary,null),wanted=parseSalary(worker.desiredSalary),present=!!string(order.salary),currencyMismatch=!!offered&&!!wanted&&offered.currency!==wanted.currency,known=!!offered&&!!wanted&&wanted.currency===offered.currency,ratio=!known?null:wanted.amount<=offered.amount?1:wanted.amount<=offered.amount*1.1?.6:0;
  return {key:'salary',label:'薪资',present,currencyMismatch,known,ratio,mark:!known?'unknown':ratio===1?'ok':ratio?'partial':'bad',reason:!known?why('期望薪资缺失、无法解析或币种不同，未作汇率换算'):why('期望{wanted}；岗位{offered}',{wanted:worker.desiredSalary,offered:order.salary}),missing:!wanted&&present?['期望薪金']:[]};
 }
 function scoreOther(worker,order){
  const text=[order.requirements,order.notes].join(' '),checks=[];
  for(const [key,label]of [['height','身高'],['weight','体重']]){const m=text.match(new RegExp(label+'\\s*[:：]?\\s*(不低于|至少|不超过|至多)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:cm|CM|厘米|公分|kg|KG|公斤|千克)?\\s*(及以上|以上|以下|以内|内)?'));if(!m)continue;const raw=string(worker[key]),number=raw&&!/斤|英尺|磅/.test(raw)?Number(raw.match(/\d+(?:\.\d+)?/)?.[0]):NaN,known=Number.isFinite(number),maximum=/不超过|至多|以下|以内|内/.test((m[1]||'')+(m[3]||'')),ratio=known?(maximum?number<=+m[2]:number>=+m[2])?1:0:null;checks.push({key,label,present:true,known,ratio,mark:!known?'unknown':ratio?'ok':'bad',reason:why('要求{requirement}；劳工{actual}',{requirement:m[0],actual:raw||'未填写'}),missing:!known?[label]:[]})}
  const education=text.match(/(小学|小學|初中|高中|中专|中專|大专|大專|本科)(?:及?以上|学历|學歷)/);if(education){const level=edu(worker.education),known=level!==null,ratio=known?(level>=edu(education[1])?1:0):null;checks.push({key:'education',label:'学历',present:true,known,ratio,mark:!known?'unknown':ratio?'ok':'bad',reason:why('要求{requirement}；劳工{actual}',{requirement:education[0],actual:worker.education||'未填写'}),missing:known?[]:['学历']})}
  if(/身体健康|身體健康|无慢性病|無慢性病/.test(text)){const raw=string(worker.health),known=!!raw,ratio=known?(/良好|健康/.test(raw)&&!/(?:不健康|不良|欠佳|不佳|患病|患有|有慢性病)/.test(raw)?1:0):null;checks.push({key:'health',label:'健康状况',present:true,known,ratio,mark:!known?'unknown':ratio?'ok':'bad',reason:why('要求健康良好；劳工{actual}',{actual:raw||'未填写'}),missing:known?[]:['健康状况']})}
  return checks;
 }
 function levelForScore(score,same=true){return same&&score>=75?'high':score>=50?'mid':'low'}
 function checkHardConditions(worker,order,options={}){
  const today=options.today||T.todayKey(),hardChecks=[],failures=[],gender=string(order.gender),own=string(worker.gender),age=workerAge(worker,today),range=parseAgeRange(order.age);
  if(gender&&gender!=='男女不限'){if(!own)hardChecks.push(why('劳工性别未填写，需人工核实'));else if(gender!==own)failures.push(why('要求{required}，劳工为{actual}',{required:gender==='男'?'男性':'女性',actual:own==='男'?'男性':'女性'}))}
  if(!range.unlimited){if(range.unknown)hardChecks.push(why('年龄要求无法解析，需人工核实'));else if(age===null)hardChecks.push(why('劳工年龄未填写，需人工核实'));else if(range.min!==null&&age<range.min||range.max!==null&&age>range.max)failures.push(why('要求{required}，劳工{age}岁',{required:order.age,age}))}
  const experience=scoreExperience(worker,order,today),intent=scoreIntent(worker,order);if(!experience.hasRelated)failures.push(why(intent.got===10||intent.got===7||intent.got===5?'意向相符，但没有相关工作经历':'没有相关工作经历'));
  return {hardChecks,failures,experience,intent};
 }
 function scoreConditions(worker,order){
  const profile=profileFor(order,'order'),language=scoreLanguage(worker,order),salary=scoreSalary(worker,order),other=scoreOther(worker,order),certs=certificateConditions(worker,order),items=[...language.conditions,...(salary.present?[salary]:[]),...other,...certs];
  // Validated AI requirements supplement only requirements not already understood by rules.
  for(const c of profile.conditions||[])if(!items.some(x=>x.key===c.key)){const value=worker[c.field],known=string(value)!=='',num=Number(string(value).match(/\d+(?:\.\d+)?/)?.[0]),ratio=!known?null:c.kind==='minimum'?(num>=c.value?1:0):c.kind==='maximum'?(num<=c.value?1:0):c.kind==='certificate'?(string(value).includes(c.value)&&!/(?:没有|无|無)/.test(value)?1:0):c.kind==='education'?(edu(value)>=c.value?1:0):c.kind==='health'?(/健康|良好/.test(value)&&!/(?:不健康|不良|患病)/.test(value)?1:0):null;if(ratio!==null||!known)items.push({key:c.key,label:c.label,known,ratio,mark:!known?'unknown':ratio?'ok':'bad',reason:why('要求{requirement}；劳工{actual}',{requirement:c.evidence,actual:value||'未填写'}),missing:known?[]:[c.label],by:'ai'})}
  const known=items.filter(c=>c.known),score=known.length?100*known.reduce((sum,c)=>sum+c.ratio,0)/known.length:null;
  return {score:score===null?null:round(score),applicable:items.some(c=>!c.currencyMismatch),items,missing:[...new Set(items.flatMap(c=>c.missing||[]))],language};
 }
 function certificateConditions(worker,order){const text=[order.requirements,order.notes].join(' '),terms=[...new Set([...vocab.certificates.filter(c=>text.includes(c)),...[...text.matchAll(/[\u4e00-\u9fff]{1,10}[证證](?:书|書)?/g)].map(m=>m[0].replace(/^(?:需要|要求|必须|必須|须|須|需|持有|持|有|提供|专业|專業)+/g,''))])].filter(term=>term.length>1);return terms.map(term=>{const raw=string(worker.certificates),known=!!raw,ratio=known?(raw.includes(term)&&!/(?:没有|无|無|暂无)/.test(raw)?1:0):null;return {key:'certificate:'+term,label:'专业证书',known,ratio,mark:!known?'unknown':ratio?'ok':'bad',reason:why('要求{requirement}；劳工{actual}',{requirement:term,actual:raw||'未填写'}),missing:known?[]:['专业证书']}})}
 function matchWorkerToOrder(worker,order,options={}){
  const today=options.today||T.todayKey(),{hardChecks,failures,experience,intent}=checkHardConditions(worker,order,{today});
  if(!histories(worker).length)return {orderId:order.id,excluded:true,needsHistory:true,reasons:['请补充工作经历后再匹配'],reasonDetails:[why('请补充工作经历后再匹配')],hardChecks};
  if(failures.length)return {orderId:order.id,excluded:true,reasons:failures.map(r=>r.text),reasonDetails:failures,hardChecks};
  const conditions=scoreConditions(worker,order),score=Math.min(100,Math.round(conditions.applicable?.7*experience.got+.3*(conditions.score??0)+intent.got:experience.got+intent.got)),level=levelForScore(score,experience.relevance==='same');
  const fit=dimension('conditions','岗位条件',conditions.score,100,conditions.score===null?'unknown':conditions.score===100?'ok':conditions.score?'partial':'bad',conditions.items.map(c=>c.reason),{missing:conditions.missing});
  return {orderId:order.id,excluded:false,score,level,E:experience.score,F:conditions.score,experience,conditions,intent:{...intent,bonus:intent.got},dims:[experience,fit,intent],missing:conditions.missing,matchedIntentIndex:intent.matchedIntentIndex,hardChecks,sparse:false,language:conditions.language};
 }
 function matchWorker(worker,orders,options={}){const today=options.today||T.todayKey(),days=options.days||14,start=T.addDays(today,1-days);return orders.filter(o=>(!options.isReady||options.isReady(o))&&T.dateKey(o.createdAt)>=start&&T.dateKey(o.createdAt)<=today).map(o=>({...matchWorkerToOrder(worker,o,{today}),createdAt:o.createdAt})).sort((a,b)=>Number(a.excluded)-Number(b.excluded)||(b.score||0)-(a.score||0)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
 root.ZYMatching={parseAgeRange,workerAge,parsePeriod,parseLanguageRequirement,parseSalary,jobCategory,relevance,scoreIntent,scoreLanguage,scoreExperience,scoreSalary,scoreOther,matchWorkerToOrder,matchWorker,levelForScore,histories,marks,languageLevel,durationFactor,recencyFactor,profileFor,sourceFor,sourceHash,checkHardConditions,scoreConditions,intentBonus:scoreIntent,classifyByRules:jobCategory};if(typeof module!=='undefined'&&module.exports)module.exports=root.ZYMatching;
})(globalThis);
