/* Staged source-order recognition: segment, classify paragraphs, extract, validate. */
(function(root){
 const VERSION='6';
 const escape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const cleanBrackets=s=>String(s??'').replace(/[【】\[\]［］〔〕「」『』]/g,'').trim();
 const stripOrdinal=s=>String(s).replace(/^[\s·•●▪▫◦‣∙➤►★☆🔥💰💵📌✅👉🔹🔸]+/u,'').replace(/^\s*[-–—]\s+(?=\D)/,'').replace(/^\s*(?:[（(]\d+[）)]\s*|\d+(?:[、)）]|[.．](?!\d))\s*|[一二三四五六七八九十]+[、.．)）]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/,'').trim();
 const ignoredPrefixes=new Set(['HK','HKD','USD','RMB','CNY','MOP','CAD','EUR','GBP','AUD','ISO','CET','HACCP']);
 const idPattern=/(^|[^A-Za-z0-9])((?:ZY-\d{2}-\d{4}-\d{2,})|(?:[A-Za-z]+[-_]\d{4,}(?:[-_.]\d+)*)|(?:(?:XR|AT|QY)[-_]?\d{3,}(?:[-_]\d+)*)|(?:[A-Za-z]+\d{6,}))(?=HK(?=[\u3400-\u9fff])|[^A-Za-z0-9]|$)/g;
 function sourceIdentifiers(input){
  const found=[];for(const match of String(input??'').matchAll(idPattern)){
   const prefix=match[2].match(/^[A-Za-z]+/)[0].toUpperCase();if(ignoredPrefixes.has(prefix))continue;
   found.push({value:match[2],prefix:prefix});
  }return found;
 }
 function sourcePrefix(input){return sourceIdentifiers(input).find(item=>!/^ZY-\d{2}-\d{4}-\d{2,}$/.test(item.value))?.prefix||''}
 function sanitizeRaw(input){
  const source=String(input??'').replace(/\r\n?/g,'\n');
  return source.replace(idPattern,(whole,before,id)=>ignoredPrefixes.has(id.match(/^[A-Za-z]+/)[0].toUpperCase())?whole:before)
   .replace(/(?:【|\[)?(?:原单编号|原單編號|公司编号|公司編號|订单编号|訂單編號|职位编号|職位編號|参考编号|參考編號|單號|单号|編號|编号)(?:】|\])?\s*[:：]?\s*[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*(?:\s*[|｜:：]\s*)?/gi,'')
   .replace(/【\s*】|\[\s*\]/g,'').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
 }
 function baseCode(code){return String(code||'').trim().replace(/\s+[A-Za-z]+$/,'')}
 function companyCode(code,prefix=''){const source=String(prefix||'').toUpperCase();return baseCode(code)+(/^[A-Z]+$/.test(source)?' '+source:'')}
 function validCode(code){return /^ZY-\d{2}-\d{4}-\d{2,}(?: [A-Z]+)?$/.test(String(code||''))}
 const aliases={
  title:['职位名称','職位名稱','招聘职位','招聘職位','招聘岗位','招聘崗位','招聘工种','招聘工種','招聘職種','招聘职种','职位','職位','岗位','崗位','工种','工種'],
  employer:['雇主名称','僱主名稱','公司名称','公司名稱','雇主','僱主','公司','单位','單位'],
  salary:['职位薪酬','職位薪酬','职位薪资','職位薪資','岗位薪酬','崗位薪酬','工资薪酬','工資薪酬','工资薪酬待遇','工資薪酬待遇','薪资待遇','薪資待遇','薪金待遇','薪酬待遇','工资待遇','工資待遇','薪资','薪資','工资','工資','薪金','薪酬','月薪','待遇'],
  gender:['性别要求','性別要求','招聘性别','招聘性別','性别','性別'],age:['年龄要求','年齡要求','年龄','年齡'],language:['语言要求','語言要求','语言','語言'],
  hours:['工作时间','工作時間','上班时间','上班時間','时间安排','時間安排','工时','工時'],shift:['班次'],rest:['每月休息','月休','休息'],
  workContent:['工作内容','工作內容','工作职责','工作職責','主要工作','职责','職責'],
  requirements:['工作要求','任职要求','任職要求','基本要求','基本条件','基本條件','要求'],
  notes:['其他备注与费用','其他備註與費用','其他备注','其他備註','备注','備註','食宿安排','食宿','费用','費用'],interview:['面试方式','面試方式','面试时间','面試時間','面试','面試']
 };
 const labels=Object.entries(aliases).flatMap(([key,items])=>items.map(label=>({key,label}))).sort((a,b)=>b.label.length-a.label.length);
 Object.assign(aliases,{location:['工作地点','工作地點','工作地址','地址'],approval:['批文职位','批文職位','批文名称','批文名稱','批文'],contract:['合约期限','合約期限','合同期限'],compensation:['津贴','津貼','补贴','補貼','补助','補助','奖金','獎金','佣金','提成','加班费','加班費','薪水组成','薪水組成']});
 aliases.title.push('岗位名称','崗位名稱','招聘岗位名称','招聘崗位名稱');
 aliases.salary.push('薪资标准','薪資標準','工资标准','工資標準');
 // Sorted after adding all labels. A label can touch a bracket or end at a line break.
 const allLabels=Object.entries(aliases).flatMap(([key,items])=>items.map(label=>({key,label}))).sort((a,b)=>b.label.length-a.label.length);
 function matchLabel(line){
  const text=stripOrdinal(line);
  for(const {key,label}of allLabels){
   const expression=new RegExp('^(?:[【\\[［「『〔]\\s*'+escape(label)+'\\s*[】\\]］」』〕]\\s*[:：]?\\s*|'+escape(label)+'(?:\\s*[:：]\\s*|\\s+|(?=[【\\[［「『〔])))')
   const match=text.match(expression);if(match)return {key,label,value:text.slice(match[0].length).trim()};
   if(text===label)return {key,value:''};
  }return null;
 }
 function recognitionText(input){
  let text=String(input??'').replace(/\r\n?/g,'\n');
  text=text.replace(/[【\[［「『〔]([^】\]］」』〕]{1,25})[】\]］」』〕]/g,(whole,label)=>{
   const compact=label.replace(/\s/g,'');return allLabels.some(item=>item.label===compact)?'\n【'+compact+'】':whole;
  });
  let pendingValue=false;
  return text.split('\n').map(stripOrdinal).filter(line=>{
   if(!line)return true;const tagged=matchLabel(line);
   const keep=pendingValue&&!/[+＋]/.test(line)&&/^\d[\d,.]*$/.test(line);
   pendingValue=!!tagged&&!tagged.value&&['salary','compensation','age','rest','hours'].includes(tagged.key);
   return keep||!sourceQuoteLine(line);
  }).join('\n');
 }
 function sourceQuoteLine(value){
  const text=stripOrdinal(value).trim();
  // Unlabelled monetary expressions are never salary. Units for age, hours,
  // temperature, headcount and weight are deliberately excluded.
  const expression=/^(?:[$￥¥]|HKD?|RMB|CNY)?\s*\d[\d,.]*(?:\s*[kKwW万萬元])?(?:\s*[+＋/／×*]\s*\d[\d,.]*(?:\s*[kKwW万萬元])?)*\s*(?:起|左右|上下)?$/i;
  return expression.test(text)||(!matchLabel(text)&&/\d/.test(text)&&costPattern.test(text)&&!compensationPattern.test(text)&&!/住宿|宿舍|住扣/.test(text));
 }
 const generic=/^(?:招聘(?:职位|職位|岗位|崗位|工种|工種)?|职位(?:名称)?|職位(?:名稱)?|岗位|崗位|工种|工種)$/;
 const editorial=s=>cleanBrackets(sanitizeRaw(s)).replace(/^(?:更新|急单|急單|新增)\s*/,'').trim();
 const jobWords=/(?:师傅|師傅|厨师|廚師|帮厨|幫廚|帮工|幫工|侍应生|侍應生|待应生|服务员|服務員|司机|司機|驾驶员|駕駛員|清洁员|清潔員|保洁|保潔|文员|文員|销售|銷售|技工|电工|電工|美容师|美容師|理发师|理髮師|仓务|倉務|收银员|收銀員|护士|護士|护工|護工|保安|焊工|助理|经理|經理|工程师|工程師|顾问|顧問|食品加工)/;
 function titleValue(value,explicit=false){
  let text=editorial(value).replace(/^(?:招聘(?:职位|職位|岗位|崗位|工种|工種)?|职位名称|職位名稱|职位|職位|岗位|崗位|工种|工種)\s*[:：]?\s*/,'');
  if(/^[（(]?\s*批文/.test(text))return '';
  text=text.replace(/[（(][^）)]*(?:简历|簡歷|视频|視頻|面试|面試|报名|報名|批文)[^）)]*[）)]/g,'');
  text=text.replace(/男女不限[\s\S]*$/,'');
  text=text.split(/(?:\s+(?:男女不限|男性|女性|男士|女士)|\s+[男女](?=[\s\d，,]|$)|[男女](?=\d{2}\s*[岁歲]))|\s*\d{2}\s*(?:[-~～–至]\s*\d{2})?\s*[岁歲]|\s+(?:粤语|粵語|普通话|普通話|英语|英語)/)[0];
  text=text.replace(/\s*[:：，,]?\s*(?:共|需|招聘)?\d+\s*(?:名|人|位)(?:\s.*)?$/,'').replace(/[：:，,；;。\s]+$/,'').trim();
  if(!text||generic.test(text)||text.length>65||/^(?:已视频|已視頻|继续收|繼續收|能出席|需附|有工作|工作餐|更新|面试|面試|要求|有经验|有經驗)/.test(text)||/公司(?:招聘|招工|诚聘|誠聘)?$/.test(text)||/^(?:HKD|港币|港幣|港元|薪|工资|工資|月薪|工作时间|工作時間)/i.test(text))return '';
  return explicit||jobWords.test(text)?text:'';
 }
 function roleHeader(line){
  const tagged=matchLabel(line);if(tagged)return tagged.key==='title'?titleValue(tagged.value,true):'';
  const text=stripOrdinal(line);if(/^[（(]|职责|職責|工作要求|工作内容|工作內容|负责|負責|经验|經驗|需有/.test(text))return '';
  const recruited=text.match(/^(?:急招|招聘|诚聘|誠聘|招工)\s*[:：]?\s*(.+)$/);
  return titleValue(recruited?recruited[1]:text,!!recruited);
 }
 function salaryLine(line){const label=matchLabel(line);return label?.key==='salary'||(!label&&/(?:月薪|工资|工資|薪金|薪资|薪資|薪酬)\s*[:：]?\s*(?:[$￥¥]|HKD|港币|港幣|\d)/i.test(line))}
 function splitOrders(input){
  const explicit=String(input??'').replace(/\r\n?/g,'\n').split(/\n\s*(?:[-_=*]{3,}|下一[单份]|第\s*[\d一二三四五六七八九十]+\s*[单份])\s*(?:\n|$)/).map(s=>s.trim()).filter(Boolean);
  const output=[];
  for(const block of explicit){
   const lines=block.split('\n');let start=0,title='',hasSalary=false;
   for(let i=0;i<lines.length;i++){
    const candidate=roleHeader(lines[i]);
    const future=lines.slice(i+1).some(salaryLine);
    const blank=i>0&&!lines[i-1].trim(),labelled=matchLabel(lines[i])?.key==='title',hasId=sourceIdentifiers(lines[i]).length>0;
    if(candidate&&title&&(candidate!==title||hasId||labelled)&&hasSalary&&(labelled||hasId||(i>0&&sourceIdentifiers(lines[i-1]).length>0)||(blank&&future))){
     let boundary=i;if(i>0&&sourceIdentifiers(lines[i-1]).length&&!roleHeader(lines[i-1]))boundary=i-1;
     const part=lines.slice(start,boundary).join('\n').trim();if(part)output.push(part);start=boundary;title='';hasSalary=false;
    }
    if(candidate&&!title)title=candidate;if(salaryLine(lines[i]))hasSalary=true;
   }
   const part=lines.slice(start).join('\n').trim();if(part)output.push(part);
  }return output;
 }
 const moneyToken='(?:HKD|HK[$]|HK|USD|RMB|CNY|MOP|CAD|EUR|GBP|港币|港幣|港元|人民币|人民幣|澳门币|澳門幣|[$￥¥])?\\s*\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-~～至]\\s*\\d[\\d,]*(?:\\.\\d+)?)?\\s*(?:HKD|USD|RMB|CNY|MOP|港币|港幣|港元|元|[wW万萬])?(?:\\s*[/／](?:月|年|日|天|小时|小時|时|時))?';
 const quotePattern=/全包|包价|包價|打包价|打包價|总价|總價|總費|总费|底价|底價|上家价|上家價|上游价|上游價|成本价|成本價/;
 const costPattern=/租金|住宿(?:扣|费|費)|住(?:宿)?扣|宿舍(?:扣|费|費)|劳务|勞務|办证|辦證|保险|保險|中介|佣介|管理费|管理費|服务费|服務費|报名费|報名費|收费|收費|费用|費用|报价|報價/;
 const deductionPattern=/租金|住宿(?:扣|费|費)|住(?:宿)?扣|宿舍(?:扣|费|費)|餐费|餐費|伙食扣|扣款|扣薪|扣工资|扣工資|扣\s*\d/;
 const upstreamFeePattern=/劳务|勞務|办证|辦證|保险|保險|中介|佣介|管理费|管理費|服务费|服務費|报名费|報名費|收费|收費|费用|費用|报价|報價/;
 const compensationPattern=/津贴|津貼|补贴|補貼|补助|補助|奖金|獎金|佣金|提成|加班费|加班費|底薪|基本工资|基本工資|底\d/;
 function clauses(value){return String(value??'').replace(/(?<=[\d%）)])\s*(?=住宿扣|住扣|宿舍扣|扣款)/g,'；').split(/[\n；;。]|(?<!\d)[，,]|[，,](?!\d)/).map(s=>s.trim()).filter(Boolean)}
 function unique(parts){return [...new Set(parts.filter(Boolean).map(s=>s.trim()).filter(Boolean))]}
 function stripSourcePackage(value,preserveSalary=true){
  const source=String(value??'');if(!quotePattern.test(source))return source;
  return clauses(source).map(part=>{
   const quote=part.match(quotePattern);if(!quote)return part;if(!preserveSalary)return '';
   let before=part.slice(0,quote.index).trim();const after=part.slice(quote.index+quote[0].length).replace(/^[价格價格费用費用\s:：]+/,'');
   if(!/^(?:[$￥¥]|[A-Z]{3}|港币|港幣|港元|\d|[一二三四五六七八九十百千万萬两兩])/i.test(after))before=before.replace(new RegExp(moneyToken+'\\s*$','i'),'');
   return before.replace(/(?:费用|費用|价格|價格|报价|報價)\s*[:：]?\s*$/,'').trim();
  }).filter(Boolean).join('；');
 }
 function cleanCompanyText(value,removeBarePrice=true,allowCompensation=false){
  return unique(clauses(stripSourcePackage(value,false)).map(part=>{
   if(removeBarePrice&&sourceQuoteLine(part))return '';
   part=cleanBrackets(part);if(quotePattern.test(part))return '';
   if(allowCompensation&&deductionPattern.test(part)&&!upstreamFeePattern.test(part))return part;
   if(costPattern.test(part)){
    const marker=part.match(costPattern);const hasHousing=/住宿|宿舍|住扣/.test(marker[0]);let preceding=part.slice(0,marker.index);preceding=preceding.replace(new RegExp(moneyToken+'\\s*$','i'),'').replace(/(?:扣|需付|另收|另加|收取|支付|含|加|实际|實際|大约|大約|约|約)\s*$/,'').trim();const housing=hasHousing&&!/住宿|宿舍/.test(preceding)?(/宿舍/.test(marker[0])?'宿舍':'住宿'):'';part=(preceding+housing).replace(/(?:扣|需付|另收|收取|支付|实际|實際|大约|大約|约|約)\s*$/,'').trim();
   }
   if(!part)return '';
   if(allowCompensation&&compensationPattern.test(part))return part;
   part=part.replace(/(?:HKD|HK[$]|HK|USD|RMB|CNY|MOP|CAD|EUR|GBP|港币|港幣|港元|人民币|人民幣|澳门币|澳門幣|[$￥¥])\s*\d[\d,]*(?:\.\d+)?\s*(?:[wW万萬元]|港元)?(?:\s*[/／](?:月|年|天|日|人|次))?/gi,'')
    .replace(/\d[\d,]*(?:\.\d+)?\s*(?:港元|港币|港幣|元|蚊|块|塊|[万萬wW](?!功率|瓦)|[/／](?:月|年|天|日|人|次))/g,'');
   if(!allowCompensation)part=part.replace(/(?:底薪|底|月薪|工资|工資|薪金|薪资|薪資|薪酬|津贴|津貼|补贴|補貼|补助|補助|奖金|獎金)\s*[:：]?\s*\d[\d,]*(?:\.\d+)?/g,'').replace(/\d[\d,]*(?:\.\d+)?\s*(?:津贴|津貼|补贴|補貼|奖金|獎金)/g,'');
   if(removeBarePrice&&/^\s*(?:DJ\s*[:：]|约|約|大约|大約)?\s*[\d,.\s]+(?:左右|上下|起)?\s*$/i.test(part))return '';
   return part.replace(/[（(]\s*[）)]/g,'').replace(/^[\s:：，,；;]+|[\s:：，,；;]+$/g,'').trim();
  })).join('；');
 }
 function extractPay(value){
  const source=cleanBrackets(stripSourcePackage(cleanField('salary',String(value??'')),true));
  if(!source.trim())return {salary:'',notes:[]};
  const text=source.replace(/^(?:薪资待遇|薪資待遇|工资待遇|工資待遇|工资薪酬|工資薪酬|月薪|薪金|薪酬|底薪|基本工资|基本工資)\s*[:：]?\s*/,'');
  let lead=text.match(new RegExp('^'+moneyToken,'i')),offset=0;
  if(lead&&/^(?:餐|岁|歲|个|個|天)/.test(text.slice(lead[0].length)))lead=null;
  if(!lead){
   const currency='(?:HKD|HK[$]|HK|USD|RMB|CNY|MOP|CAD|EUR|GBP|港币|港幣|港元|人民币|人民幣|[$￥¥])';
   const strict=new RegExp(currency+'\\s*\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[/／](?:月|天|小时|小時))?|\\d[\\d,]*(?:\\.\\d+)?\\s*(?:'+currency+'|[/／](?:月|天|小时|小時))','i');
   for(const part of clauses(text)){if(costPattern.test(part)||quotePattern.test(part))continue;const found=part.match(strict);if(found){offset=text.indexOf(part)+found.index;lead=found;break;}}
  }
  if(!lead||!lead[0].match(/\d/))return {salary:'',notes:[]};
  const main=lead[0].trim()+(text.slice(offset+lead[0].length).startsWith('+')&&!/^\+\d/.test(text.slice(offset+lead[0].length))?'+':''),before=text.slice(0,offset).replace(/(?:工资|工資|月薪|薪金|薪酬|薪资|薪資)\s*[:：]?\s*$/,'');
  let rest=text.slice(offset+lead[0].length).replace(/^[\s+，,；;]+/,'').replace(/^[（(]([\s\S]*)[）)]$/,'$1');
  const notes=clauses([before,rest].filter(Boolean).join('；')).map(part=>cleanCompanyText(part,true,true)).filter(Boolean);
  const earnings=notes.filter(part=>compensationPattern.test(part)&&!deductionPattern.test(part));
  return {salary:unique([main,...earnings]).join('；'),main,notes:notes.filter(part=>!earnings.includes(part))};
 }
 function cleanField(key,value){
  if(typeof value!=='string')return value;
  const fragments=key==='gender'?['性别要求','性別要求','招聘性别','招聘性別','性别','性別','要求']:key==='salary'?['工资薪酬','工資薪酬','薪资待遇','薪資待遇','工资待遇','工資待遇','工资','工資','薪酬','薪金']:[];
  return fragments.length?value.replace(new RegExp('^\\s*[【\\[]?(?:'+fragments.map(escape).join('|')+')[】\\]]\\s*[:：]?\\s*'),''):value;
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
 } function normalizeGender(value,raw=''){
  if(typeof value==='string'&&value.includes('\n')){const choices=unique(value.split('\n').map(part=>genderFromText(cleanField('gender',part))));return choices.length===1?choices[0]:'';}
  const direct=genderFromText(cleanField('gender',value));if(direct)return direct;
  const lines=String(raw||'').split(/\r?\n/).map(stripOrdinal).filter(Boolean);let requirement=false;const candidates=[];
  const explicit=[];for(let i=0;i<lines.length;i++){const label=matchLabel(lines[i]);if(label?.key==='gender')explicit.push(genderFromText(label.value||(!matchLabel(lines[i+1]||'')?lines[i+1]:'')))}
  if(explicit.length){const values=unique(explicit);return explicit.some(v=>!v)||values.length!==1?'':values[0];}
  for(let i=0;i<lines.length;i++){
   const label=matchLabel(lines[i]);
   if(label?.key==='gender')return genderFromText(label.value||(!matchLabel(lines[i+1]||'')?lines[i+1]:''));
   if(label){requirement=label.key==='requirements';if(requirement&&label.value)candidates.push(label.value);else if(label.key==='title'){
    const hint=cleanBrackets(label.value).match(/(?:男女不限|(?:男性|女性|男士|女士)(?=[\s，,；;（(\d]|$)|\s[男女](?=\s|\d)|[男女](?=\d{2}岁))/);if(hint)candidates.push(hint[0]);
   }continue;}
   if(/^(?:(?:男性|女性|男士|女士|男工|女工|男|女)(?=[\s，,；;（(\d]|$)|性别|性別|只招|限招|男女不限|不限性别|不招)/.test(lines[i]))candidates.push(lines[i]);
   else if(roleHeader(lines[i])||/男女(?:不限|均可|皆可)|只招|仅限|僅限|不限性别|性别不限/.test(lines[i])){
    const hint=lines[i].match(/男女不限|男[\/／、]女均可|(?:男性|女性)(?=[\s，,；;（(\d]|$)|男(?=\s|\d|[，,]|$)|女(?=\s|\d|[，,]|$)|性别不限|不限性别/);if(hint)candidates.push(hint[0]);
   }
  }
  const resolved=unique(candidates.map(genderFromText));return resolved.length===1?resolved[0]:'';
 }
 function parseOne(input,code=''){
  const o={raw:sanitizeRaw(input),code:companyCode(code,sourcePrefix(input)),sourcePrefix:sourcePrefix(input),parserVersion:VERSION};
  const lines=recognitionText(o.raw).split('\n').map(s=>s.trim()).filter(Boolean),buckets={},titles=[],genderContext=[];
  const push=(key,value)=>{if(value)(buckets[key]??=[]).push(value)};let section='',componentLabel='';
  for(let i=0;i<lines.length;i++){
   const original=lines[i],line=stripOrdinal(original);if(/^#|^DJ\s*[:：]\s*\d/i.test(line)||(/^\d[\d,.\s]*$/.test(line)&&!['salary','compensation','age','rest','hours'].includes(section)))continue;
   const compact=line.match(/^(?:HK)?(?:工厂|工廠)?(食品加工)(HK(?:D)?\s*\d[\d,.]*\+?)$/i);
   if(compact){titles.push({value:compact[1],rank:0});push('salary',compact[2]);section='';continue;}
   if(/^(?:男性|女性|男|女)(?=[，,\s])/.test(line)){push('requirements',line);continue;}
   if(/^(?:主要做|能接受)/.test(line)){push('workContent',line);continue;}
   if(deductionPattern.test(line)&&!matchLabel(line)&&!upstreamFeePattern.test(line)){push('notes',line);continue;}
   const tagged=matchLabel(line);
   if(tagged){
    section=tagged.key;
    if(section==='title'){
     const title=titleValue(tagged.value,true);if(title)titles.push({value:title,rank:0});
     const preparation=tagged.value.match(/[（(]([^）)]*(?:视频|視頻|简历|簡歷|面试|面試)[^）)]*)[）)]/);if(preparation)push('interview',preparation[1]);
     genderContext.push(tagged.value);
    }else if(section==='compensation'){componentLabel=tagged.label;if(tagged.value)push('notes',tagged.label+'：'+tagged.value)}else push(section,tagged.value);
    continue;
   }
   const companyHeader=editorial(line);if(/公司(?:招聘|招工|诚聘|誠聘)\s*[:：]?$/.test(companyHeader)){push('employer',companyHeader.replace(/(?:招聘|招工|诚聘|誠聘)\s*[:：]?$/,''));section='';continue;}
   if(/^[【\[][^】\]]+[】\]]/.test(line)&&!roleHeader(line)){section='';continue;}
   if(quotePattern.test(line)||/^(?:总价|總價|费用|費用|报价|報價|DJ)/i.test(line)){section='';continue;}
   if(/面[试試]|试工|試工|(?:需附|附|提供).*(?:视频|視頻)/.test(line)){push('interview',line);if(!/要求|职责|職責/.test(line))continue;}
   if(/^[（(]?批文/.test(line)){push('notes',line);continue;}
   const role=roleHeader(line);
   if(role&&(!section||section==='title')){titles.push({value:role,rank:1});genderContext.push(line);section='';continue;}
   if(section==='compensation'){push('notes',componentLabel+'：'+line);continue;}
   if(section==='title'&&!titles.length){const title=titleValue(line,true);if(title){titles.push({value:title,rank:0});genderContext.push(line);section='';continue;}}
   if(/奖金|獎金|劳工假|勞工假|年假|福利|津贴|津貼|补贴|補貼|佣金|加班费|加班費/.test(line)&&!['requirements','workContent'].includes(section)){push(section==='hours'?'hours':'notes',line);continue;}
   if(section==='salary'&&/食宿|包吃|包食|工作餐|住宿|宿舍/.test(line)){push('notes',line);continue;}
   if(['requirements','workContent','notes','hours','interview'].includes(section)){push(section,line);continue;}
   if(salaryLine(line)||/^(?:HKD|HK[$]|HK|港币|港幣|港元|[$￥¥])\s*\d/i.test(line)){push('salary',line);continue;}
   const employer=editorial(line);if(/公司(?:招聘|招工|诚聘|誠聘)\s*[:：]?$/.test(employer))push('employer',employer.replace(/(?:招聘|招工|诚聘|誠聘)\s*[:：]?$/,''));
  }
  const joined=key=>unique(buckets[key]||[]).join('\n');
  o.title=titles.sort((a,b)=>a.rank-b.rank)[0]?.value||'';o.employer=joined('employer');if(!o.employer){const candidate=lines.map(editorial).find(line=>line.length<50&&!matchLabel(line)&&!roleHeader(line)&&!/[：:]|经验|經驗|要求|工作|薪|住宿|食宿/.test(line)&&/公司|餐厅|餐廳|酒店|美容院|美容中心|发廊|髮廊|工厂|工廠|档口|檔口/.test(line));if(candidate)o.employer=candidate.replace(/(?:招聘|招工|诚聘|誠聘)\s*[:：]?$/,'').trim();}
  const pay=extractPay((buckets.salary||[])[0]||'');o.salary=pay.salary;
  o.gender=normalizeGender(joined('gender'),recognitionText(input));
  const context=[joined('age'),joined('requirements'),...genderContext].filter(Boolean).join('\n');
  o.age=joined('age')||context.match(/(?:\d{2}\s*[-–~～至]\s*\d{2}\s*[岁歲]?(?:左右)?|\d{2}\s*[岁歲](?:以下|以内|以內|以上|内|內)?)/)?.[0]||'';
  o.language=joined('language')||unique(input.match(/粤语|粵語|普通话|普通話|英语|英語|英文|日语|日語|韩语|韓語|客家话|客家話|潮汕话|潮汕話/g)||[]).join('、');
  const scheduling=joined('hours');
  const hours=scheduling||input.match(/(?:每天|每日)?\s*\d+(?:\.\d+)?\s*(?:小时|小時|[hH](?![A-Za-z]))/)?.[0]||'';
  const noteParts=[...pay.notes,...(buckets.notes||[])];
  const restMatch=input.match(/上\s*\d+\s*休\s*\d+|(?:月休|每月休息|休息)\s*\d+\s*天|每[周週]休\s*\d+\s*天|(?:^|[，,\s])休\s*\d+(?!\d)/m)?.[0]||'';
  o.hours=clauses(hours).map(part=>{
   if(restMatch)part=part.replace(restMatch,'');
   const benefits=part.search(/(?:满|滿).*(?:月|年)|有(?:奖金|獎金)|劳工假|勞工假/);
   if(benefits>=0){noteParts.push(part.slice(benefits));part=part.slice(0,benefits);}
   return part.replace(/^[\s，,]+|[\s，,]+$/g,'');
  }).filter(Boolean).join('，');
  o.shift=joined('shift')||input.match(/通宵更?|夜班|早班|轮班|輪班|晚班/)?.[0]||'';
  o.rest=joined('rest')||restMatch;
  o.workContent=joined('workContent');o.requirements=clauses(joined('requirements')).filter(part=>{if(compensationPattern.test(part)){noteParts.push(part);return false;}return true;}).join('；');o.interview=joined('interview');
  if(joined('approval'))noteParts.push('批文：'+joined('approval'));if(joined('location'))noteParts.push('工作地点：'+joined('location'));if(joined('contract'))noteParts.push('合约期限：'+joined('contract'));
  o.notes=unique(noteParts).join('；');
  const result=sanitizeCompany(o);
  result.parsedSnapshot=JSON.stringify(Object.fromEntries(['code','title','employer','salary','gender','age','language','hours','shift','rest','workContent','requirements','interview','notes'].map(key=>[key,result[key]||''])));
  return result;
 }
 function analyze(input,code=''){
  const parts=splitOrders(input),warnings=[];
  if(parts.length>1)return {parts,order:null,warnings:['检测到多份原单，请使用批量录入或拆分后处理']};
  const order=parseOne(parts[0]||'',code);
  const payValues=unique(String(input||'').split(/\r?\n/).map(matchLabel).filter(tag=>tag?.key==='salary').map(tag=>extractPay(tag.value).main||extractPay(tag.value).salary));
  if(payValues.length>1){order.salary='';warnings.push('识别到多组薪资，请人工核对或拆分原单');}
  if(!order.title)warnings.push('未可靠识别职位，请人工核对');if(!order.gender)warnings.push('性别不明确或有冲突，请人工选择');if(!order.salary)warnings.push('未可靠识别主薪资，请人工核对');
  const review=reviewOrder(input,order);
  warnings.push(...review.warnings);
  return {parts,order,warnings:unique(warnings),sources:review.sources,unclassified:review.unclassified};
 }
 function reviewOrder(input,order){
  const warnings=[],sources={},lines=recognitionText(sanitizeRaw(input)).split('\n').filter(Boolean);
  const fields=['title','employer','salary','gender','age','language','hours','shift','rest','workContent','requirements','interview','notes'];
  const unknown=[];
  for(const line of lines){
   const tag=matchLabel(line);let matched=false;
   for(const key of fields){
    const value=String(order[key]||'');
    const fragments=clauses(value).filter(v=>v.length>1);
    const relevant=tag?.key===key||(key==='salary'&&tag?.key==='compensation')||fragments.some(v=>line.includes(v))||(key==='gender'&&normalizeGender('',line)===value&&!!value)||(key==='salary'&&compensationPattern.test(line)&&!upstreamFeePattern.test(line));
    if(relevant){(sources[key]??=[]).push(line);matched=true;}
   }
   if(!matched&&!tag&&!/^(?:新单|新單|更新|高龄看过来|高齡看過來)/.test(line)&&!quotePattern.test(line)&&!sourceQuoteLine(line)&&!upstreamFeePattern.test(line)&&!/^#|^DJ/i.test(line))unknown.push(line);
  }
  for(const key of Object.keys(sources))sources[key]=unique(sources[key]);
  if(!order.age)warnings.push('未识别年龄要求，请核对原单');
  if(!order.hours)warnings.push('未识别工作时间，请核对原单');
  if(/^休\s*\d+$/.test(String(order.rest||'').trim()))warnings.push('休息周期不明确，请确认是每周还是每月');
  if(unknown.length)warnings.push('部分原单内容尚未分类，请核对未分类内容');
  return {warnings,sources,unclassified:unique(unknown)};
 }
 function parse(input,code=''){const result=analyze(input,code);return result.order||{raw:sanitizeRaw(input),code,needsSplit:true,title:'',gender:'',salary:''}}
 function sanitizeCompany(order){
  const result={...order};
  const deductions=[];
  for(const key of ['requirements','workContent','hours','interview'])if(typeof result[key]==='string')result[key]=clauses(result[key]).filter(part=>{if(deductionPattern.test(part)&&!upstreamFeePattern.test(part)&&!quotePattern.test(part)){deductions.push(part);return false;}return true;}).join('；');
  if(deductions.length)result.notes=unique([result.notes,...deductions]).join('；');
  for(const key of ['title','employer','gender','age','language','hours','shift','rest','workContent','requirements','interview'])if(typeof result[key]==='string')result[key]=cleanBrackets(cleanCompanyText(result[key],!['age','hours','rest'].includes(key)));
  const pay=extractPay(result.salary);
  const notes=clauses(cleanCompanyText(result.notes,true,true));
  for(let i=1;i<notes.length;i++)if(compensationPattern.test(notes[i])&&/(?:满|滿).*(?:月|年)|(?:入职|入職).*(?:后|後)|达到|達到/.test(notes[i-1])&&!costPattern.test(notes[i-1])){notes.splice(i-1,2,notes[i-1]+'，'+notes[i]);i--;}

  const earnings=pay.salary?notes.filter(part=>compensationPattern.test(part)&&!deductionPattern.test(part)&&!upstreamFeePattern.test(part)&&!quotePattern.test(part)):[];
  if(typeof result.salary==='string')result.salary=unique([pay.salary,...earnings]).join('；');
  result.notes=unique([...notes.filter(part=>!earnings.includes(part)),...pay.notes]).join('；');
  result.notes=cleanBrackets(result.notes);if(typeof result.code==='string')result.code=cleanBrackets(result.code);if(typeof result.price==='string')result.price=cleanBrackets(result.price);if(result.sourcePrefix)result.code=companyCode(result.code,result.sourcePrefix);
  return result;
 }
 function validateCompany(order,forPublication=false){
  const errors=[];if(forPublication&&!order.salary)errors.push('未可靠识别主薪资，请人工核对');if(splitOrders(order.raw||'').length>1)errors.push('检测到多份原单，请使用批量录入或拆分后处理');
  if(!order.title||generic.test(order.title)||/^[（(]?批文/.test(order.title))errors.push('未可靠识别职位，请人工核对');
  if(!['男','女','男女不限'].includes(order.gender))errors.push('请选择招聘性别：男、女或男女不限');
  if(!validCode(order.code))errors.push('公司单号格式应为 ZY-年份-月日-流水，可附上家字母');
  for(const key of ['title','employer','salary','gender','age','language','hours','shift','rest','workContent','requirements','notes','interview']){
   const value=String(order[key]||'');if(/[【】\[\]［］〔〕「」『』]/.test(value))errors.push('公司单不能含原单字段括号');
   if(sourceIdentifiers(value).length)errors.push('公司单不能含完整上家编号，只保留单号后的上家字母');
   if(quotePattern.test(value)||clauses(value).some(part=>upstreamFeePattern.test(part)||(costPattern.test(part)&&!(key==='notes'&&deductionPattern.test(part)))))errors.push('公司单仍有原单报价或费用信息，请核对');
  }return unique(errors);
 }
 function repairLegacyOrders(records){
  // Only fix known v1 label debris / malformed codes automatically. Structural reparse is preview-only.
  const repaired=records.map(order=>({...order,gender:normalizeGender(order.gender,order.raw),salary:cleanField('salary',order.salary)}));
  const used=new Set(records.map(o=>baseCode(o.code)));
  for(const order of repaired){const m=String(order.code||'').match(/^V-(\d{1,2})\.(\d{1,2})-(\d+)$/i);if(!m)continue;
   const date=new Date(order.createdAt);if(isNaN(date))continue;const month=+m[1],day=+m[2],year=date.getFullYear(),check=new Date(year,month-1,day);if(check.getMonth()!==month-1||check.getDate()!==day)continue;
   const prefix=`ZY-${String(year).slice(-2)}-${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}-`;let candidate=prefix+String(+m[3]).padStart(2,'0');
   if(used.has(candidate))candidate=prefix+String(Math.max(0,...[...used].filter(c=>c.startsWith(prefix)).map(c=>Number(c.slice(prefix.length))||0))+1).padStart(2,'0');
   used.add(candidate);order.code=companyCode(candidate,order.sourcePrefix);
  }return repaired;
 }
 function present(order){
  const view={...order};if(typeof view.raw==='string')view.raw=sanitizeRaw(view.raw);
  view.gender=normalizeGender(view.gender,view.raw);view.salary=cleanField('salary',view.salary);
  view.employer=editorial(view.employer||'').replace(/(?:招聘|招工|诚聘|誠聘)\s*[:：]?\s*$/,'');
  return sanitizeCompany(view);
 }
 root.ZYOrderParser={reviewOrder,parse,analyze,splitOrders,sourcePrefix,sourceIdentifiers,sanitizeRaw,sourceCode:companyCode,companyCode,baseCode,validCode,titleValue,normalizeGender,cleanField,extractPay,stripSourcePackage,cleanCompanyText,sanitizeCompany,repairLegacyOrders,present,validateCompany};
})(globalThis);
