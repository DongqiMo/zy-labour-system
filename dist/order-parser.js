/* Staged source-order recognition: segment, classify paragraphs, extract, validate. */
(function(root){
 const VERSION='15';
 const recognitionText=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g,' ');
 const stripDecoration=s=>String(s??'').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F]/gu,'').replace(/\[(?:红包|紅包|烟花|煙花|玫瑰|庆祝|慶祝|强|強)\]/g,'');
 const escape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const cleanBrackets=s=>recognitionText(stripDecoration(s)).replace(/[【】\[\]［］〔〕「」『』]/g,'').trim();
 const stripOrdinal=s=>recognitionText(stripDecoration(s)).replace(/^[\s·•●▪▫◦‣∙➤►★☆🔥💰💵📌✅👉🔹🔸]+/u,'').replace(/^\s*[-–—]\s+(?!\d+(?:\.\d+)?\s*(?:度|℃|°C))/,'').replace(/^\s*(?:[（(]\d+[）)]\s*|\d+(?:[、)）]|[.．](?!\d))\s*|[一二三四五六七八九十]+[、.．)）]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/,'').trim();
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
  hours:['工作时间','工作時間','上班时间','上班時間','时间安排','時間安排','工时','工時'],shift:['班次','排班','更次'],rest:['每月休息','月休','休息'],
  workContent:['工作内容','工作內容','工作职责','工作職責','主要工作','职责','職責'],
  requirements:['工作要求','任职要求','任職要求','基本要求','基本条件','基本條件','要求'],
  notes:['其他备注与费用','其他備註與費用','其他备注','其他備註','备注','備註','食宿安排','食宿','费用','費用'],interview:['面试方式','面試方式','面试时间','面試時間','面试','面試']
 };
 Object.assign(aliases,{location:['工作地点','工作地點','工作地址','地址'],approval:['批文职位','批文職位','批文名称','批文名稱','批文'],contract:['合约期限','合約期限','合同期限'],compensation:['津贴','津貼','补贴','補貼','补助','補助','奖金','獎金','佣金','提成','加班费','加班費','薪水组成','薪水組成']});
 aliases.title.push('工作岗位','工作崗位','岗位名称','崗位名稱','招聘岗位名称','招聘崗位名稱');
 aliases.requirements.push('岗位要求','崗位要求','必须具备','必須具備');aliases.notes.push('食宿情况','食宿情況','吃住情况','吃住情況','吃住');aliases.contract.push('合同期数','合同期數');aliases.location.push('地区','地區');
 aliases.salary.push('薪资标准','薪資標準','工资标准','工資標準');
 // Sorted after adding all labels. A label can touch a bracket or end at a line break.
 const allLabels=Object.entries(aliases).flatMap(([key,items])=>items.map(label=>({key,label}))).sort((a,b)=>b.label.length-a.label.length);
 function matchLabel(line){
  const text=stripOrdinal(line).replace(/([【\[［「『〔])([^】\]］」』〕]+)([】\]］」』〕])/g,(_,a,b,c)=>a+b.replace(/\s/g,'')+c);
  for(const {key,label}of allLabels){
   const expression=new RegExp('^(?:[【\\[［「『〔]\\s*'+escape(label)+'\\s*[】\\]］」』〕]\\s*[:：]?\\s*|'+escape(label)+'(?:\\s*[:：]\\s*|\\s+|(?=[【\\[［「『〔])))')
   const orphan=text.match(new RegExp('^'+escape(label)+'[】\\]]\\s*[:：]?\\s*'));if(orphan)return {key,label,value:text.slice(orphan[0].length).trim()};
   const match=text.match(expression);if(match)return {key,label,value:text.slice(match[0].length).trim()};
   if(text===label)return {key,value:''};
  }return null;
 }
 function sourceQuoteLine(value){
  const text=stripOrdinal(value).trim();
  // Unlabelled monetary expressions are never salary. Units for age, hours,
  // temperature, headcount and weight are deliberately excluded.
  const expression=/^(?:[$￥¥]|HKD?|RMB|CNY)?\s*\d[\d,.]*(?:\s*[kKwW万萬元])?(?:\s*[+＋/／×*]\s*\d[\d,.]*(?:\s*[kKwW万萬元])?)*\s*(?:起|左右|上下)?$/i;
  return expression.test(text)||(!matchLabel(text)&&hasUpstreamCharge(text)&&!compensationPattern.test(text)&&!/住宿|宿舍|住扣/.test(text));
 }
 const generic=/^(?:招聘(?:职位|職位|岗位|崗位|工种|工種)?|职位(?:名称)?|職位(?:名稱)?|岗位|崗位|工种|工種)$/;
 const editorial=s=>cleanBrackets(sanitizeRaw(s)).replace(/^(?:更新|急单|急單|新增)\s*/,'').trim();
 const jobWords=/(?:大车维修|大車維修|汽车维修|汽車維修|车辆维修|車輛維修|机修工|機修工|维修工|維修工|师傅|師傅|厨师|廚師|帮厨|幫廚|帮工|幫工|侍应生|侍應生|待应生|服务员|服務員|司机|司機|驾驶员|駕駛員|清洁员|清潔員|保洁|保潔|文员|文員|销售|銷售|技工|电工|電工|美容师|美容師|理发师|理髮師|仓务|倉務|收银员|收銀員|护士|護士|护工|護工|保安|焊工|助理|经理|經理|工程师|工程師|顾问|顧問|食品加工|清洁工|清潔工|保洁员|保潔員|搬运工|搬運工|包装工|包裝工|洗碗工|杂工|雜工|售货员|售貨員|店员|店員|理货员|理貨員|收货员|收貨員|内勤|內勤|主管)/;
 function titleValue(value,explicit=false){
  let text=editorial(value).replace(/^HK(?=[\u3400-\u9fff])/i,'').replace(/^(?:招聘(?:职位|職位|岗位|崗位|工种|工種)|招聘(?=[\s:：])|职位名称|職位名稱|职位|職位|岗位|崗位|工种|工種)\s*[:：]?\s*/,'');
  if(/^[（(]?\s*批文/.test(text))return '';
  text=text.replace(/[（(][^）)]*(?:简历|簡歷|视频|視頻|面试|面試|报名|報名|批文)[^）)]*[）)]/g,'');
  text=text.replace(/(?:HKD|HK\$|HK|港币|港幣|港元|USD|RMB|CNY|CAD|MOP|[$￥¥])\s*\d[\s\S]*$/i,'').trim();
  text=text.replace(/男女不限[\s\S]*$/,'');
  text=text.split(/(?:\s+(?:男女不限|男性|女性|男士|女士)|\s+[男女](?=[\s\d，,]|$)|[男女](?=\d{2}\s*[岁歲]))|\s*\d{2}\s*(?:[-~～–至]\s*\d{2})?\s*[岁歲]|\s+(?:粤语|粵語|普通话|普通話|英语|英語)/)[0];
  text=text.replace(/\s*[:：，,]?\s*(?:共|需|招聘)?\d+\s*(?:名|人|位)(?:\s.*)?$/,'').replace(/[：:，,；;。\s]+$/,'').trim();
  if(!text||generic.test(text)||text.length>65||/^(?:已视频|已視頻|继续收|繼續收|能出席|需附|有工作|工作餐|更新|面试|面試|要求|有经验|有經驗)/.test(text)||/公司(?:招聘|招工|诚聘|誠聘)?$/.test(text)||/^(?:HKD|港币|港幣|港元|薪|工资|工資|月薪|工作时间|工作時間)/i.test(text))return '';
  return explicit||jobWords.test(text)?text:'';
 }
 function roleHeader(line){
  const tagged=matchLabel(line);if(tagged)return tagged.key==='title'&&!requirementDescription(tagged.value)?titleValue(tagged.value,true):'';
  const text=stripOrdinal(line);if(/^[（(]|职责|職責|工作要求|工作内容|工作內容|负责|負責|经验|經驗|需有/.test(text))return '';
  const recruited=text.match(/^(.*?)\s*(?:急招|招聘|诚聘|誠聘|招工)\s*[:：]?\s*(.+)$/);
  if(recruited&&(!recruited[1].trim()||employerHeading(recruited[1])))return identityTitle(recruited[2]);
  const compact=rolePay(text);if(compact?.title)return compact.title;
  return titleValue(text);
 }
 function salaryLine(line){const label=matchLabel(line);return label?.key==='salary'||!!rolePay(line)||(!label&&/(?:月薪|工资|工資|薪金|薪资|薪資|薪酬)\s*[:：]?\s*(?:[$￥¥]|HKD|港币|港幣|\d)/i.test(line))}
 function splitBatchOrders(input){return String(input??'').replace(/\r\n?/g,'\n').split(/\n\s*(?:[-_=*]{3,}|下一[单份]|第\s*[\d一二三四五六七八九十]+\s*[单份])\s*(?:\n|$)/).map(s=>s.trim()).filter(Boolean)}
 function splitOrders(input){
  const explicit=splitBatchOrders(input);
  const output=[];
  for(const block of explicit){
   const lines=block.split('\n');let start=0,title='',hasSalary=false;
   for(let i=0;i<lines.length;i++){
    const candidate=roleHeader(lines[i]);
    const future=salaryLine(lines[i])||lines.slice(i+1).some(salaryLine);
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
 const moneyToken='(?:HKD|HK[$]|HK|USD|RMB|CNY|MOP|CAD|EUR|GBP|港币|港幣|港元|人民币|人民幣|澳门币|澳門幣|[$￥¥])?\\s*\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-~～至]\\s*\\d[\\d,]*(?:\\.\\d+)?)?\\s*(?:HKD|USD|RMB|CNY|MOP|港币|港幣|港元|HK|元|[wW万萬])?(?:\\s*[/／](?:月|年|日|天|小时|小時|时|時))?';
 const quotePattern=/全包|包价|包價|打包价|打包價|总价|總價|總費|总费|底价|底價|上家价|上家價|上游价|上游價|成本价|成本價/;
 const costPattern=/租金|住宿(?:扣|费|費)|住(?:宿)?扣|宿舍(?:扣|费|費)|劳务|勞務|办证|辦證|保险|保險|中介|佣介|管理费|管理費|服务费|服務費|报名费|報名費|收费|收費|费用|費用|报价|報價/;
 const deductionPattern=/(?:住宿|住|宿舍|宿舍费|宿舍費|住宿费|住宿費)[^；;。\n]{0,30}(?:扣|费用|費用)|扣(?:按照|按|实际|實際)?[^；;。\n]{0,15}(?:底薪|薪金|工资|工資|薪资|薪資)|租金|住宿(?:扣|费|費)|住(?:宿)?扣|宿舍(?:扣|费|費)|餐费|餐費|伙食扣|扣款|扣薪|扣工资|扣工資|扣\s*\d/;
 const upstreamFeePattern=/劳务|勞務|办证|辦證|保险|保險|中介|佣介|管理费|管理費|服务费|服務費|报名费|報名費|收费|收費|费用|費用|报价|報價/;
 function financeContext(value){const source=String(value??'');return source.replace(/(?:报价|報價|费用|費用|保险|保險)(?:单|單|表|文件|资料|資料|报表|報表|业务|業務|系统|系統|公司|集团|集團|文员|文員|顾问|顧問|客服)/g,(match,index)=>!/(?:公司|集团|集團|文员|文員|顾问|顧問|客服)$/.test(match)&&/^[\s:：]*(?:(?:HKD|HK\$|HK|[$￥¥])\s*)?\d{3,}/i.test(source.slice(index+match.length))?match:' '.repeat(match.length));}
 function hasQuote(value){return quotePattern.test(financeContext(value));}
 function hasCost(value){return costPattern.test(financeContext(value));}
 function hasUpstreamCharge(value){const text=financeContext(value);const monetary=text.replace(/\d+(?:\.\d+)?(?:\s*[-~～至]\s*\d+(?:\.\d+)?)?\s*(?:岁|歲|年(?:经验|經驗)?|个月|個月|小时|小時|[hH](?![A-Za-z])|度|℃|kg|公斤|份|张|張|天)/g,'');return upstreamFeePattern.test(text)&&/^(?:劳务|勞務|办证|辦證|保险|保險|中介|服务费|服務費|费|費|[+＋/\s])+$/u.test(text)||upstreamFeePattern.test(text)&&/\d|另计|另計|另付|收费|收費|费用[：:]|費用[：:]|报价[：:]|報價[：:]/.test(monetary);}
 const compensationPattern=/津贴|津貼|补贴|補貼|补助|補助|奖金|獎金|佣金|提成|花红|花紅|加班工资|加班工資|加班另计|加班另計|加班费|加班費|底薪|基本工资|基本工資|底\d/;
 function clauses(value){return String(value??'').replace(/(?<=[\d%）)])\s*(?=住宿扣|住扣|宿舍扣|扣款)/g,'；').split(/[\n；;。]|(?<!\d)[，,]|[，,](?!\d)/).map(s=>s.trim()).filter(Boolean)}
 function unique(parts){return [...new Set(parts.filter(Boolean).map(s=>s.trim()).filter(Boolean))]}
 function stripSourcePackage(value,preserveSalary=true){
  const source=String(value??'');if(!hasQuote(source))return source;
  return clauses(source).map(part=>{
   const quote=financeContext(part).match(quotePattern);if(!quote)return part;if(!preserveSalary)return '';
   let before=part.slice(0,quote.index).trim();const after=part.slice(quote.index+quote[0].length).replace(/^[价格價格费用費用\s:：]+/,'');
   if(!/^(?:[$￥¥]|[A-Z]{3}|港币|港幣|港元|\d|[一二三四五六七八九十百千万萬两兩])/i.test(after))before=before.replace(new RegExp(moneyToken+'\\s*$','i'),'');
   return before.replace(/(?:费用|費用|价格|價格|报价|報價)\s*[:：]?\s*$/,'').trim();
  }).filter(Boolean).join('；');
 }
 function cleanCompanyText(value,removeBarePrice=true,allowCompensation=false){
  return unique(clauses(stripSourcePackage(value,false)).map(part=>{
   if(removeBarePrice&&sourceQuoteLine(part))return '';
   part=cleanBrackets(part);if(hasQuote(part))return '';
   if(allowCompensation&&deductionPattern.test(part)&&!hasUpstreamCharge(part))return part;
   if(hasCost(part)&&(deductionPattern.test(part)||hasUpstreamCharge(part))){
    const marker=financeContext(part).match(costPattern);const hasHousing=/住宿|宿舍|住扣/.test(marker[0]);let preceding=part.slice(0,marker.index);preceding=preceding.replace(new RegExp(moneyToken+'\\s*$','i'),'').replace(/(?:扣|需付|另收|另加|收取|支付|含|加|实际|實際|大约|大約|约|約)\s*$/,'').trim();const housing=hasHousing&&!/住宿|宿舍/.test(preceding)?(/宿舍/.test(marker[0])?'宿舍':'住宿'):'';part=(preceding+housing).replace(/(?:扣|需付|另收|收取|支付|实际|實際|大约|大約|约|約)\s*$/,'').trim();
   }
   if(!part)return '';
   if(allowCompensation&&compensationPattern.test(part))return part;
   part=part.replace(/(?:HKD|HK[$]|HK|USD|RMB|CNY|MOP|CAD|EUR|GBP|港币|港幣|港元|人民币|人民幣|澳门币|澳門幣|[$￥¥])\s*\d[\d,]*(?:\.\d+)?\s*(?:[wW万萬元]|港元)?(?:\s*[/／](?:月|年|天|日|人|次))?/gi,'')
    .replace(/\d[\d,]*(?:\.\d+)?\s*(?:港元|港币|港幣|元|蚊|块|塊|[万萬wW](?!功率|瓦)|[/／](?:月|年|天|日|人|次))/g,amount=>/[wW]$/.test(amount)&&/功率|瓦|设备|設備/.test(part)?amount:'');
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
   for(const part of clauses(text)){if(hasCost(part)||hasQuote(part))continue;const found=part.match(strict);if(found){offset=text.indexOf(part)+found.index;lead=found;break;}}
  }
  if(!lead||!lead[0].match(/\d/))return {salary:'',notes:[]};
  const main=lead[0].trim()+(text.slice(offset+lead[0].length).startsWith('+')&&!/^\+\d/.test(text.slice(offset+lead[0].length))?'+':''),before=text.slice(0,offset).replace(/(?:工资|工資|月薪|薪金|薪酬|薪资|薪資)\s*[:：]?\s*$/,'');
  let rest=text.slice(offset+lead[0].length).replace(/^[\s+，,；;]+/,'').replace(/^[（(]([\s\S]*)[）)]$/,'$1');
  const notes=clauses([before,rest].filter(Boolean).join('；')).map(part=>cleanCompanyText(part,true,true)).filter(Boolean);
  const earnings=notes.filter(part=>compensationPattern.test(part)&&!deductionPattern.test(part));
  return {salary:unique([main,...earnings]).join('；'),main,notes:notes.filter(part=>!earnings.includes(part))};
 }
 function formatCompanySalary(value){
  const pay=extractPay(value);if(!pay.main)return String(value||'');
  // Formatting only: explicitly foreign currencies are never silently converted.
  if(/USD|RMB|CNY|MOP|CAD|EUR|GBP|人民币|人民幣|澳门币|澳門幣/i.test(pay.main))return pay.salary;
  const number=pay.main.match(/\d[\d,]*(?:\.\d+)?(?:\s*[-~～至]\s*\d[\d,]*(?:\.\d+)?)?/);if(!number)return pay.salary;
  const nonMonthly=pay.main.match(/[/／](?:年|日|天|小时|小時|时|時)/)?.[0]||'';
  return 'HKD'+number[0].replace(/[,\s]/g,'')+nonMonthly+(pay.main.endsWith('+')?'+':'')+pay.salary.slice(pay.main.length);
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
   else if(summaryGender(lines[i]))candidates.push(summaryGender(lines[i]));
   else if(roleHeader(lines[i])||/男女(?:不限|均可|皆可)|只招|仅限|僅限|不限性别|性别不限/.test(lines[i])){
    const hint=lines[i].match(/男女不限|男[\/／、]女均可|(?:男性|女性)(?=[\s，,；;（(\d]|$)|男(?=\s|\d|[，,]|$)|女(?=\s|\d|[，,]|$)|性别不限|不限性别/);if(hint)candidates.push(hint[0]);
   }
  }
  const resolved=unique(candidates.map(genderFromText));return resolved.length===1?resolved[0]:'';
 }
 // Stage 1 builds source spans without deleting unknown or financial content.
 // Offsets are UTF-16 indices into the archived raw source, never row assumptions.
 function documentUnits(raw){
  const boundaries=new Set([0,raw.length]),headings=[];
  for(const match of raw.matchAll(/[【\[［「『〔]([^】\]］」』〕]{1,25})[】\]］」』〕]/g)){
   if(allLabels.some(item=>item.label===recognitionText(match[1]).replace(/\s/g,''))){boundaries.add(match.index);headings.push([match.index,match.index+match[0].length]);}
  }
  for(let i=0;i<raw.length;i++)if(raw[i]==='\n'&&!headings.some(([a,b])=>i>=a&&i<b))boundaries.add(i+1);
  const points=[...boundaries].sort((a,b)=>a-b),units=[];
  for(let i=0;i<points.length-1;i++){
   let start=points[i],end=points[i+1];while(start<end&&/\s/.test(raw[start]))start++;while(end>start&&/\s/.test(raw[end-1]))end--;
   if(end>start)units.push({start,end,text:raw.slice(start,end),line:raw.slice(0,start).split('\n').length});
  }return units;
 }
 function unitFragments(unit){
  const result=[];let depth=0,start=0;
  const emit=end=>{let a=start,b=end;while(a<b&&/\s/.test(unit.text[a]))a++;while(b>a&&/\s/.test(unit.text[b-1]))b--;if(b>a)result.push({start:unit.start+a,end:unit.start+b,line:unit.line,text:unit.text.slice(a,b)});};
  for(let i=0;i<unit.text.length;i++){
   const c=unit.text[i];if(/[（(]/.test(c))depth++;else if(/[）)]/.test(c))depth=Math.max(0,depth-1);
   if(!depth&&(/[；;。]/.test(c)||(/[，,]/.test(c)&&!(c===','&&/\d/.test(unit.text[i-1]||'')&&/\d/.test(unit.text[i+1]||''))))){emit(i);start=i+1;}
  }emit(unit.text.length);return result;
 }
 function summaryGender(text){
  // Gender words embedded in job names, customers or duties are not recruitment constraints.
  const context=recognitionText(text).replace(/\d{2}\s*[岁歲]\s*(?:以下|以上|以内|以內|内|內|左右)?/g,' ').replace(/已婚|未婚|本科|大专|大專|大学|大學|中专|中專|学历|學歷|高中|初中/g,' ');
  if(/(?:负责|負責|顾客|顧客|客户|客戶|男女装|男女裝)/.test(context))return '';
  const hint=context.match(/(?:^|[\s，,；;。])((?:男女|女男)(?:不限|均可|皆可)?|男性|女性|男士|女士|男工|女工|男|女)(?=[\s，,；;。\d]|$|不限|均可|皆可)/);
  return hint?genderFromText(hint[1]):'';
 }
 function rolePay(value){
  const text=stripOrdinal(value),token=/(?:HKD|HK\$|HK|港币|港幣|港元|USD|RMB|CNY|CAD|MOP|[$￥¥])\s*\d[\d,]*(?:\.\d+)?(?:\s*[-~～至]\s*\d[\d,]*(?:\.\d+)?)?\+?(?:\s*[/／](?:月|天|日|小时|小時))?/ig;
  for(const match of text.matchAll(token)){
   const before=text.slice(0,match.index).replace(/^HK(?=[\u3400-\u9fff])/i,'').replace(/^(?:HK|香港)?(?:工厂|工廠)(?=\S)/,'').trim();
   const title=identityTitle(before);
   const compactCandidate=before.length>=2&&before.length<=30&&/[\u3400-\u9fff]/.test(before)&&!/[，,；;：:]/.test(before)&&!requirementCue.test(before)&&!dutyCue.test(before)&&!compensationPattern.test(before)&&!deductionPattern.test(before)&&!hasQuote(before)&&!hasUpstreamCharge(before);
   if(title||compactCandidate)return {title,pay:text.slice(match.index),main:match[0]};
  }return null;
 }
 const ageExpression=/(?<![\d:：])(?:\d{2}\s*[-–~～至]\s*\d{2}\s*[岁歲]\s*(?:以下|以内|以內|以上|内|內|左右)?|\d{2}\s*[岁歲]\s*(?:以下|以内|以內|以上|内|內|左右)?)/;
 const clockExpression=/(?<!\d)\d{1,2}[:：]\d{2}\s*[-–~～至]\s*\d{1,2}[:：]\d{2}/;
 const requirementDescription=s=>/^(?:有|具有|具备|具備|要求|需要|须|須|至少|熟悉|熟练|熟練|精通|懂得|会|會|持有|优先|優先|最好|相关|相關).*(?:经验|經驗|学历|學歷|技能|证书|證書|优先|優先)/.test(recognitionText(s));
 const hourExpression=/(?:每天|每日)?\s*\d+(?:\.\d+)?\s*(?:小时|小時|[hH](?![A-Za-z]))/;
 const restExpression=/上\s*\d+\s*休\s*\d+|(?:月休|每月休息|休息)\s*\d+\s*天|每[周週]休\s*\d+\s*天|(?:^|[，,\s])休\s*\d+(?!\d)/m;
 const requirementCue=/要识得|要識得|持有|资格证|資格證|证书|證書|精通|熟练|熟練|略懂|掌握|具备|具備|经验|經驗|学历|學歷|本科|大专|大專|大学|大學|中专|中專|高中|初中|认识|認識|需有|必须有|必須有|能吃苦|责任心|責任心|服从|服從|年龄|年齡/;
 const dutyCue=/负责|負責|协助|協助|主要做|能接受|处理|處理|接听|接聽|整理|操作|装卸|裝卸|盘点|盤點|存档|存檔|输入|輸入|影印|报告|報告|送递|送遞|入账|入賬|跟单|跟單|落单|落單|报价单|報價單|接待|收银|收銀|收钱|收錢|切肉|备料|備料|搬运|搬運/;
 const employerCue=/(?:公司|集团|集團|餐厅|餐廳|酒店|美容院|美容中心|发廊|髮廊|工厂|工廠|档口|檔口|菜市场|菜市場|超市|商场|商場|市场|市場|门店|門店|连锁店|連鎖店|医院|醫院|诊所|診所|学校|學校|银行|銀行|酒楼|酒樓|餐馆|餐館|商行|事务所|事務所|会所|會所|中心|商店|机场|機場|院舍|金铺|金鋪|加工店)(?:[（(][^）)]{1,20}[）)])?$/;
 // Identity extraction is a document-wide evidence pass, independent of clause routing.
 // Values must be literal excerpts; the vocabulary only corroborates weak headings.
 function identityTitle(value){
  const candidate=titleValue(value,true);
  if(!candidate||candidate.length<2||candidate.length>35||summaryGender(candidate)||/^(?:本科|大专|大專|大学|大學|中专|中專|高中|初中|学历|學歷)$|^(?:会听|會聽|略懂|流利)?(?:粤语|粵語|英文|英语|英語|普通话|普通話)(?:流利|即可)?$/.test(candidate)||!/[\p{L}]/u.test(candidate)||/[，,；;：:。!?！？]/.test(candidate)||/^(?:负责|負責|协助|協助|主要|需|須|须|要|能|持有|精通|熟练|熟練|具备|具備|有经验|有經驗|制作|製作|处理|處理|提供|安排|整理)|经验|經驗|证书|證書|资格证|資格證/.test(candidate)||employerCue.test(candidate)||/(?:雇主|僱主).*(?:提供|安排)|(?:免费|免費).*(?:提供|住)|包吃|食宿/.test(candidate)||hasQuote(candidate)||hasUpstreamCharge(candidate)||compensationPattern.test(candidate)||deductionPattern.test(candidate)||/^(?:新单|新單|急单|急單|高龄|高齡|来简历|來簡歷)|^(?:候选资料|候選資料|资料待|資料待|资料另|資料另|附加内容|附加內容|另行|待核|已确认|已確認|简历|簡歷|报名|報名|面试|面試|选表|選表|录取|錄取|看过来|看過來|提供|安排|免费|免費|福利|每[周週]|每天|月休|休\d)/.test(candidate))return '';
  return candidate;
 }
 function employerHeading(value){
  const text=editorial(value).replace(/[~～:：\s]+$/,'').replace(/(?:招聘|招工|诚聘|誠聘|聘请|聘請|聘)\s*[:：]?$/,'').trim();
  return text.length<=60&&employerCue.test(text)&&!/[，,；;。]/.test(text)&&!/(?:提供|安排|负责|負責|协助|協助|要求|经验|經驗|持有|工作地点|工作地點|地址|住扣)/.test(text)&&!hourExpression.test(text)&&!hasQuote(text)&&!hasUpstreamCharge(text)&&!deductionPattern.test(text)?text:'';
 }
 function collectIdentityEvidence(raw){
  const candidates=[],weak=[],units=documentUnits(raw);let scope='',pending='';
  const add=(field,value,rank,fragment,reason)=>{
   if(!value||!fragment.text.includes(value))return;
   const offset=fragment.text.indexOf(value);candidates.push({field,value,rank,start:fragment.start+offset,end:fragment.start+offset+value.length,fragmentStart:fragment.start,reason});
  };
  const wageDocument=units.some(unit=>salaryLine(unit.text));
  for(const [unitIndex,unit]of units.entries())for(const fragment of unitFragments(unit)){
   const label=matchLabel(fragment.text.replace(/([【\[［「『〔])([^】\]］」』〕]+)([】\]］」』〕])/g,(_,a,b,c)=>a+b.replace(/\s/g,'')+c)),key=label?.key;let text=stripOrdinal(label?label.value:fragment.text);
   if(label){scope=key;pending=!text&&['title','employer'].includes(key)?key:'';}
   if(!text||hasQuote(text)||hasUpstreamCharge(text)||sourceQuoteLine(text))continue;
   if(pending&&!key){add(pending,pending==='title'?titleValue(text,true):editorial(text),0,fragment,'labelled_heading_value');pending='';continue;}
   // A hiring relation names both parties without synthesising either name.
   const relation=text.match(/^(.*?)\s*(?:急招|招聘|诚聘|誠聘|招工)\s*[:：]?\s*(.+)$/);
   if(relation&&(!key||key==='employer'||key==='title'&&relation[1].trim())){
    const employer=employerHeading(relation[1]),tail=relation[2],pay=rolePay(tail);
    if(!relation[1].trim()||employer){add('employer',employer,key==='employer'?0:1,fragment,'recruiting_employer');add('title',identityTitle(pay?tail.slice(0,tail.indexOf(pay.main)):tail),key==='title'?0:1,fragment,'recruiting_position');continue;}
   }
   if(key==='title'&&!requirementDescription(text)){add('title',titleValue(text,true),0,fragment,'explicit_position');continue;}
   if(key==='employer'){add('employer',editorial(text),0,fragment,'explicit_employer');continue;}
   if(key)continue;
   const pay=rolePay(text);
   if(pay){add('title',pay.title,1,fragment,'position_attached_to_wage');continue;}
   const employer=employerHeading(text);
   if(employer&&(!['workContent','requirements','notes','location','interview'].includes(scope)||!!rolePay(units[unitIndex+1]?.text||''))){add('employer',employer,2,fragment,'employer_heading');continue;}
   if(['workContent','requirements','notes','location','interview','approval','title'].includes(scope))continue;
   const candidate=identityTitle(text);
   if(candidate&&wageDocument){if(jobWords.test(candidate))add('title',candidate,2,fragment,'position_heading');else weak.push({candidate,fragment});}
  }
  // An isolated unlabelled heading needs document context and must be unique.
  if(!candidates.some(item=>item.field==='title')&&unique(weak.map(item=>item.candidate)).length===1)for(const item of weak)add('title',item.candidate,3,item.fragment,'unique_position_heading_with_wage');
  const resolve=field=>{
   const entries=candidates.filter(item=>item.field===field);if(!entries.length)return {value:'',conflict:false,selected:[]};
   const best=Math.min(...entries.map(item=>item.rank)),selected=entries.filter(item=>item.rank===best),values=unique(selected.map(item=>item.value));
   return {value:values.length===1?values[0]:'',conflict:values.length>1,selected};
  };
  return {candidates,title:resolve('title'),employer:resolve('employer')};
 }
 function catalogDocument(raw){
  const identities=collectIdentityEvidence(raw),buckets={},ledger=[],explicitGenders=[],inferredGenders=[];let section='',componentLabel='',current=null;
  const push=(key,value,reason='semantic')=>{if(value)(buckets[key]??=[]).push(value);if(current){current.fields=unique([...current.fields,key]);current.disposition='classified';current.reason=reason;}};
  const title=(value,rank)=>{if(value)push('title',value,rank===0?'explicit_label':'role_heading');};
  const exclude=reason=>{current.disposition='excluded';current.reason=reason;};
  for(const unit of documentUnits(raw)){
   const unitLabel=matchLabel(unit.text.replace(/([【\[［「『〔])([^】\]］」』〕]+)([】\]］」』〕])/g,(_,a,b,c)=>a+b.replace(/\s/g,'')+c));
   if(unitLabel){section=unitLabel.key;if(section==='compensation')componentLabel=unitLabel.label;}
   let continuation='';
   for(const [index,fragment]of unitFragments(unit).entries()){
    current={...fragment,id:'span-'+fragment.start+'-'+fragment.end,fields:[],disposition:'review',reason:'unclassified'};ledger.push(current);
    const cleaned=stripOrdinal(fragment.text).replace(/^[【\[［「『〔](?:更新|急单|急單|新增)[】\]］」』〕]\s*/,'').replace(/([【\[［「『〔])([^】\]］」』〕]+)([】\]］」』〕])/g,(_,a,b,c)=>a+b.replace(/\s/g,'')+c);
    const tag=matchLabel(cleaned);let key=tag?.key;let text=(tag?tag.value:cleaned).trim();
    if(key==='title'&&requirementDescription(tag.value)){key='requirements';}
    if(tag){section=key;if(key==='compensation')componentLabel=tag.label;}
    if(tag&&!text){push(key,'','section_heading');continue;}
    // A bracketed but unknown label remains visible for review, rather than being dropped.
    if(!tag&&/^[【\[［「『〔]/.test(cleaned)&&!roleHeader(cleaned)){current.reason='unknown_label';continue;}
    if(hasQuote(text)){exclude('supplier_package_quote');continue;}
    if(hasUpstreamCharge(text)){
     const safe=cleanCompanyText(text,true,true);if(safe&&safe!==text){push('notes',safe,'non_price_fact_retained');current.disposition='review';current.reason='mixed_fee_and_business_text';}
     else exclude('upstream_fee');continue;
    }
    if(/^DJ\s*[:：]\s*\d/i.test(text)){exclude('supplier_footer');continue;}
    if(sourceQuoteLine(text)&&!['salary','compensation','age','hours','rest'].includes(key)&&!(index===0&&unitLabel?.key==='salary')&&!(section==='salary'&&/^(?:\d[\d,.]*|(?:HKD|HK\$|HK)\s*\d[\d,.]*\+?)$/i.test(text)&&ledger.at(-2)?.reason==='section_heading')){exclude('unlabelled_amount');continue;}
    if(!tag&&ledger.at(-2)?.reason==='section_heading'&&ledger.at(-2)?.fields.includes(section)&&['salary','age','hours','rest','language','gender','employer'].includes(section)){push(section,text,'label_value');if(section==='gender')explicitGenders.push(text);continue;}
    if(/^(?:新单|新單|更新|急单|急單|高龄看过来|高齡看過來)[🔥~～!！\s]*$/.test(cleanBrackets(text))){exclude('promotional_heading');continue;}
    if(/^(?:以上内容仅供参考|以上內容僅供參考|具体工作要求以面试为准|具體工作要求以面試為準|以录取实际工资为准|以錄取實際工資為準)/.test(text)){exclude('editorial_disclaimer');continue;}
    const detectedAge=text.match(ageExpression)?.[0];if(detectedAge&&key!=='workContent'&&section!=='workContent')push('age',detectedAge,'age_restriction');
    if(/^(?:其他跟劳工法|其他跟勞工法)/.test(text)){push('notes',text,'benefit_condition');continue;}
    const identity=identities.candidates.filter(item=>item.fragmentStart===fragment.start);
    for(const item of identity){if(item.field==='title')title(item.value,item.rank);else push('employer',item.value,item.reason);}
    if(identity.length){current.evidence=identity;const gender=summaryGender(text);if(gender){inferredGenders.push(gender);push('gender',gender,'identity_demographics');}const age=text.match(ageExpression)?.[0];if(age)push('age',age,'identity_demographics');}
    // Bare demographic summaries remain independent of the preceding paragraph's field.
    if(!key&&!identity.length){const gender=summaryGender(text),age=text.match(ageExpression)?.[0];if((gender||age&&/^\d{2}/.test(text))&&!dutyCue.test(text)&&!hasCost(text)){
     if(gender){inferredGenders.push(gender);push('gender',gender,'demographic_summary');}if(age)push('age',age,'demographic_summary');push('requirements',text,'demographic_summary');section='';continue;
    }}
    const compact=rolePay(text);

    if(compact&&(!key||key==='title')){push('salary',compact.pay,'inline_role_and_pay');if(!compact.title){current.disposition='review';current.reason='unknown_inline_role';}inferredGenders.push(summaryGender(text));section='';continue;}
    if(key==='title'){
     if(!current.fields.length)current.reason='uncertain_title';
     const prep=text.match(/[（(]([^）)]*(?:视频|視頻|简历|簡歷|面试|面試)[^）)]*)[）)]/);if(prep)push('interview',prep[1],'interview_preparation');
     const gender=summaryGender(text);if(gender)inferredGenders.push(gender);
     const age=text.match(ageExpression)?.[0];if(age)push('age',age);continue;
    }
    if(key==='gender'){explicitGenders.push(text);push('gender',text,'explicit_label');continue;}
    if(key==='compensation'){push('notes',componentLabel+'：'+text,'salary_component');continue;}
    if(key==='employer'&&identity.length){const pay=rolePay(text);if(pay)push('salary',pay.pay,'recruiting_salary');section='';continue;}
    if(key){push(key,text,'explicit_label');if(key==='requirements'){const g=summaryGender(text);if(g){inferredGenders.push(g);push('gender',g,'requirement_gender');}}continue;}
    if(identity.length){section='';const pay=rolePay(text);if(pay)push('salary',pay.pay,'recruiting_salary');continue;}
    if(/^[（(]?批文/.test(text)){push('notes',text,'approval_description');continue;}
    if(/面[试試]|试工|試工|(?:需附|附|提供).*(?:视频|視頻)/.test(text)){push('interview',text,'interview_instruction');continue;}
    if(/食宿|包住|包吃|包食|吃住|工作餐|住宿|宿舍|吃自理|(?:提供|安排|免费|免費).*住/.test(text)&&!deductionPattern.test(text)&&!dutyCue.test(text)){push('notes',text,'meal_or_housing_fact');continue;}
    if(deductionPattern.test(text)){push('notes',text,'employee_deduction');continue;}
    if(compensationPattern.test(text)||/劳工假|勞工假|年假|福利|(?:满|滿).*(?:月|年)/.test(text)){push('notes',section==='compensation'?componentLabel+'：'+text:text,'pay_or_benefit_condition');continue;}
    if(section==='compensation'&&!unitLabel){push('notes',componentLabel+'：'+text,'component_continuation');continue;}
    if(/^(?:需|需要)?(?:轮班|輪班|早班|夜班|晚班|通宵更?)$/.test(text)){push('shift',text,'shift');continue;}
    if(clockExpression.test(text)||hourExpression.test(text)||/(?:每[周週]|每天|每日).*(?:工作|班)|轮班|輪班/.test(text)){push('hours',text,'schedule');continuation='hours';continue;}
    if(restExpression.test(text)){push('rest',text,'rest_arrangement');continue;}
    if(!key&&section==='requirements'&&/^(?:负责|負責|协助|協助|一般|入单|入單|服务顾客|服務顧客|销售货品|銷售貨品|送货|送貨|上货落货|上貨落貨|收货款|收貨款)/.test(text)){push('workContent',text,'operational_duty_in_requirements');continue;}
    // Explicit paragraphs keep their author-defined scope; unlabeled summaries are multi-field.
    if(['requirements','workContent','notes','hours','interview'].includes(section)){
     push(section,text,'paragraph_continuation');const g=section==='requirements'?summaryGender(text):'';if(g){inferredGenders.push(g);push('gender',g,'requirement_gender');}continue;
    }
    const age=text.match(ageExpression)?.[0],gender=summaryGender(text);
    const language=/广东话|廣東話|国语|國語|粤语|粵語|普通话|普通話|英语|英語|英文|日语|日語|韩语|韓語|客家话|客家話|潮汕话|潮汕話/.test(text);
    if(age||gender||requirementCue.test(text)||language){
     push('requirements',text,'candidate_requirement');if(age)push('age',age);if(gender){inferredGenders.push(gender);push('gender',gender);}if(language)push('language',text,'language_requirement');continuation='requirements';continue;
    }
    if(dutyCue.test(text)||/客服工作|解决客户|解決客戶|炸及烧位|炸及燒位|水吧甜品|鸡档|雞檔|送货|送貨|上货落货|上貨落貨|收货款|收貨款/.test(text)||continuation==='workContent'){push('workContent',text,'job_duty');continuation='workContent';continue;}
    if(continuation==='requirements'){push('requirements',text,'requirement_continuation');continue;}
    if(salaryLine(text)||/^(?:HKD|HK\$|HK|港币|港幣|港元|[$￥¥])\s*\d/i.test(text)){push('salary',text,'salary_statement');continue;}
   }
  }
  const salaryValues=unique((buckets.salary||[]).map(value=>extractPay(value).main).filter(Boolean).map(formatCompanySalary));
  const gender=explicitGenders.length?normalizeGender(explicitGenders.join('\n'),raw):normalizeGender(unique(inferredGenders.filter(Boolean)).join('\n'));
  const conflicts=[];
  if(identities.title.conflict)conflicts.push('title');
  if(identities.employer.conflict)conflicts.push('employer');
  if(salaryValues.length>1)conflicts.push('salary');
  if((explicitGenders.length||inferredGenders.some(Boolean))&&!gender)conflicts.push('gender');
  if(salaryValues.length)for(let i=0;i<ledger.length;i++){
   const entry=ledger[i];if(entry.fields.some(key=>['notes','requirements'].includes(key))&&compensationPattern.test(entry.text)&&!deductionPattern.test(entry.text)&&!hasUpstreamCharge(entry.text)){entry.fields=unique([...entry.fields.filter(key=>!['notes','requirements'].includes(key)),'salary']);}
   if(i>0&&entry.fields.includes('salary')&&/(?:满|滿).*(?:月|年)|(?:入职|入職).*(?:后|後)/.test(ledger[i-1].text)&&ledger[i-1].fields.includes('notes'))ledger[i-1].fields=['salary'];
  }
  for(const entry of ledger)if(entry.fields.some(key=>conflicts.includes(key))){entry.disposition='conflict';entry.reason='conflicting_candidates';}
  return {buckets,ledger,gender,identities,titleConflict:conflicts.includes('title'),salaryConflict:salaryValues.length>1};
 }

 function parseOne(input,code=''){
  const o={raw:sanitizeRaw(input),code:companyCode(code,sourcePrefix(input)),sourcePrefix:sourcePrefix(input),parserVersion:VERSION};
  const catalog=catalogDocument(o.raw),{buckets}=catalog;
  const joined=key=>unique(buckets[key]||[]).join('\n');
  o.title=catalog.identities.title.value;o.employer=catalog.identities.employer.value;
  const pay=extractPay((buckets.salary||[])[0]||'');o.salary=catalog.salaryConflict?'':pay.salary;
  o.gender=catalog.gender;
  const context=[joined('age'),joined('requirements'),joined('title')].filter(Boolean).join('\n');
  o.age=unique((buckets.age||[]).map(v=>v.trim())).join('；')||context.match(ageExpression)?.[0]||'';
  o.language=joined('language')||unique(input.match(/广东话|廣東話|国语|國語|粤语|粵語|普通话|普通話|英语|英語|英文|日语|日語|韩语|韓語|客家话|客家話|潮汕话|潮汕話/g)||[]).join('、');
  const scheduling=joined('hours');
  const hours=scheduling||input.match(/(?:每天|每日)?\s*\d+(?:\.\d+)?\s*(?:小时|小時|[hH](?![A-Za-z]))/)?.[0]||'';
  const noteParts=[...pay.notes,...(buckets.notes||[])];
  const restMatch=input.match(/上\s*\d+\s*休\s*\d+|(?:月休|每月休息|休息)\s*\d+\s*天|每[周週]休\s*\d+\s*天|(?:^|[，,\s])休\s*\d+(?!\d)/m)?.[0]||'';
  o.hours=clauses(hours).map(part=>{
   if(restMatch)part=part.replace(restMatch,'');part=part.replace(ageExpression,'');
   const benefits=part.search(/(?:满|滿).*(?:月|年)|有(?:奖金|獎金)|劳工假|勞工假/);
   if(benefits>=0){noteParts.push(part.slice(benefits));part=part.slice(0,benefits);}
   return part.replace(/^[\s，,]+|[\s，,]+$/g,'');
  }).filter(Boolean).join('，').replace(/(\d+小)[，；]时/g,'$1时').replace(/(\d+)[，；]小时/g,'$1小时');
  o.shift=joined('shift')||unique(input.match(/通宵更?|夜班|早班|轮班|輪班|晚班|白班|白更|夜更/g)||[]).join('；');
  o.rest=joined('rest')||restMatch;
  o.workContent=joined('workContent');o.requirements=clauses(joined('requirements')).filter(part=>{if(compensationPattern.test(part)){noteParts.push(part);return false;}return true;}).join('；');o.interview=joined('interview');
  if(joined('approval'))noteParts.push('批文：'+joined('approval'));if(joined('location'))noteParts.push('工作地点：'+joined('location'));if(joined('contract'))noteParts.push('合约期限：'+joined('contract'));
  o.notes=unique(noteParts).join('；');
  const result=sanitizeCompany(o);
  for(const entry of catalog.ledger)entry.fields=unique(entry.fields.map(key=>key==='shift'?'hours':key));
  result.recognitionAudit=JSON.stringify({version:VERSION,fragments:catalog.ledger,identityCandidates:catalog.identities.candidates});
  result.parsedSnapshot=JSON.stringify(Object.fromEntries(['code','title','employer','salary','gender','age','language','hours','rest','workContent','requirements','interview','notes'].map(key=>[key,result[key]||''])));
  return result;
 }
 function analyze(input,code='',options={}){
  const parts=options.explicitBoundary?[String(input||'').trim()]:splitOrders(input),warnings=[];
  if(parts.length>1)return {parts,order:null,warnings:['检测到多份原单，请使用批量录入或拆分后处理']};
  const order=parseOne(parts[0]||'',code);if(options.explicitBoundary)order.boundaryMode='explicit';
  if(!order.title)warnings.push('未可靠识别职位，请人工核对');if(!order.gender)warnings.push('性别不明确或有冲突，请人工选择');if(!order.salary)warnings.push('未可靠识别主薪资，请人工核对');
  const review=reviewOrder(input,order);
  warnings.push(...review.warnings);
  return {parts,order,warnings:unique(warnings),sources:review.sources,unclassified:review.unclassified,excluded:review.excluded,conflicts:review.conflicts,ledger:review.ledger};
 }
 function reviewSignature(raw){
  const text=sanitizeRaw(raw);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return 'S1-'+text.length+'-'+(hash>>>0).toString(16);
 }
 function hasReviewConfirmation(order){
  const expected=reviewSignature(order.raw||'');
  const token=String(order.reviewConfirmation||'');
  return token===expected||/^\d+-\d+-[a-f0-9]+$/i.test(token)&&token.replace(/^\d+-/,'S1-')===expected;
 }
 function isHumanReviewed(order){
  if(order.humanReviewedSource)return order.humanReviewedSource===reviewSignature(order.raw||'');
  if(hasReviewConfirmation(order))return true;
  // Legacy evidence only: ready is a price status, not proof of human review.
  if(!order.id||order.status!=='ready')return false;
  try{
   const fields=JSON.parse(order.manualFields||'[]'),baseline=JSON.parse(order.parsedSnapshot||'{}');
   const editable=['title','employer','salary','gender','age','language','hours','rest','workContent','requirements','notes','interview'];
   return Array.isArray(fields)&&fields.some(key=>editable.includes(key)&&String(order[key]||'').trim()&&String(order[key]||'')!==String(baseline[key]||''));
  }catch{return false;}
 }
 function humanReviewMetadata(order,reviewer=''){
  return {humanReviewedSource:reviewSignature(order.raw||''),humanReviewedAt:new Date().toISOString(),humanReviewedBy:String(reviewer||''),reviewConfirmation:reviewSignature(order.raw||'')};
 }
 function reviewOrder(input,order){
  const fresh=parseOne(input,order.code||''),ledger=JSON.parse(fresh.recognitionAudit).fragments;
  const reviewed=isHumanReviewed({...order,raw:input});
  const sources={},warnings=[];
  for(const entry of ledger)if(entry.fields.length)for(const key of entry.fields)(sources[key]??=[]).push(entry.text);
  for(const key of Object.keys(sources))sources[key]=unique(sources[key]);
  // AI evidence is supplementary, literal and privately stored; it never dismisses unclassified rule spans.
  let aiWarnings=[];try{aiWarnings=JSON.parse(order.aiWarnings||'[]').filter(w=>typeof w==='string');}catch{}
  try{for(const fact of JSON.parse(order.aiEvidence||'[]'))if(fact&&typeof fact.value==='string'&&typeof fact.evidence==='string'&&input.includes(fact.evidence)&&fact.evidence.includes(fact.value)&&['title','employer','salary','gender','age','language','hours','rest','interview','workContent','requirements','notes'].includes(fact.field))(sources[fact.field]??=[]).push(fact.evidence);}catch{}
  const unclassified=unique(ledger.filter(entry=>entry.disposition==='review').map(entry=>entry.text));
  const excluded=ledger.filter(entry=>entry.disposition==='excluded');
  const conflicts=ledger.filter(entry=>entry.disposition==='conflict');
  if(!order.title)warnings.push('未可靠识别职位，请人工核对');
  if(!order.gender)warnings.push('性别不明确或有冲突，请人工选择');
  if(!order.salary)warnings.push('未可靠识别主薪资，请人工核对');
  if(!order.age)warnings.push('未识别年龄要求，请核对原单');
  if(!order.hours)warnings.push('未识别工作时间，请核对原单');
  if(/^休\s*\d+$/.test(String(order.rest||'').trim()))warnings.push('休息周期不明确，请确认是每周还是每月');
  warnings.push(...aiWarnings);
  if(unclassified.length)warnings.push('部分原单内容尚未分类，请核对未分类内容');
  if(conflicts.some(entry=>entry.fields.includes('employer')))warnings.push('识别到多个雇主名称，请人工核对');
  if(conflicts.some(entry=>entry.fields.includes('salary')))warnings.push('识别到多组薪资，请人工核对或拆分原单');
  return {warnings:reviewed?[]:unique(warnings),sources,unclassified:reviewed?[]:unclassified,excluded,conflicts:reviewed?[]:conflicts,ledger,reviewed,needsAcknowledgement:!reviewed&&!!(unclassified.length||conflicts.length||aiWarnings.length)};
 }
 function parse(input,code=''){const result=analyze(input,code);return result.order||{raw:sanitizeRaw(input),code,needsSplit:true,title:'',gender:'',salary:''}}
 function sanitizeCompany(order){
  const result={...order};
  const shift=clauses(result.shift).filter(part=>!String(result.hours||'').includes(part));if(shift.length)result.hours=unique([...clauses(result.hours),...shift]).join('；');delete result.shift;
  const deductions=[];
  for(const key of ['requirements','workContent','hours','interview'])if(typeof result[key]==='string')result[key]=clauses(result[key]).filter(part=>{if(deductionPattern.test(part)&&!hasUpstreamCharge(part)&&!hasQuote(part)){deductions.push(part);return false;}return true;}).join('；');
  if(deductions.length)result.notes=unique([result.notes,...deductions]).join('；');
  for(const key of ['title','employer','gender','age','language','hours','rest','workContent','requirements','interview'])if(typeof result[key]==='string')result[key]=cleanBrackets(cleanCompanyText(result[key],!['age','hours','rest'].includes(key)));
  const pay=extractPay(result.salary);
  const notes=clauses(cleanCompanyText(result.notes,true,true));
  for(let i=1;i<notes.length;i++)if(compensationPattern.test(notes[i])&&/(?:满|滿).*(?:月|年)|(?:入职|入職).*(?:后|後)|达到|達到/.test(notes[i-1])&&!costPattern.test(notes[i-1])){notes.splice(i-1,2,notes[i-1]+'，'+notes[i]);i--;}

  const earnings=pay.salary?notes.filter(part=>compensationPattern.test(part)&&!deductionPattern.test(part)&&!hasUpstreamCharge(part)&&!hasQuote(part)):[];
  if(typeof result.salary==='string')result.salary=unique([pay.salary,...earnings]).join('；');
  result.notes=unique([...notes.filter(part=>!earnings.includes(part)),...pay.notes]).join('；');
  result.notes=cleanBrackets(result.notes);if(typeof result.code==='string')result.code=cleanBrackets(result.code);if(typeof result.price==='string')result.price=cleanBrackets(result.price);
  return result;
 }
 function validateCompany(order,forPublication=false){
  const errors=[],reviewed=isHumanReviewed(order);if(forPublication&&!reviewed&&Number(order.parserVersion)>=8&&reviewOrder(order.raw||'',order).needsAcknowledgement&&!hasReviewConfirmation(order))errors.push('请先核对未分类或冲突内容并确认');if(forPublication&&!order.salary)errors.push('未可靠识别主薪资，请人工核对');if(!reviewed&&order.boundaryMode!=='explicit'&&splitOrders(order.raw||'').length>1)errors.push('检测到多份原单，请使用批量录入或拆分后处理');
  if(!order.title||generic.test(order.title)||/^[（(]?批文/.test(order.title))errors.push('未可靠识别职位，请人工核对');
  if(!['男','女','男女不限'].includes(order.gender))errors.push('请选择招聘性别：男、女或男女不限');
  if(!validCode(order.code))errors.push('公司单号格式应为 ZY-年份-月日-流水，可附上家字母');
  for(const key of ['title','employer','salary','gender','age','language','hours','rest','workContent','requirements','notes','interview']){
   const value=String(order[key]||'');if(/[【】\[\]［］〔〕「」『』]/.test(value))errors.push('公司单不能含原单字段括号');
   if(sourceIdentifiers(value).length)errors.push('公司单不能含完整上家编号，只保留单号后的上家字母');
   if(hasQuote(value)||clauses(value).some(part=>hasUpstreamCharge(part)||(deductionPattern.test(part)&&key!=='notes')))errors.push('公司单仍有原单报价或费用信息，请核对');
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
  const result=sanitizeCompany(view);result.salary=formatCompanySalary(result.salary);return result;
 }
 root.ZYOrderParser={isHumanReviewed,hasReviewConfirmation,humanReviewMetadata,reviewSignature,formatCompanySalary,reviewOrder,parse,analyze,splitOrders,splitBatchOrders,sourcePrefix,sourceIdentifiers,sanitizeRaw,sourceCode:companyCode,companyCode,baseCode,validCode,titleValue,normalizeGender,cleanField,extractPay,stripSourcePackage,cleanCompanyText,sanitizeCompany,repairLegacyOrders,present,validateCompany};
})(globalThis);
