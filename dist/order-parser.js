/* Shared, DOM-free parser used by single entry, batches and legacy display. */
(function(root){
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function sanitizeRaw(value){
  return String(value??'').replace(/\r\n?/g,'\n').split('\n').map(line=>{
   // Remove labelled source IDs, including bare numeric IDs, while keeping any title after them.
   line=line.replace(/(?:【|\[)?(?:原单编号|原單編號|公司编号|公司編號|订单编号|訂單編號|职位编号|職位編號|参考编号|參考編號|單號|单号|編號|编号)(?:】|\])?\s*[:：]?\s*[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*(?:\s*[|｜:：]\s*)?/gi,'');
   // Known upstream order prefixes. Currency amounts and ordinary numbers are not IDs.
   line=line.replace(/(^|[^A-Za-z0-9])(?:ZY-\d{2}-\d{4}-\d{2,}|(?:XR|AT)[-_]?\d{3,}(?:[-_]\d+)*)(?![A-Za-z0-9])/gi,'$1');
   return line.replace(/(?:【\s*】|\[\s*\])/g,'').replace(/[ \t]+$/,'');
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 }
 const aliases={
  title:['职位名称','職位名稱','招聘职位','招聘職位','招聘岗位','招聘崗位','招聘工种','招聘工種','招聘職種','招聘职种','职位','職位','岗位','崗位','工种','工種'],
  employer:['雇主名称','僱主名稱','公司名称','公司名稱','雇主','僱主','公司','单位','單位'],
  salary:['工资薪酬','工資薪酬','工资薪酬待遇','工資薪酬待遇','薪资待遇','薪資待遇','薪金待遇','薪酬待遇','工资待遇','工資待遇','薪资','薪資','工资','工資','薪金','薪酬','月薪','待遇'],
  gender:['性别要求','性別要求','招聘性别','招聘性別','性别','性別'],age:['年龄要求','年齡要求','年龄','年齡'],language:['语言要求','語言要求','语言','語言'],
  hours:['工作时间','工作時間','上班时间','上班時間','时间安排','時間安排','工时','工時'],shift:['班次'],rest:['每月休息','月休','休息'],
  workContent:['工作内容','工作內容','工作职责','工作職責','主要工作','职责','職責'],
  requirements:['工作要求','任职要求','任職要求','基本要求','基本条件','基本條件','要求'],
  notes:['其他备注与费用','其他備註與費用','其他备注','其他備註','备注','備註','食宿安排','食宿','费用','費用'],interview:['面试方式','面試方式','面试时间','面試時間','面试','面試']
 };
 const labels=Object.entries(aliases).flatMap(([key,items])=>items.map(label=>({key,label}))).sort((a,b)=>b.label.length-a.label.length);
 const generic=/^(?:招聘(?:职位|職位|岗位|崗位|工种|工種)?|职位(?:名称)?|職位(?:名稱)?|岗位|崗位|工种|工種)$/;
 const editorial=s=>s.replace(/^\s*(?:【(?:更新|急单|急單|新增)|\[(?:更新|急单|急單|新增)\])\s*/,'').replace(/^】\s*/,'').trim();
 function titleValue(value){
  let text=editorial(sanitizeRaw(value)).replace(/^(?:招聘(?:职位|職位|岗位|崗位|工种|工種)?|职位名称|職位名稱|职位|職位|岗位|崗位|工种|工種)\s*[:：]\s*/,'').trim();
  text=text.replace(/\s*[:：，,]?\s*(?:共|需|招聘)?\s*\d+\s*(?:名|人|位)(?:\s.*)?$/,'').replace(/[：:，,；;。\s]+$/,'').trim();
  if(!text||generic.test(text)||/^(?:已视频|已視頻|继续收|繼續收|更新|面试|面試)/.test(text)||/公司(?:招聘|招工|诚聘|誠聘)?$/.test(text)||/^(?:HKD|港币|港幣|港元|薪|工资|工資|月薪|工作时间|工作時間)/i.test(text))return '';
  return text;
 }
 function matchLabel(line){
  const text=line.replace(/^\s*(?:(?:\(?\d+\)?|[一二三四五六七八九十]+)[、.．)）]|[①②③④⑤⑥⑦⑧⑨⑩])\s*/,'');
  for(const {key,label}of labels){
   const re=new RegExp('^(?:[【\\[]'+escape(label)+'[】\\]]\\s*[:：]?\\s*|'+escape(label)+'(?:\\s*[:：]\\s*|\\s+))([\\s\\S]*)$');
   const found=text.match(re);if(found)return {key,value:found[1].trim()};
   if(text===label||text==='【'+label+'】'||text==='['+label+']')return {key,value:''};
  }
  return null;
 }
 function parse(input,companyCode=''){
  const raw=sanitizeRaw(input),o={raw,code:companyCode};
  const lines=raw.split('\n').map(s=>s.trim()).filter(s=>s&&!/^#/.test(s)&&!/^DJ\s*[:：]\s*\d/i.test(s)&&!/^\s*[\d,.\s$港币幣元w万萬]+\s*$/.test(s));
  const clean=lines.join('\n');let current=null,pending=null;
  for(const line of lines){
   const tagged=matchLabel(line);
   if(tagged){current=tagged.key;pending=tagged.value?'':tagged.key;if(tagged.value){const v=tagged.key==='title'?titleValue(tagged.value):tagged.value;if(v)o[tagged.key]=o[tagged.key]?o[tagged.key]+'\n'+v:v}continue;}
   if(/^[【\[][^】\]]+[】\]]/.test(line)){current=null;pending=null;continue;}
   if(pending){const v=pending==='title'?titleValue(line):line;if(v)o[pending]=v;pending=null;continue;}
   if(['requirements','workContent','notes'].includes(current)&&!/[：:]/.test(line)&&!/(?:工作地点|工作地點|公司招聘|公司招工)/.test(line))o[current]+='\n'+line;
   else current=null;
  }
  if(!o.title){
   for(const line of lines){
    if(matchLabel(line)||/公司(?:招聘|招工|诚聘|誠聘)\s*[:：]?$/.test(line))continue;
    const found=line.match(/(?:急招|招聘|诚聘|誠聘|招工)\s*[:：]?\s*(.+)/);if(found){const title=titleValue(found[1]);if(title){o.title=title;break;}}
   }
  }
  if(!o.title)o.title=lines.map(editorial).filter(line=>line.length<40&&!matchLabel(line)&&!/[：:]|已视频|已視頻|继续收|繼續收|简历|簡歷|面试|面試|薪|工资|工資|HKD|港币|港幣|公司|要求|小时|小時|费用|費用|^DJ\b/i.test(line)).map(titleValue).find(Boolean)||'';
  if(!o.employer){
   const header=lines.map(editorial).find(s=>s.length<60&&!matchLabel(s)&&/发廊|髮廊|餐厅|餐廳|工厂|工廠|公司|档口|檔口|酒店|美容院/.test(s));
   if(header)o.employer=header.replace(/(?:招聘|招工|诚聘|誠聘)\s*[:：]?\s*$/,'').trim();
  }
  if(!o.salary)o.salary=clean.match(/(?:HKD|港币|港幣|港元|\$)\s*[\d,]+(?:\.\d+)?(?:[–~至-]\s*[\d,]+)?(?:\s*[（(][^）)\n]*[）)])?/i)?.[0]||'';
  o.gender=normalizeGender(o.gender,raw);
  if(!o.age)o.age=clean.match(/\d{2}\s*[-–~～至]\s*\d{2}\s*[岁歲]?(?:左右)?|\d{2}[岁歲]以下/)?.[0]||'';
  if(!o.language)o.language=[...new Set(clean.match(/粤语|粵語|普通话|普通話|英语|英語|日语|日語|韩语|韓語|客家话|客家話|潮汕话|潮汕話/g)||[])].join('、');
  if(!o.hours)o.hours=clean.match(/(?:每天|每日)?\s*\d+(?:\.\d+)?\s*(?:小时|小時)/)?.[0]||'';
  if(!o.shift)o.shift=clean.match(/通宵更?|夜班|早班|轮班|輪班|晚班/)?.[0]||'';
  if(!o.rest)o.rest=clean.match(/(?:月休|休息)\s*\d+\s*天/)?.[0]||'';
  if(!o.interview)o.interview=clean.match(/(?:视频|視頻|线上|線上|现场|現場|电话|電話)面[试試]/)?.[0]||'';
  if(!o.notes)o.notes=lines.filter(s=>/住宿|劳务费|勞務費|保险费|保險費|服务费|服務費|管理费|管理費|办证费|辦證費|假期/.test(s)).join('\n');
  return o;
 }
 function genderFromText(value){
  const text=String(value??'').replace(/\s+/g,'').replace(/性別/g,'性别');
  if(!text)return '';
  const noMale=/(?:不要|不招|不收|不接受|不招聘|谢绝|謝絕|不考虑|不考慮)(?:男性|男士|男工|男)|(?:男性|男士|男工|男)(?:不要|勿扰|勿擾|不考虑|不考慮)/.test(text);
  const noFemale=/(?:不要|不招|不收|不接受|不招聘|谢绝|謝絕|不考虑|不考慮)(?:女性|女士|女工|女)|(?:女性|女士|女工|女)(?:不要|勿扰|勿擾|不考虑|不考慮)/.test(text);
  const male=text.includes('男'),female=text.includes('女');
  if(noMale&&noFemale)return '';
  if(noMale)return '女';if(noFemale)return '男';
  const both=/(?:男女|女男)(?:不限|均可|皆可|都可|都行|均招|兼收|都可以|[，,；;。()（）]|$)|男[、，,/／|或和及]+女(?=均|皆|都|不限|可|[，,；;。()（）]|$)|女[、，,/／|或和及]+男(?=均|皆|都|不限|可|[，,；;。()（）]|$)|女(?:性)?也可|男(?:性)?也可/.test(text);
  if(both||/性别(?:不限|不拘)|不限性别|不拘性别|無性别要求|无性别要求/.test(text)||/^(?:不限|不限制|均可|皆可)(?:[，,（(]|$)/.test(text))return '男女不限';
  if(male&&female){if(/^(?:男|男性|男士|男工)(?=[，,；;。()（）]|$)/.test(text))return '男';if(/^(?:女|女性|女士|女工)(?=[，,；;。()（）]|$)/.test(text))return '女';return ''}
  if(male)return '男';if(female)return '女';return '';
 }
 function normalizeGender(value,raw=''){
  const direct=genderFromText(cleanField('gender',value));if(direct)return direct;
  const lines=String(raw||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   const label=matchLabel(lines[i]);if(label?.key==='gender'){
    const resolved=genderFromText(label.value||(!matchLabel(lines[i+1]||'')?lines[i+1]:''));
    // Explicit but unclear gender takes precedence over unrelated prose.
    return resolved;
   }
  }
  const candidates=lines.filter(line=>{
   const label=matchLabel(line);
   if(label)return label.key==='requirements';
   return /男女(?:不限|均可|皆可)|(?:急招|招聘|只招|限招|仅限|僅限|性别|性別)/.test(line);
  });
  for(const text of candidates){const result=genderFromText(text);if(result)return result}
  return '';
 }
 function cleanField(key,value){
  if(typeof value!=='string')return value;
  const remnants=key==='gender'?['性别要求','性別要求','招聘性别','招聘性別','性别','性別','要求']:key==='salary'?['工资薪酬','工資薪酬','薪资待遇','薪資待遇','工资待遇','工資待遇','工资','工資','薪酬','薪金']:[];
  if(!remnants.length)return value;
  // Repair only a recognisable label fragment with its closing bracket, not business text.
  return value.replace(new RegExp('^\\s*[【\\[]?(?:'+remnants.map(escape).join('|')+')[】\\]]\\s*[:：]?\\s*'),'');
 }
 function repairLegacyOrders(records){
  const repaired=records.map(order=>({...order,gender:normalizeGender(order.gender,order.raw),salary:cleanField('salary',order.salary)}));
  const taken=new Set(records.map(o=>o.code));
  for(const order of repaired){
   const match=String(order.code||'').match(/^V-(\d{1,2})\.(\d{1,2})-(\d+)$/i);if(!match)continue;
   const created=new Date(order.createdAt);if(isNaN(created))continue;
   const month=Number(match[1]),day=Number(match[2]),year=created.getFullYear(),date=new Date(year,month-1,day);
   if(date.getMonth()!==month-1||date.getDate()!==day)continue;
   const prefix=`ZY-${String(year).slice(-2)}-${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}-`;
   let candidate=prefix+String(Number(match[3])).padStart(2,'0');
   if(taken.has(candidate)){const maximum=Math.max(0,...[...taken].filter(c=>typeof c==='string'&&c.startsWith(prefix)&&/^\d+$/.test(c.slice(prefix.length))).map(c=>Number(c.slice(prefix.length))));candidate=prefix+String(maximum+1).padStart(2,'0');}
   taken.add(candidate);order.code=candidate;
  }
  return repaired;
 }
 function present(order){
  const result={...order};for(const field of ['raw','title','employer','notes','requirements','workContent'])if(typeof result[field]==='string')result[field]=sanitizeRaw(result[field]);
  if(!result.title||generic.test(result.title.trim())){const corrected=parse(order.raw||'');if(corrected.title)result.title=corrected.title;}
  result.gender=normalizeGender(result.gender,result.raw);result.salary=cleanField('salary',result.salary);
  if(result.employer)result.employer=editorial(result.employer).replace(/(?:招聘|招工|诚聘|誠聘)\s*[:：]?\s*$/,'').trim();
  return result;
 }
 root.ZYOrderParser={parse,sanitizeRaw,present,titleValue,cleanField,repairLegacyOrders,normalizeGender};
})(globalThis);
